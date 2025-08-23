import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { ErrorCode } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('Error refreshing session:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.PLATFORM_AUTH_FAILED,
          message: 'Failed to refresh session',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 })
    }

    if (!data.session) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.PLATFORM_AUTH_FAILED,
          message: 'No active session to refresh',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
            emailVerified: data.session.user.email_confirmed_at ? new Date(data.session.user.email_confirmed_at) : null,
            createdAt: new Date(data.session.user.created_at || ''),
            updatedAt: new Date(data.session.user.updated_at || ''),
            metadata: data.session.user.user_metadata || {}
          }
        }
      },
      message: 'Session refreshed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in /api/auth/refresh:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}