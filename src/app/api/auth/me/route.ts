import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/middleware/auth'
import { createServerSupabaseClient } from '@/services/supabase'

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get user profile from database
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching user profile:', error)
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
          createdAt: new Date(user.created_at || ''),
          updatedAt: new Date(user.updated_at || ''),
          metadata: user.user_metadata || {},
          profile: profile || null
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user data',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
})