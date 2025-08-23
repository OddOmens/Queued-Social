import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { validateMediaFile, uploadMediaToStorage, createMediaRecord } from '@/services/mediaStorage'
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

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const platform = formData.get('platform') as string

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      )
    }

    const uploadResults = []
    const errors = []

    // Process each file
    for (const file of files) {
      try {
        // Validate file
        const validation = await validateMediaFile(file, platform)
        if (!validation.isValid) {
          errors.push({
            filename: file.name,
            errors: validation.errors
          })
          continue
        }

        // Upload to storage
        const uploadResult = await uploadMediaToStorage(file, user.id)
        
        // Create database record
        const mediaRecord = await createMediaRecord({
          userId: user.id,
          filename: uploadResult.filename,
          originalFilename: file.name,
          filePath: uploadResult.path,
          fileSize: file.size,
          mimeType: file.type,
          width: uploadResult.metadata?.width,
          height: uploadResult.metadata?.height,
          duration: uploadResult.metadata?.duration,
          thumbnailPath: uploadResult.thumbnailPath,
          storageBucket: uploadResult.bucket,
          metadata: uploadResult.metadata || {}
        })

        uploadResults.push({
          id: mediaRecord.id,
          filename: mediaRecord.filename,
          originalFilename: mediaRecord.original_filename,
          url: uploadResult.publicUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          fileSize: mediaRecord.file_size,
          mimeType: mediaRecord.mime_type,
          width: mediaRecord.width,
          height: mediaRecord.height,
          duration: mediaRecord.duration
        })
      } catch (error) {
        console.error('Error uploading file:', file.name, error)
        errors.push({
          filename: file.name,
          errors: ['Upload failed']
        })
      }
    }

    return NextResponse.json({
      success: true,
      uploads: uploadResults,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Media upload error:', error)
    return handleApiError(error)
  }
}

export async function GET(request: NextRequest) {
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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const mimeType = searchParams.get('mimeType')

    let query = supabase
      .from('media_files')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (mimeType) {
      query = query.like('mime_type', `${mimeType}%`)
    }

    const { data: mediaFiles, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      files: mediaFiles || [],
      pagination: {
        limit,
        offset,
        hasMore: (mediaFiles?.length || 0) === limit
      }
    })

  } catch (error) {
    console.error('Media fetch error:', error)
    return handleApiError(error)
  }
}