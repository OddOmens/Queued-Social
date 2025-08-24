/**
 * /api/posts
 * CRUD operations for scheduled posts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { createDbService } from '@/services/database'
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
  CreatePostRequest, 
  GetPostsQuery,
  ApiResponse, 
  PaginatedResponse,
  ScheduledPost, 
  ErrorCode,
  Platform,
  PostStatus
} from '@/types'

/**
 * POST /api/posts
 * Create a new scheduled post
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    let body: CreatePostRequest
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    // Validate request structure
    const bodyValidation = validateRequestBody(body, ['content', 'platform', 'schedulingType'])
    if (!bodyValidation.isValid) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse(
          'VALIDATION_ERROR' as ErrorCode,
          bodyValidation.errors.map(e => e.message).join(', ')
        ),
        { status: 400 }
      )
    }

    // Validate content and platform
    const contentValidation = validatePostContent(body.content)
    const platformValidation = validatePlatform(body.platform)
    
    const combinedValidation = combineValidationResults(contentValidation, platformValidation)
    if (!combinedValidation.isValid) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse(
          'VALIDATION_ERROR' as ErrorCode,
          combinedValidation.errors.map(e => e.message).join(', ')
        ),
        { status: 400 }
      )
    }

    // Validate scheduling type and custom time if provided
    let customTimeValidation: any = null
    if (body.schedulingType === 'custom') {
      if (!body.customTime) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            'customTime is required when schedulingType is "custom"'
          ),
          { status: 400 }
        )
      }

      customTimeValidation = validateAndParseDate(body.customTime, 'customTime')
      if (!customTimeValidation.isValid) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            customTimeValidation.errors.map((e: any) => e.message).join(', ')
          ),
          { status: 400 }
        )
      }

      const futureValidation = validateFutureDate(customTimeValidation.date!, 'customTime')
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

    // Create the scheduled post
    const scheduledTime = body.schedulingType === 'custom' 
      ? customTimeValidation.date! 
      : new Date() // This would be replaced by next slot logic in a real implementation

    const db = createDbService()
    const newPost = await db.createScheduledPost({
      userId: user.id,
      platform: body.platform,
      content: body.content,
      scheduledTime,
      status: 'scheduled'
    })

    return NextResponse.json<ApiResponse<ScheduledPost>>(
      createSuccessResponse(newPost, 'Post created successfully')
    )

  } catch (error) {
    console.error('Error in POST /api/posts:', error)
    
    return NextResponse.json<ApiResponse>(
      createErrorResponse('INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred'),
      { status: 500 }
    )
  }
}

/**
 * GET /api/posts
 * Get scheduled posts with filtering and pagination
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 items per page
    const platform = searchParams.get('platform') as Platform | null
    const status = searchParams.get('status') as PostStatus | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sortBy = searchParams.get('sortBy') || 'scheduledTime'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Validate pagination parameters
    if (page < 1) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Page must be greater than 0'),
        { status: 400 }
      )
    }

    if (limit < 1) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Limit must be greater than 0'),
        { status: 400 }
      )
    }

    // Validate platform if provided
    if (platform && !['threads', 'twitter', 'instagram', 'linkedin'].includes(platform)) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid platform'),
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status && !['scheduled', 'published', 'failed', 'cancelled'].includes(status)) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid status'),
        { status: 400 }
      )
    }

    // Parse and validate dates
    let parsedStartDate: Date | undefined
    let parsedEndDate: Date | undefined

    if (startDate) {
      const startDateValidation = validateAndParseDate(startDate, 'startDate')
      if (!startDateValidation.isValid) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            startDateValidation.errors.map(e => e.message).join(', ')
          ),
          { status: 400 }
        )
      }
      parsedStartDate = startDateValidation.date
    }

    if (endDate) {
      const endDateValidation = validateAndParseDate(endDate, 'endDate')
      if (!endDateValidation.isValid) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            endDateValidation.errors.map(e => e.message).join(', ')
          ),
          { status: 400 }
        )
      }
      parsedEndDate = endDateValidation.date
    }

    // Validate date range
    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'startDate must be before endDate'),
        { status: 400 }
      )
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Get posts with filters
    const filters = {
      ...(platform && { platform }),
      ...(status && { status }),
      ...(parsedStartDate && { startDate: parsedStartDate }),
      ...(parsedEndDate && { endDate: parsedEndDate }),
      limit,
      offset
    }

    const db = createDbService()
    const [posts, totalCount] = await Promise.all([
      db.getScheduledPosts(user.id, filters),
      db.getScheduledPostsCount(user.id, {
        ...(platform && { platform }),
        ...(status && { status }),
        ...(parsedStartDate && { startDate: parsedStartDate }),
        ...(parsedEndDate && { endDate: parsedEndDate })
      })
    ])

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    const response: PaginatedResponse<ScheduledPost> = {
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext,
        hasPrev
      },
      message: `Retrieved ${posts.length} posts`
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in GET /api/posts:', error)
    
    return NextResponse.json<ApiResponse>(
      createErrorResponse('INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred'),
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function PUT() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed. Use PUT /api/posts/[id] to update a specific post.'),
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed. Use DELETE /api/posts/[id] to delete a specific post.'),
    { status: 405 }
  )
}