import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { createDbService } from '@/services/database'

export function ThreadsCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (error) {
          throw new Error(errorDescription || `OAuth error: ${error}`)
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        if (!user?.id) {
          throw new Error('User not authenticated')
        }

        // Exchange code for access token directly with Threads API
        // Note: In production, this should be done server-side to protect client_secret
        const clientId = import.meta.env.VITE_THREADS_CLIENT_ID || import.meta.env.THREADS_CLIENT_ID
        const clientSecret = import.meta.env.VITE_THREADS_CLIENT_SECRET || import.meta.env.THREADS_CLIENT_SECRET
        const redirectUri = `${window.location.origin}/auth/threads/callback`

        if (!clientId || !clientSecret) {
          throw new Error('Threads API credentials not configured')
        }

        console.log('Exchanging code for token...', { clientId, redirectUri, codeLength: code.length })

        const tokenResponse = await fetch('https://graph.threads.net/oauth/access_token', {
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

        console.log('Token response status:', tokenResponse.status)

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          console.error('Token exchange failed:', errorText)
          
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText }
          }
          
          throw new Error(`Failed to exchange code for token: ${errorData.error?.message || errorData.error || tokenResponse.statusText}`)
        }

        const tokenData = await tokenResponse.json()
        console.log('Token data received:', { ...tokenData, access_token: tokenData.access_token ? '[REDACTED]' : undefined })
        
        if (tokenData.error) {
          throw new Error(`Threads API error: ${tokenData.error.message || tokenData.error_description || tokenData.error}`)
        }

        // Store credentials in database
        const db = createDbService()
        await db.upsertPlatformCredentials({
          userId: user.id,
          platform: 'threads',
          credentials: {
            accessToken: tokenData.access_token,
            userId: tokenData.user_id,
            scopes: tokenData.scope?.split(',') || []
          },
          isActive: true,
          expiresAt: tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : undefined
        })

        setStatus('success')
        
        // Redirect to settings after a short delay
        setTimeout(() => {
          navigate('/settings?tab=accounts', { replace: true })
        }, 2000)

      } catch (err) {
        console.error('Threads OAuth callback error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setStatus('error')
        
        // Redirect to settings with error after a delay
        setTimeout(() => {
          navigate('/settings?tab=accounts&error=connection_failed', { replace: true })
        }, 3000)
      }
    }

    handleCallback()
  }, [searchParams, navigate, user])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900">Connecting to Threads</h2>
              <p className="mt-2 text-gray-600">
                Please wait while we complete the connection...
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="text-green-600 text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900">Successfully Connected!</h2>
              <p className="mt-2 text-gray-600">
                Your Threads account has been connected. Redirecting to settings...
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="text-red-600 text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-gray-900">Connection Failed</h2>
              <p className="mt-2 text-gray-600">
                {error || 'Failed to connect your Threads account.'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Redirecting to settings...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}