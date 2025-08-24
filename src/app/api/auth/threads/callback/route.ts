import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * Threads OAuth Callback Handler
 * Handles the OAuth redirect after user authorizes the app
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      console.error('Threads OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        new URL(`/settings/platforms?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`, request.url)
      )
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing required OAuth parameters:', { code: !!code, state: !!state })
      return NextResponse.redirect(
        new URL('/settings/platforms?error=invalid_request&description=Missing required parameters', request.url)
      )
    }

    // TODO: Validate state parameter against stored value to prevent CSRF attacks
    // This should match the state you generated when initiating the OAuth flow

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.THREADS_CLIENT_ID!,
        client_secret: process.env.THREADS_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/threads/callback`,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Failed to exchange code for token:', errorData)
      return NextResponse.redirect(
        new URL('/settings/platforms?error=token_exchange_failed&description=Failed to get access token', request.url)
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, user_id } = tokenData

    if (!access_token || !user_id) {
      console.error('Invalid token response:', tokenData)
      return NextResponse.redirect(
        new URL('/settings/platforms?error=invalid_token&description=Invalid token response', request.url)
      )
    }

    // Get user profile information
    const profileResponse = await fetch(`https://graph.threads.net/v1.0/${user_id}?fields=id,username,name,threads_profile_picture_url&access_token=${access_token}`)
    
    let profileData = null
    if (profileResponse.ok) {
      profileData = await profileResponse.json()
    }

    // TODO: Store the access token and user information securely
    // This should be stored in your database associated with the current user
    console.log('Threads OAuth successful:', {
      user_id,
      access_token: access_token.substring(0, 10) + '...',
      profile: profileData
    })

    // For now, we'll store in a cookie (not recommended for production)
    const response = NextResponse.redirect(
      new URL('/settings/platforms?success=threads_connected', request.url)
    )

    // Set secure cookies with the token data
    response.cookies.set('threads_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 60 // 60 days
    })

    response.cookies.set('threads_user_id', user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 60 // 60 days
    })

    if (profileData) {
      response.cookies.set('threads_profile', JSON.stringify(profileData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 60 // 60 days
      })
    }

    return response

  } catch (error) {
    console.error('Threads OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/settings/platforms?error=callback_error&description=Internal server error', request.url)
    )
  }
}