import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { createDbService } from '@/services/database'
import { testThreadsTokenExchange } from '@/utils/threadsDebug'

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

        // Use debug utility to test token exchange
        console.log('🔄 Starting Threads token exchange...')
        
        const result = await testThreadsTokenExchange(code)
        
        if (!result.success) {
          throw new Error(`Token exchange failed: ${JSON.stringify(result.data)}`)
        }

        const tokenData = result.data
        
        if (tokenData.error) {
          throw new Error(`Threads API error: ${tokenData.error.message || tokenData.error_description || tokenData.error}`)
        }

        // Get actual user info from Threads API to ensure correct user ID
        console.log('🔍 Fetching user info from Threads API...')
        const userInfoResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${tokenData.access_token}`)
        
        if (!userInfoResponse.ok) {
          throw new Error(`Failed to fetch user info: ${userInfoResponse.status} ${userInfoResponse.statusText}`)
        }

        const userInfo = await userInfoResponse.json()
        
        if (userInfo.error) {
          throw new Error(`User info error: ${userInfo.error.message}`)
        }

        console.log(`✅ Verified user ID: ${userInfo.id}, Username: ${userInfo.username}`)
        console.log('🔍 Token response scopes:', tokenData.scope)
        console.log('🔍 Full token data:', JSON.stringify(tokenData, null, 2))

        // Store credentials in database with verified user info
        const db = createDbService()
        await db.upsertPlatformCredentials({
          userId: user.id,
          platform: 'threads',
          credentials: {
            accessToken: tokenData.access_token,
            userId: userInfo.id, // Use verified user ID from API
            username: userInfo.username, // Store username too
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