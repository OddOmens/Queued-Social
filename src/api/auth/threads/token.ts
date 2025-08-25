// API route for Threads token exchange
// This would typically be implemented in your backend framework

export async function POST(request: Request) {
  try {
    const { code } = await request.json()
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get environment variables
    const clientId = process.env.THREADS_CLIENT_ID
    const clientSecret = process.env.THREADS_CLIENT_SECRET
    const redirectUri = `${process.env.APP_URL}/auth/threads/callback`

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Threads API credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Exchange code for access token
    const response = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Threads token exchange failed:', data)
      return new Response(
        JSON.stringify({ 
          error: data.error || 'Token exchange failed',
          message: data.error_description || 'Failed to exchange authorization code'
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Threads token exchange error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}