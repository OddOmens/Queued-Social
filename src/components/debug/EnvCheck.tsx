'use client'

import { useEffect, useState } from 'react'

interface EnvStatus {
  client: {
    hasSupabaseUrl: boolean
    hasSupabaseKey: boolean
    supabaseUrl?: string
  }
  server?: {
    hasSupabaseUrl: boolean
    hasSupabaseKey: boolean
    hasServiceRole: boolean
    supabaseUrl?: string
  }
}

export function EnvCheck() {
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    // Check client-side environment
    const clientEnv = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...'
    }

    setEnvStatus({ client: clientEnv })

    // Check server-side environment via API
    fetch('/api/debug/env')
      .then(res => res.json())
      .then(serverEnv => {
        setEnvStatus(prev => ({
          ...prev!,
          server: serverEnv
        }))
      })
      .catch(err => {
        console.log('Server env check not available:', err.message)
      })
  }, [])

  if (!envStatus) return null

  const hasIssues = !envStatus.client.hasSupabaseUrl || 
                   !envStatus.client.hasSupabaseKey ||
                   (envStatus.server && (!envStatus.server.hasSupabaseUrl || !envStatus.server.hasSupabaseKey))

  if (!hasIssues && !showDebug) return null

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {hasIssues && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
          <strong>Environment Issues Detected!</strong>
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="ml-2 text-sm underline"
          >
            {showDebug ? 'Hide' : 'Show'} Details
          </button>
        </div>
      )}
      
      {showDebug && (
        <div className="bg-gray-100 border border-gray-400 text-gray-800 px-4 py-3 rounded text-sm">
          <h4 className="font-bold mb-2">Environment Status</h4>
          
          <div className="mb-2">
            <strong>Client:</strong>
            <ul className="ml-4">
              <li>Supabase URL: {envStatus.client.hasSupabaseUrl ? '✅' : '❌'}</li>
              <li>Supabase Key: {envStatus.client.hasSupabaseKey ? '✅' : '❌'}</li>
              <li>URL: {envStatus.client.supabaseUrl}</li>
            </ul>
          </div>
          
          {envStatus.server && (
            <div>
              <strong>Server:</strong>
              <ul className="ml-4">
                <li>Supabase URL: {envStatus.server.hasSupabaseUrl ? '✅' : '❌'}</li>
                <li>Supabase Key: {envStatus.server.hasSupabaseKey ? '✅' : '❌'}</li>
                <li>Service Role: {envStatus.server.hasServiceRole ? '✅' : '❌'}</li>
                <li>URL: {envStatus.server.supabaseUrl}</li>
              </ul>
            </div>
          )}
          
          <button 
            onClick={() => setShowDebug(false)}
            className="mt-2 text-xs bg-gray-200 px-2 py-1 rounded"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}