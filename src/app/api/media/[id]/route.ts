import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase'
import { deleteMediaFile } from '@/services/mediaStorage'
import { handleApiError } from '@/utils/serverErrors'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { data: mediaFile, error } = await supabase
      .from('media_files')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Media file not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      file: mediaFile
    })

  } catch (error) {
    console.error('Media fetch error:', error)
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Get media file details first
    const { data: mediaFile, error: fetchError } = await supabase
      .from('media_files')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Media file not found' },
          { status: 404 }
        )
      }
      throw fetchError
    }

    // Delete from storage and database
    await deleteMediaFile(mediaFile.id, user.id)

    return NextResponse.json({
      success: true,
      message: 'Media file deleted successfully'
    })

  } catch (error) {
    console.error('Media delete error:', error)
    return handleApiError(error)
  }
}