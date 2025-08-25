import { useState } from 'react'
import { useConnectedPlatforms } from '@/hooks/useStats'
import { useAuthStore } from '@/stores/auth'
import { createDbService } from '@/services/database'
import { Platform } from '@/types'

export function ConnectedAccounts() {
  const { data: platforms, isLoading, error } = useConnectedPlatforms()
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null)

  const handleConnectPlatform = async (platform: Platform) => {
    setConnectingPlatform(platform)
    
    try {
      if (platform === 'threads') {
        // Check if environment variables are set
        const clientId = import.meta.env.VITE_THREADS_CLIENT_ID
        const clientSecret = import.meta.env.VITE_THREADS_CLIENT_SECRET
        
        if (!clientId) {
          alert('Threads API is not configured. Please contact the administrator.')
          return
        }
        
        if (!clientSecret) {
          alert('Threads Client Secret is not configured. Please contact the administrator.')
          return
        }
        
        // Validate client ID format (should be numeric)
        if (!/^\d+$/.test(clientId)) {
          alert('Invalid Threads Client ID format. Please check configuration.')
          return
        }
        
        console.log('🔗 Connecting to Threads using app-only authentication...')
        
        // Threads uses app-only authentication, not user OAuth
        // Get app access token directly
        const response = await fetch('https://graph.threads.net/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
          })
        })
        
        if (!response.ok) {
          throw new Error(`Token exchange failed: ${response.status}`)
        }
        
        const tokenData = await response.json()
        
        if (tokenData.error) {
          throw new Error(`Threads API error: ${tokenData.error.message || tokenData.error}`)
        }
        
        console.log('✅ Threads app token obtained successfully')
        
        // Store credentials in database (using current user context)
        const { user } = useAuthStore.getState()
        if (!user?.id) {
          throw new Error('User not authenticated')
        }
        
        const db = createDbService()
        await db.upsertPlatformCredentials({
          userId: user.id,
          platform: 'threads',
          credentials: {
            accessToken: tokenData.access_token,
            tokenType: tokenData.token_type || 'bearer',
            scopes: ['threads_basic', 'threads_content_publish'] // App-level scopes
          },
          isActive: true,
          // App tokens typically don't expire, but we'll set a long expiration
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        })
        
        alert('✅ Threads connected successfully!')
        
        // Refresh the platforms data
        window.location.reload()
      }
    } catch (error) {
      console.error(`Failed to connect ${platform}:`, error)
      alert(`Failed to connect ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setConnectingPlatform(null)
    }
  }

  const handleDisconnectPlatform = async (platform: Platform) => {
    if (confirm(`Are you sure you want to disconnect ${platform}?`)) {
      try {
        // TODO: Implement disconnect logic
        alert(`${platform} disconnection coming soon!`)
      } catch (error) {
        console.error(`Failed to disconnect ${platform}:`, error)
        alert(`Failed to disconnect ${platform}. Please try again.`)
      }
    }
  }

  const availablePlatforms: { platform: Platform; name: string; description: string; icon: string }[] = [
    {
      platform: 'threads',
      name: 'Threads',
      description: 'Connect your Meta Threads account to schedule posts',
      icon: '🧵'
    }
  ]

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Failed to load connected accounts. Please try refreshing the page.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Connected Accounts</h2>
        <p className="mt-2 text-gray-600">
          Manage your social media platform connections.
        </p>
      </div>

      <div className="space-y-4">
        {availablePlatforms.map((platformInfo) => {
          const connectedPlatform = platforms?.find(p => p.platform === platformInfo.platform && p.isActive)
          const isConnected = !!connectedPlatform
          const isConnecting = connectingPlatform === platformInfo.platform

          return (
            <div key={platformInfo.platform} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{platformInfo.icon}</div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {platformInfo.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {platformInfo.description}
                    </p>
                    {isConnected && connectedPlatform && (
                      <p className="text-xs text-green-600 mt-1">
                        Connected • Expires: {
                          connectedPlatform.expiresAt 
                            ? new Date(connectedPlatform.expiresAt).toLocaleDateString()
                            : 'Never'
                        }
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                      <button
                        onClick={() => handleDisconnectPlatform(platformInfo.platform)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnectPlatform(platformInfo.platform)}
                      disabled={isConnecting || isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {platforms && platforms.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Platform Connection Tips
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Make sure you have the necessary permissions on each platform</li>
                  <li>Connections may expire and need to be renewed periodically</li>
                  <li>You can disconnect and reconnect platforms at any time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}