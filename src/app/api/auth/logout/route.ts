import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { ErrorCode } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error signing out:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.PLATFORM_AUTH_FAILED,
          message: 'Failed to sign out',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully signed out',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in /api/auth/logout:', error)
    
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