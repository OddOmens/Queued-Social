import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * Threads OAuth Authorization Initiation
 * Redirects user to Threads authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Generate a random state parameter for CSRF protection
    const state = randomBytes(32).toString('hex')
    
    // TODO: Store the state parameter in session/database to validate later
    // For now, we'll use a cookie (not ideal for production)
    
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/auth/threads/callback`
    
    // Threads OAuth authorization URL
    const authUrl = new URL('https://threads.net/oauth/authorize')
    authUrl.searchParams.set('client_id', process.env.THREADS_CLIENT_ID!)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'threads_basic,threads_content_publish')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    // Create response with redirect
    const response = NextResponse.redirect(authUrl.toString())
    
    // Store state in cookie for validation
    response.cookies.set('threads_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    })

    return response

  } catch (error) {
    console.error('Error initiating Threads OAuth:', error)
    return NextResponse.redirect(
      new URL('/settings/platforms?error=auth_init_failed', request.url)
    )
  }
}