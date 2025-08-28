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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
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
  await checkThreadsPublishingQuota(accessToken)
  
  // Validate user ID by calling /me endpoint
  const meResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`)
  
  if (!meResponse.ok) {
    throw new Error('Invalid access token')
  }

  const userData = await meResponse.json()
  const actualUserId = userData.id

  // Use the verified user ID
  const verifiedUserId = actualUserId

  // Create the post
  const postParams = new URLSearchParams({
    media_type: content.mediaUrls && content.mediaUrls.length > 0 ? 'IMAGE' : 'TEXT',
    text: content.text,
    access_token: accessToken
  })

  // Add media IDs if present
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    postParams.append('media_ids', content.mediaUrls.join(','))
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

async function checkThreadsPublishingQuota(accessToken: string): Promise<void> {
  try {
    const response = await fetch(`https://graph.threads.net/v1.0/me/threads_publishing_limit?access_token=${accessToken}`)
    
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