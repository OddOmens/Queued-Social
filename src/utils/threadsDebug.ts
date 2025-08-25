// Debug utility for Threads API issues

export function debugThreadsEnvironment() {
  const env = {
    VITE_THREADS_CLIENT_ID: import.meta.env.VITE_THREADS_CLIENT_ID,
    VITE_THREADS_CLIENT_SECRET: import.meta.env.VITE_THREADS_CLIENT_SECRET,
  }

  console.log('🔍 Threads Environment Debug:', {
    ...env,
    VITE_THREADS_CLIENT_SECRET: env.VITE_THREADS_CLIENT_SECRET ? `${env.VITE_THREADS_CLIENT_SECRET.substring(0, 8)}...` : undefined,
  })

  return env
}

export async function testThreadsTokenExchange(code: string) {
  const env = debugThreadsEnvironment()
  
  const clientId = env.VITE_THREADS_CLIENT_ID
  const clientSecret = env.VITE_THREADS_CLIENT_SECRET
  const redirectUri = `${window.location.origin}/auth/threads/callback`

  if (!clientId) {
    throw new Error('❌ Client ID not found in environment')
  }

  if (!clientSecret) {
    throw new Error('❌ Client Secret not found in environment')
  }

  const requestBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: code
  })

  console.log('🚀 Token Exchange Request:', {
    url: 'https://graph.threads.net/oauth/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    clientId: clientId,
    clientIdLength: clientId?.length || 0,
    clientSecret: clientSecret ? `${clientSecret.substring(0, 8)}...` : 'MISSING',
    clientSecretLength: clientSecret?.length || 0,
    redirectUri: redirectUri,
    codeLength: code.length,
    body: Object.fromEntries(requestBody.entries()),
    bodyString: requestBody.toString(),
    hasAllRequiredFields: !!(clientId && clientSecret && code && redirectUri)
  })

  try {
    const response = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    })

    const responseText = await response.text()
    
    console.log('📥 Token Exchange Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    })

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseData,
      raw: responseText
    }
  } catch (error) {
    console.error('💥 Token Exchange Error:', error)
    throw error
  }
}

// Test function to manually trigger token exchange
export function createTestTokenExchange() {
  return {
    test: testThreadsTokenExchange,
    debug: debugThreadsEnvironment
  }
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).threadsDebug = createTestTokenExchange()
}