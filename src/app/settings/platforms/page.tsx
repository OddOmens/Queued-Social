'use client'

import React, { useState, useEffect } from 'react'

interface PlatformConnection {
  platform: string
  isConnected: boolean
  username?: string
  connectedAt?: string
  status: 'active' | 'expired' | 'error'
}

export default function PlatformsSettingsPage() {
  const [connections, setConnections] = useState<PlatformConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch('/api/auth/platforms')
        if (response.ok) {
          const data = await response.json()
          setConnections(data.platforms || [])
        }
      } catch (error) {
        console.error('Failed to fetch platform connections:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConnections()
  }, [])

  const handleConnect = async (platform: string) => {
    try {
      // Redirect to OAuth flow
      window.location.href = `/api/auth/${platform.toLowerCase()}`
    } catch (error) {
      console.error('Failed to connect platform:', error)
    }
  }

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Are you sure you want to disconnect ${platform}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/auth/platforms/${platform.toLowerCase()}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setConnections(prev => 
          prev.map(conn => 
            conn.platform === platform 
              ? { ...conn, isConnected: false, username: undefined, connectedAt: undefined }
              : conn
          )
        )
      }
    } catch (error) {
      console.error('Failed to disconnect platform:', error)
    }
  }

  const handleTestConnection = async (platform: string) => {
    try {
      const response = await fetch(`/api/platforms/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform: platform.toLowerCase() }),
      })
      
      const result = await response.json()
      
      if (response.ok) {
        alert('Connection test successful!')
      } else {
        alert(`Connection test failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      alert('Connection test failed')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'expired':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const availablePlatforms = [
    {
      name: 'Threads',
      platform: 'threads',
      description: 'Connect your Threads account to schedule posts',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.068c0-3.518.85-6.373 2.495-8.424C5.845 1.205 8.598.024 12.179 0h.007c3.581.024 6.334 1.205 8.184 3.509C21.65 5.56 22.5 8.414 22.5 11.932c0 3.518-.85 6.373-2.495 8.424C18.155 22.795 15.402 23.976 11.821 24h.365z"/>
        </svg>
      ),
    },
    // Add more platforms here as they become available
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Platform Connections</h2>
          <p className="text-gray-600 mt-1">
            Connect your social media accounts to start scheduling posts. You can manage your connections and test them here.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-20 h-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {availablePlatforms.map((platform) => {
              const connection = connections.find(c => c.platform === platform.platform)
              const isConnected = connection?.isConnected || false

              return (
                <div key={platform.platform} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                      {platform.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{platform.name}</h3>
                      <p className="text-sm text-gray-500">{platform.description}</p>
                      {isConnected && connection?.username && (
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(connection.status)}`}>
                            {connection.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            Connected as @{connection.username}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => handleTestConnection(platform.platform)}
                          className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => handleDisconnect(platform.platform)}
                          className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.platform)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Connection Help */}
      <div className="bg-blue-50 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Need help connecting your accounts?
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Make sure you have admin access to the social media accounts you want to connect</li>
                <li>Some platforms may require approval for third-party applications</li>
                <li>You can test your connections at any time to ensure they&apos;re working properly</li>
                <li>Disconnecting an account will not delete your scheduled posts, but they won&apos;t be published</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}