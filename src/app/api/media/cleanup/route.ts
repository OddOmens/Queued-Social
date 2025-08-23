import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { cleanupOrphanedFiles } from '@/services/mediaStorage'
import { handleApiError } from '@/utils/serverErrors'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Run cleanup for the user
    await cleanupOrphanedFiles(user.id)

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully'
    })

  } catch (error) {
    console.error('Media cleanup error:', error)
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const olderThan = searchParams.get('olderThan') // ISO date string
    const unused = searchParams.get('unused') === 'true'

    let query = supabase
      .from('media_files')
      .select('id, file_path, thumbnail_path, storage_bucket')
      .eq('user_id', user.id)

    // Filter by date if provided
    if (olderThan) {
      query = query.lt('created_at', olderThan)
    }

    // If unused flag is set, find files not referenced in any posts
    if (unused) {
      // This would require a more complex query to check if media files
      // are referenced in scheduled_posts.content JSONB field
      // For now, we'll just delete files older than the specified date
    }

    const { data: filesToDelete, error: fetchError } = await query

    if (fetchError) {
      throw fetchError
    }

    if (!filesToDelete || filesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No files to delete',
        deletedCount: 0
      })
    }

    // Delete files from storage
    const mediaFilePaths = filesToDelete.map(f => f.file_path)
    const thumbnailPaths = filesToDelete
      .filter(f => f.thumbnail_path)
      .map(f => f.thumbnail_path)

    // Delete main files
    if (mediaFilePaths.length > 0) {
      const { error: mediaDeleteError } = await supabase.storage
        .from('media-files')
        .remove(mediaFilePaths)

      if (mediaDeleteError) {
        console.warn('Failed to delete some media files:', mediaDeleteError)
      }
    }

    // Delete thumbnails
    if (thumbnailPaths.length > 0) {
      const { error: thumbDeleteError } = await supabase.storage
        .from('thumbnails')
        .remove(thumbnailPaths)

      if (thumbDeleteError) {
        console.warn('Failed to delete some thumbnails:', thumbDeleteError)
      }
    }

    // Delete database records
    const fileIds = filesToDelete.map(f => f.id)
    const { error: dbDeleteError } = await supabase
      .from('media_files')
      .delete()
      .in('id', fileIds)

    if (dbDeleteError) {
      throw dbDeleteError
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${filesToDelete.length} files`,
      deletedCount: filesToDelete.length
    })

  } catch (error) {
    console.error('Media bulk delete error:', error)
    return handleApiError(error)
  }
}