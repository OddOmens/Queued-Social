/**
 * /api/posts/[id]
 * Individual post operations (GET, PUT, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase'
import { db } from '@/services/database'
import {
  validateRequestBody,
  validatePostContent,
  validatePlatform,
  validateAndParseDate,
  validateFutureDate,
  createErrorResponse,
  createSuccessResponse,
  combineValidationResults
} from '@/utils/apiValidation'
import type { 
  UpdatePostRequest,
  ApiResponse, 
  ScheduledPost, 
  ErrorCode,
  PostStatus
} from '@/types'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * GET /api/posts/[id]
 * Get a specific scheduled post
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Get authenticated user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'UNAUTHORIZED' as any,
          message: 'Authentication required',
          timestamp: new Date()
        }
      }, { status: 401 })
    }

    const { id } = params

    // Validate post ID format (basic UUID validation)
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid post ID format'),
        { status: 400 }
      )
    }

    // Get the post
    const post = await db.getScheduledPostById(id, user.id)

    if (!post) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('RECORD_NOT_FOUND' as ErrorCode, 'Post not found'),
        { status: 404 }
      )
    }

    return NextResponse.json<ApiResponse<ScheduledPost>>(
      createSuccessResponse(post, 'Post retrieved successfully')
    )

  } catch (error) {
    console.error('Error in GET /api/posts/[id]:', error)
    
    return NextResponse.json<ApiResponse>(
      createErrorResponse('INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred'),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/posts/[id]
 * Update a scheduled post
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Get authenticated user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'UNAUTHORIZED' as any,
          message: 'Authentication required',
          timestamp: new Date()
        }
      }, { status: 401 })
    }

    const { id } = params

    // Validate post ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid post ID format'),
        { status: 400 }
      )
    }

    // Check if post exists and belongs to user
    const existingPost = await db.getScheduledPostById(id, user.id)
    if (!existingPost) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('RECORD_NOT_FOUND' as ErrorCode, 'Post not found'),
        { status: 404 }
      )
    }

    // Check if post can be updated (not already published)
    if (existingPost.status === 'published') {
      return NextResponse.json<ApiResponse>(
        createErrorResponse(
          'VALIDATION_ERROR' as ErrorCode, 
          'Cannot update a post that has already been published'
        ),
        { status: 400 }
      )
    }

    // Parse request body
    let body: UpdatePostRequest
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    // Validate that at least one field is being updated
    if (!body.content && !body.scheduledTime && !body.status) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse(
          'VALIDATION_ERROR' as ErrorCode,
          'At least one field (content, scheduledTime, or status) must be provided for update'
        ),
        { status: 400 }
      )
    }

    // Validate content if provided
    if (body.content) {
      const contentValidation = validatePostContent(body.content as any)
      if (!contentValidation.isValid) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            contentValidation.errors.map(e => e.message).join(', ')
          ),
          { status: 400 }
        )
      }
    }

    // Validate scheduled time if provided
    let parsedScheduledTime: Date | undefined
    if (body.scheduledTime) {
      const scheduledTimeValidation = validateAndParseDate(body.scheduledTime.toISOString(), 'scheduledTime')
      if (!scheduledTimeValidation.isValid) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            scheduledTimeValidation.errors.map(e => e.message).join(', ')
          ),
          { status: 400 }
        )
      }

      parsedScheduledTime = scheduledTimeValidation.date!

      // Only validate future date if status is still scheduled
      if (existingPost.status === 'scheduled') {
        const futureValidation = validateFutureDate(parsedScheduledTime, 'scheduledTime')
        if (!futureValidation.isValid) {
          return NextResponse.json<ApiResponse>(
            createErrorResponse(
              'VALIDATION_ERROR' as ErrorCode,
              futureValidation.errors.map(e => e.message).join(', ')
            ),
            { status: 400 }
          )
        }
      }
    }

    // Validate status if provided
    if (body.status && !['scheduled', 'published', 'failed', 'cancelled'].includes(body.status)) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid status value'),
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: Partial<ScheduledPost> = {}
    if (body.content) updateData.content = body.content as any
    if (parsedScheduledTime) updateData.scheduledTime = parsedScheduledTime
    if (body.status) updateData.status = body.status

    // Update the post
    const updatedPost = await db.updateScheduledPost(id, updateData)

    return NextResponse.json<ApiResponse<ScheduledPost>>(
      createSuccessResponse(updatedPost, 'Post updated successfully')
    )

  } catch (error) {
    console.error('Error in PUT /api/posts/[id]:', error)
    
    return NextResponse.json<ApiResponse>(
      createErrorResponse('INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/posts/[id]
 * Delete a scheduled post
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Get authenticated user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'UNAUTHORIZED' as any,
          message: 'Authentication required',
          timestamp: new Date()
        }
      }, { status: 401 })
    }

    const { id } = params

    // Validate post ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid post ID format'),
        { status: 400 }
      )
    }

    // Check if post exists and belongs to user
    const existingPost = await db.getScheduledPostById(id, user.id)
    if (!existingPost) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('RECORD_NOT_FOUND' as ErrorCode, 'Post not found'),
        { status: 404 }
      )
    }

    // Check query parameter for confirmation
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get('confirm')

    if (confirm !== 'true') {
      return NextResponse.json<ApiResponse>(
        createErrorResponse(
          'VALIDATION_ERROR' as ErrorCode,
          'Deletion requires confirmation. Add ?confirm=true to the request URL.'
        ),
        { status: 400 }
      )
    }

    // Delete the post
    await db.deleteScheduledPost(id)

    return NextResponse.json<ApiResponse<{ id: string }>>(
      createSuccessResponse({ id }, 'Post deleted successfully')
    )

  } catch (error) {
    console.error('Error in DELETE /api/posts/[id]:', error)
    
    return NextResponse.json<ApiResponse>(
      createErrorResponse('INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred'),
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed. Use POST /api/posts to create new posts.'),
    { status: 405 }
  )
}