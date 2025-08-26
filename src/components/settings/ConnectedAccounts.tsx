import { useState } from 'react'
import { useConnectedPlatforms } from '@/hooks/useStats'
import { useAuthStore } from '@/stores/auth'
import { createDbService } from '@/services/database'
import { useToast } from '@/components/Toast'
import { Platform } from '@/types'

export function ConnectedAccounts() {
  const { data: platforms, isLoading, error } = useConnectedPlatforms()
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null)
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<Platform | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState<Platform | null>(null)
  const { showSuccess, showError } = useToast()

  const handleConnectPlatform = async (platform: Platform) => {
    setConnectingPlatform(platform)
    
    try {
      if (platform === 'threads') {
        // Check if environment variables are set
        const clientId = import.meta.env.VITE_THREADS_CLIENT_ID
        const clientSecret = import.meta.env.VITE_THREADS_CLIENT_SECRET
        
        if (!clientId) {
          showError('Threads API is not configured. Please contact the administrator.')
          return
        }
        
        if (!clientSecret) {
          showError('Threads Client Secret is not configured. Please contact the administrator.')
          return
        }
        
        // Validate client ID format (should be numeric)
        if (!/^\d+$/.test(clientId)) {
          showError('Invalid Threads Client ID format. Please check configuration.')
          return
        }
        
        console.log('🔗 Starting Threads OAuth flow...')
        
        // Threads requires user OAuth, not app-only authentication
        // Redirect to Threads OAuth authorization
        const redirectUri = `${window.location.origin}/auth/threads/callback`
        const scopes = 'threads_basic,threads_content_publish'
        
        const authUrl = new URL('https://threads.net/oauth/authorize')
        authUrl.searchParams.set('client_id', clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('scope', scopes)
        authUrl.searchParams.set('response_type', 'code')
        
        console.log('🌐 Redirecting to Threads OAuth:', authUrl.toString())
        
        // Redirect to Threads OAuth
        window.location.href = authUrl.toString()
        return // Don't continue with the rest of the function
        
        // This won't be reached since we redirect to OAuth
        return
      }
    } catch (error) {
      console.error(`Failed to connect ${platform}:`, error)
      showError(`Failed to connect ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setConnectingPlatform(null)
    }
  }

  const handleDisconnectClick = (platform: Platform) => {
    setConfirmDisconnect(platform)
  }

  const handleConfirmDisconnect = async () => {
    if (!confirmDisconnect) return
    
    setDisconnectingPlatform(confirmDisconnect)
    setConfirmDisconnect(null)
    
    try {
      const { user } = useAuthStore.getState()
      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      const db = createDbService()
      await db.deletePlatformCredentials(user.id, confirmDisconnect)
      
      showSuccess(`${confirmDisconnect} disconnected successfully!`)
      
      // Refresh the platforms data
      window.location.reload()
    } catch (error) {
      console.error(`Failed to disconnect ${confirmDisconnect}:`, error)
      showError(`Failed to disconnect ${confirmDisconnect}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDisconnectingPlatform(null)
    }
  }

  const handleCancelDisconnect = () => {
    setConfirmDisconnect(null)
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
        <h2 className="text-2xl font-bold text-white">Connected Accounts</h2>
        <p className="mt-2 text-gray-300">
          Manage your social media platform connections.
        </p>
      </div>

      <div className="space-y-4">
        {availablePlatforms.map((platformInfo) => {
          const connectedPlatform = platforms?.find(p => p.platform === platformInfo.platform && p.isActive)
          const isConnected = !!connectedPlatform
          const isConnecting = connectingPlatform === platformInfo.platform
          const isDisconnecting = disconnectingPlatform === platformInfo.platform

          return (
            <div key={platformInfo.platform} className="bg-gray-800 border border-gray-600 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{platformInfo.icon}</div>
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      {platformInfo.name}
                    </h3>
                    <p className="text-sm text-gray-400">
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
                        onClick={() => handleDisconnectClick(platformInfo.platform)}
                        disabled={isDisconnecting}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
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
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-200">
                Platform Connection Tips
              </h3>
              <div className="mt-2 text-sm text-blue-300">
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

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnect && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-gray-800">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-white mt-4">
                Disconnect {confirmDisconnect}?
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-300">
                  Are you sure you want to disconnect your {confirmDisconnect} account? 
                  This will stop all scheduled posts for this platform and you'll need to reconnect to schedule new posts.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-3">
                  <button
                    onClick={handleCancelDisconnect}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDisconnect}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}