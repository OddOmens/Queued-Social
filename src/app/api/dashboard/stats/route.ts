/**
 * /api/dashboard/stats
 * Dashboard statistics endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { createDbService } from '@/services/database'
import {
  createErrorResponse,
  createSuccessResponse
} from '@/utils/apiValidation'
import type { 
  ApiResponse, 
  ErrorCode
} from '@/types'

interface DashboardStats {
  totalPosts: number
  scheduledToday: number
  publishedThisWeek: number
  connectedPlatforms: number
}

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
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

    const db = createDbService()
    
    // Get current date boundaries
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
    
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)

    // Fetch statistics in parallel
    const [
      totalPosts,
      scheduledToday,
      publishedThisWeek,
      // For now, we'll hardcode connected platforms since we don't have platform credentials implemented yet
    ] = await Promise.all([
      // Total posts count
      db.getScheduledPostsCount(user.id, {}),
      
      // Posts scheduled for today
      db.getScheduledPostsCount(user.id, {
        status: 'scheduled',
        startDate: startOfToday,
        endDate: endOfToday
      }),
      
      // Posts published this week
      db.getScheduledPostsCount(user.id, {
        status: 'published',
        startDate: startOfWeek,
        endDate: endOfWeek
      })
    ])

    const stats: DashboardStats = {
      totalPosts,
      scheduledToday,
      publishedThisWeek,
      connectedPlatforms: 0 // TODO: Implement platform credentials counting
    }

    return NextResponse.json<ApiResponse<DashboardStats>>(
      createSuccessResponse(stats, 'Dashboard statistics retrieved successfully')
    )

  } catch (error) {
    console.error('Error in GET /api/dashboard/stats:', error)
    
    return NextResponse.json<ApiResponse>(
      createErrorResponse('INTERNAL_SERVER_ERROR' as ErrorCode, 'An unexpected error occurred'),
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed'),
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed'),
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json<ApiResponse>(
    createErrorResponse('VALIDATION_ERROR' as ErrorCode, 'Method not allowed'),
    { status: 405 }
  )
}