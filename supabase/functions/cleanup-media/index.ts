import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🧹 Starting media cleanup process')

    let totalCleaned = 0
    let errors: string[] = []

    // 1. Clean up failed posts older than 24 hours
    const failedPostsResult = await cleanupFailedPostMedia(supabaseClient)
    totalCleaned += failedPostsResult.cleaned
    errors.push(...failedPostsResult.errors)

    // 2. Clean up orphaned media files older than 7 days
    const orphanedResult = await cleanupOrphanedMedia(supabaseClient)
    totalCleaned += orphanedResult.cleaned
    errors.push(...orphanedResult.errors)

    console.log(`✅ Media cleanup completed. Total files cleaned: ${totalCleaned}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalCleaned,
        errors: errors.length > 0 ? errors : undefined,
        message: `Cleaned up ${totalCleaned} media files` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in media cleanup:', error)
    
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

async function cleanupFailedPostMedia(supabaseClient: any): Promise<{ cleaned: number; errors: string[] }> {
  console.log('🗑️ Cleaning up media from failed posts older than 24 hours')
  
  let cleaned = 0
  const errors: string[] = []

  try {
    // Get failed posts older than 24 hours with media
    const { data: failedPosts, error: fetchError } = await supabaseClient
      .from('scheduled_posts')
      .select('id, user_id, content, updated_at')
      .eq('status', 'failed')
      .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('content->mediaUrls', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch failed posts: ${fetchError.message}`)
    }

    console.log(`Found ${failedPosts?.length || 0} failed posts with media to clean up`)

    for (const post of failedPosts || []) {
      try {
        const mediaUrls = post.content?.mediaUrls || []
        
        for (const mediaUrl of mediaUrls) {
          try {
            await cleanupMediaFile(mediaUrl, post.user_id, supabaseClient)
            cleaned++
          } catch (error) {
            errors.push(`Failed to cleanup ${mediaUrl}: ${error.message}`)
          }
        }

        // Remove media URLs from the post content
        const updatedContent = { ...post.content }
        delete updatedContent.mediaUrls

        await supabaseClient
          .from('scheduled_posts')
          .update({ 
            content: updatedContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)

      } catch (error) {
        errors.push(`Failed to process failed post ${post.id}: ${error.message}`)
      }
    }

  } catch (error) {
    errors.push(`Failed to cleanup failed post media: ${error.message}`)
  }

  return { cleaned, errors }
}

async function cleanupOrphanedMedia(supabaseClient: any): Promise<{ cleaned: number; errors: string[] }> {
  console.log('🗑️ Cleaning up orphaned media files older than 7 days')
  
  let cleaned = 0
  const errors: string[] = []

  try {
    // Get media files older than 7 days
    const { data: mediaFiles, error: fetchError } = await supabaseClient
      .from('media_files')
      .select('id, user_id, file_path, filename, thumbnail_path, created_at')
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch media files: ${fetchError.message}`)
    }

    console.log(`Found ${mediaFiles?.length || 0} old media files to check`)

    for (const mediaFile of mediaFiles || []) {
      try {
        // Check if this media file is still referenced by any post
        const { data: referencingPosts, error: refError } = await supabaseClient
          .from('scheduled_posts')
          .select('id')
          .eq('user_id', mediaFile.user_id)
          .like('content->mediaUrls', `%${mediaFile.filename}%`)
          .limit(1)

        if (refError) {
          errors.push(`Failed to check references for ${mediaFile.filename}: ${refError.message}`)
          continue
        }

        // If no posts reference this media file, clean it up
        if (!referencingPosts || referencingPosts.length === 0) {
          console.log(`Cleaning up orphaned media file: ${mediaFile.file_path}`)
          
          // Delete from storage
          const { error: storageError } = await supabaseClient.storage
            .from('media-files')
            .remove([mediaFile.file_path])

          if (storageError) {
            errors.push(`Failed to delete storage file ${mediaFile.file_path}: ${storageError.message}`)
          }

          // Delete thumbnail if exists
          if (mediaFile.thumbnail_path) {
            const { error: thumbError } = await supabaseClient.storage
              .from('thumbnails')
              .remove([mediaFile.thumbnail_path])

            if (thumbError) {
              errors.push(`Failed to delete thumbnail ${mediaFile.thumbnail_path}: ${thumbError.message}`)
            }
          }

          // Delete database record
          const { error: dbError } = await supabaseClient
            .from('media_files')
            .delete()
            .eq('id', mediaFile.id)

          if (dbError) {
            errors.push(`Failed to delete media record ${mediaFile.id}: ${dbError.message}`)
          } else {
            cleaned++
          }
        }

      } catch (error) {
        errors.push(`Failed to process media file ${mediaFile.id}: ${error.message}`)
      }
    }

  } catch (error) {
    errors.push(`Failed to cleanup orphaned media: ${error.message}`)
  }

  return { cleaned, errors }
}

async function cleanupMediaFile(mediaUrl: string, userId: string, supabaseClient: any): Promise<void> {
  // Extract filename from Supabase URL
  const urlParts = mediaUrl.split('/')
  const filename = urlParts[urlParts.length - 1]
  const filePath = `${userId}/${filename}`
  
  console.log(`🗑️ Cleaning up media file: ${filePath}`)
  
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
    console.warn('Failed to delete media database record:', dbError)
  }
}