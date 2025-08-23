/**
 * POST /api/schedule/next-slot
 * Schedule a post to the next available time slot
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { schedulingService } from '@/services/scheduling'
import {
  validateRequestBody,
  validatePostContent,
  validatePlatform,
  validateDateArray,
  validateAndParseDate,
  createErrorResponse,
  createSuccessResponse,
  combineValidationResults
} from '@/utils/apiValidation'
import type { ScheduleNextSlotRequest, ApiResponse, ScheduledPost, ErrorCode } from '@/types'

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
    let body: ScheduleNextSlotRequest
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    // Validate request structure
    const bodyValidation = validateRequestBody(body, ['content', 'platform'])
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

    // Validate optional date fields
    let startDate: Date | undefined
    let excludeDates: Date[] | undefined

    if (body.startDate) {
      const startDateValidation = validateAndParseDate(body.startDate, 'startDate')
      if (!startDateValidation.isValid) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            startDateValidation.errors.map(e => e.message).join(', ')
          ),
          { status: 400 }
        )
      }
      startDate = startDateValidation.date
    }

    if (body.excludeDates) {
      const excludeDatesValidation = validateDateArray(body.excludeDates, 'excludeDates')
      if (!excludeDatesValidation.isValid) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'VALIDATION_ERROR' as ErrorCode,
            excludeDatesValidation.errors.map(e => e.message).join(', ')
          ),
          { status: 400 }
        )
      }
      excludeDates = excludeDatesValidation.dates
    }

    // Schedule the post
    const result = await schedulingService.scheduleToNextSlot({
      userId: user.id,
      content: body.content,
      platform: body.platform,
      startDate,
      excludeDates
    })

    if (!result.success) {
      // Determine appropriate status code based on error type
      let statusCode = 500
      let errorCode: ErrorCode = 'SCHEDULING_ERROR' as ErrorCode
      
      if (result.error?.includes('No available time slots')) {
        statusCode = 409 // Conflict
        errorCode = 'NO_AVAILABLE_SLOTS' as ErrorCode
      } else if (result.error?.includes('validation failed')) {
        statusCode = 400 // Bad Request
        errorCode = 'VALIDATION_ERROR' as ErrorCode
      }

      return NextResponse.json<ApiResponse>(
        createErrorResponse(errorCode, result.error || 'Failed to schedule post'),
        { status: statusCode }
      )
    }

    return NextResponse.json<ApiResponse<ScheduledPost>>(
      createSuccessResponse(result.scheduledPost!, 'Post scheduled successfully to next available slot')
    )

  } catch (error) {
    console.error('Error in /api/schedule/next-slot:', error)
    
    return NextResponse.json<ApiResponse>(
      createErrorResponse('INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred'),
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed. Use POST to schedule posts.'),
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed. Use POST to schedule posts.'),
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed. Use POST to schedule posts.'),
    { status: 405 }
  )
}