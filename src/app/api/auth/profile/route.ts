import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/middleware/auth'
import { createServerSupabaseClient } from '@/services/supabase-server'
import { ErrorCode } from '@/types'

export const PUT = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { timezone, fullName } = body

    const supabase = createServerSupabaseClient()

    // Update user metadata if fullName is provided
    if (fullName !== undefined) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        user.id,
        {
          user_metadata: {
            ...user.user_metadata,
            full_name: fullName
          }
        }
      )

      if (authError) {
        console.error('Error updating user metadata:', authError)
        return NextResponse.json({
          success: false,
          error: {
            code: ErrorCode.DATABASE_ERROR,
            message: 'Failed to update user profile',
            statusCode: 500,
            timestamp: new Date().toISOString()
          }
        }, { status: 500 })
      }
    }

    // Update or create user profile in database
    const profileData: any = {
      id: user.id,
      updated_at: new Date().toISOString()
    }

    if (timezone !== undefined) {
      profileData.timezone = timezone
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(profileData)
      .select()
      .single()

    if (error) {
      console.error('Error updating user profile:', error)
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.DATABASE_ERROR,
          message: 'Failed to update user profile',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          timezone: profile.timezone,
          createdAt: new Date(profile.created_at),
          updatedAt: new Date(profile.updated_at)
        }
      },
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in /api/auth/profile:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to update profile',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
})