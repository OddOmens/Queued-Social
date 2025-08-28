import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PublishRequest {
  postId: string
  platform: string
  content: {
    text: string
    mediaUrls?: string[]
    type: 'single' | 'thread' | 'media'
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError) {
      console.error('Auth error:', authError)
      throw new Error(`Authentication failed: ${authError.message}`)
    }

    if (!user) {
      throw new Error('No user found')
    }

    const { postId, platform, content }: PublishRequest = await req.json()

    console.log(`Publishing post ${postId} to ${platform} for user ${user.id}`)

    // Get user's platform credentials
    const { data: credentials, error: credError } = await supabaseClient
      .from('platform_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .eq('is_active', true)
      .single()

    if (credError || !credentials) {
      throw new Error(`No active ${platform} credentials found`)
    }

    // Publish to the specific platform
    let result
    if (platform === 'threads') {
      result = await publishToThreads(content, credentials.credentials)
    } else {
      throw new Error(`Platform ${platform} not supported`)
    }

    // Update the post status in database
    const { error: updateError } = await supabaseClient
      .from('scheduled_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        platform_post_id: result.postId,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)

    if (updateError) {
      console.error('Failed to update post status:', updateError)
      // Don't fail the request if DB update fails, the post was published
    }

    // Clean up media files after successful post
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      try {
        await cleanupPostMedia(content.mediaUrls, user.id, supabaseClient)
        console.log('✅ Media cleanup completed')
      } catch (cleanupError) {
        console.warn('⚠️ Media cleanup failed:', cleanupError)
        // Don't fail the request if cleanup fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        postId: result.postId,
        message: 'Post published successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error publishing post:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function publishToThreads(content: any, credentials: any) {
  const { accessToken, userId } = credentials

  // Check publishing quota first
  await checkThreadsPublishingQuota(accessToken, userId)
  
  // Validate user ID by calling /me endpoint
  const meResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`)
  
  if (!meResponse.ok) {
    throw new Error('Invalid access token')
  }

  const userData = await meResponse.json()
  const actualUserId = userData.id

  // Use the verified user ID
  const verifiedUserId = actualUserId

  // Upload media to Threads first if present
  let mediaIds: string[] = []
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    for (const mediaUrl of content.mediaUrls) {
      const mediaId = await uploadMediaToThreads(mediaUrl, accessToken, verifiedUserId)
      mediaIds.push(mediaId)
    }
  }

  // Create the post
  const postParams = new URLSearchParams({
    media_type: mediaIds.length > 0 ? 'IMAGE' : 'TEXT',
    text: content.text,
    access_token: accessToken
  })

  // Add media IDs if present
  if (mediaIds.length > 0) {
    postParams.append('media_ids', mediaIds.join(','))
  }

  console.log('🔍 Threads API Request:', {
    url: `https://graph.threads.net/v1.0/${verifiedUserId}/threads`,
    params: Object.fromEntries(postParams.entries())
  })

  // Retry logic for 500 errors (server issues)
  let createResponse: Response | null = null
  let lastError: string = ''
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`📡 Create attempt ${attempt}/${maxRetries}...`)
    
    createResponse = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postParams
    })

    console.log('📡 Threads API Response:', {
      attempt,
      status: createResponse.status,
      statusText: createResponse.statusText
    })

    if (createResponse.ok) {
      break // Success, exit retry loop
    }

    // Get error details
    let errorBody = ''
    try {
      errorBody = await createResponse.text()
      console.error(`❌ Create attempt ${attempt} failed:`, errorBody)
      lastError = errorBody
    } catch (e) {
      console.error('❌ Could not read error response body')
      lastError = `${createResponse.status} ${createResponse.statusText}`
    }

    // If it's a 500 error and we have retries left, wait and try again
    if (createResponse.status === 500 && attempt < maxRetries) {
      const delay = attempt * 2000 // 2s, 4s delays
      console.log(`⏳ Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    } else {
      break // Don't retry for other errors or if out of retries
    }
  }

  if (!createResponse || !createResponse.ok) {
    throw new Error(`Post creation failed after ${maxRetries} attempts: ${createResponse?.status} ${createResponse?.statusText}. Last response: ${lastError}`)
  }

  const createResult = await createResponse.json()
  
  if (createResult.error) {
    throw new Error(`Threads API error: ${createResult.error.message}`)
  }

  console.log('✅ Post created:', createResult.id)

  // Publish the post
  const publishParams = new URLSearchParams({
    creation_id: createResult.id,
    access_token: accessToken
  })

  console.log('📡 Publishing Threads post...')
  const publishResponse = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads_publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: publishParams
  })

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text()
    console.error('❌ Threads publish error:', errorText)
    throw new Error(`Failed to publish post: ${publishResponse.status} ${errorText}`)
  }

  const publishResult = await publishResponse.json()
  
  if (publishResult.error) {
    throw new Error(`Threads publish error: ${publishResult.error.message}`)
  }

  console.log('✅ Post published:', publishResult.id)

  return {
    postId: publishResult.id,
    creationId: createResult.id,
    permalink: publishResult.permalink
  }
}

async function uploadMediaToThreads(mediaUrl: string, accessToken: string, userId: string): Promise<string> {
  console.log('📤 Uploading media to Threads:', mediaUrl, 'for user:', userId)
  
  const uploadParams = new URLSearchParams({
    media_type: 'IMAGE',
    image_url: mediaUrl,
    access_token: accessToken
  })

  const response = await fetch(`https://graph.threads.net/v1.0/${userId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: uploadParams
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Threads media upload error:', errorText)
    throw new Error(`Failed to upload media to Threads: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  
  if (result.error) {
    throw new Error(`Threads media upload error: ${result.error.message}`)
  }

  console.log('✅ Media uploaded to Threads:', result.id)
  return result.id
}

async function cleanupPostMedia(mediaUrls: string[], userId: string, supabaseClient: any): Promise<void> {
  console.log('🧹 Starting media cleanup for:', mediaUrls)
  
  for (const mediaUrl of mediaUrls) {
    try {
      // Extract file path from Supabase URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/media-files/[user-id]/[filename]
      const urlParts = mediaUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      const filePath = `${userId}/${filename}`
      
      console.log('🗑️ Deleting media file:', filePath)
      
      // Delete from storage
      const { error: storageError } = await supabaseClient.storage
        .from('media-files')
        .remove([filePath])
      
      if (storageError) {
        console.warn('Failed to delete from storage:', storageError)
      }
      
      // Delete thumbnail if exists
      const thumbnailPath = `${userId}/thumb_${filename}`
      const { error: thumbError } = await supabaseClient.storage
        .from('thumbnails')
        .remove([thumbnailPath])
      
      if (thumbError) {
        console.warn('Failed to delete thumbnail:', thumbError)
      }
      
      // Delete database record
      const { error: dbError } = await supabaseClient
        .from('media_files')
        .delete()
        .eq('file_path', filePath)
        .eq('user_id', userId)
      
      if (dbError) {
        console.warn('Failed to delete database record:', dbError)
      }
      
    } catch (error) {
      console.warn('Failed to cleanup media file:', mediaUrl, error)
    }
  }
}

async function checkThreadsPublishingQuota(accessToken: string, userId: string): Promise<void> {
  try {
    const response = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publishing_limit?access_token=${accessToken}`)
    
    if (response.ok) {
      const quotaData = await response.json()
      console.log('📊 Threads Publishing Quota:', quotaData)
      
      if (quotaData.data && quotaData.data[0] && quotaData.data[0].quota_usage >= 250) {
        throw new Error('Threads publishing quota exceeded. Please wait before posting again.')
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not check publishing quota:', error)
    // Don't fail the post if quota check fails
  }
}