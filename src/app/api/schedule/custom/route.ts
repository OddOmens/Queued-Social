/**
 * POST /api/schedule/custom
 * Schedule a post to a custom time
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase'
import { schedulingService } from '@/services/scheduling'
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
import type { ScheduleCustomTimeRequest, ApiResponse, ScheduledPost, ErrorCode } from '@/types'

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
    let body: ScheduleCustomTimeRequest
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    // Validate request structure
    const bodyValidation = validateRequestBody(body, ['content', 'platform', 'scheduledTime'])
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

    // Validate and parse scheduled time
    const scheduledTimeValidation = validateAndParseDate(body.scheduledTime, 'scheduledTime')
    if (!scheduledTimeValidation.isValid) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse(
          'VALIDATION_ERROR' as ErrorCode,
          scheduledTimeValidation.errors.map(e => e.message).join(', ')
        ),
        { status: 400 }
      )
    }

    const scheduledTime = scheduledTimeValidation.date!

    // Validate that scheduled time is in the future
    const futureValidation = validateFutureDate(scheduledTime, 'scheduledTime')
    if (!futureValidation.isValid) {
      return NextResponse.json<ApiResponse>(
        createErrorResponse(
          'VALIDATION_ERROR' as ErrorCode,
          futureValidation.errors.map(e => e.message).join(', ')
        ),
        { status: 400 }
      )
    }

    // Schedule the post
    const result = await schedulingService.scheduleToCustomTime({
      userId: user.id,
      content: body.content,
      platform: body.platform,
      scheduledTime: scheduledTime,
      allowConflicts: body.allowConflicts || false
    })

    if (!result.success) {
      // Handle conflicts specifically
      if (result.error?.includes('Time slot conflict') && result.conflicts && result.suggestedTime) {
        return NextResponse.json<ApiResponse>(
          createErrorResponse(
            'SCHEDULING_CONFLICT' as ErrorCode,
            result.error,
            409,
            {
              conflicts: result.conflicts,
              suggestedTime: result.suggestedTime
            }
          ),
          { status: 409 }
        )
      }

      // Determine appropriate status code based on error type
      let statusCode = 500
      let errorCode: ErrorCode = 'SCHEDULING_ERROR' as ErrorCode
      
      if (result.error?.includes('validation failed')) {
        statusCode = 400 // Bad Request
        errorCode = 'VALIDATION_ERROR' as ErrorCode
      } else if (result.error?.includes('conflict')) {
        statusCode = 409 // Conflict
        errorCode = 'SCHEDULING_CONFLICT' as ErrorCode
      }

      return NextResponse.json<ApiResponse>(
        createErrorResponse(errorCode, result.error || 'Failed to schedule post'),
        { status: statusCode }
      )
    }

    // Include conflict information in successful response if conflicts were allowed
    let message = 'Post scheduled successfully to custom time'
    let warnings: string[] | undefined

    if (result.conflicts && result.conflicts.length > 0) {
      message += ' (conflicts detected but allowed)'
      warnings = [`${result.conflicts.length} conflicting post(s) detected`]
    }

    return NextResponse.json<ApiResponse<ScheduledPost>>(
      createSuccessResponse(result.scheduledPost!, message, warnings)
    )

  } catch (error) {
    console.error('Error in /api/schedule/custom:', error)
    
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