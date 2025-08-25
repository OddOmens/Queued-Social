import { useState } from 'react'

export function EnvDebug() {
  const [showDebug, setShowDebug] = useState(false)

  if (import.meta.env.PROD && !showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white px-2 py-1 text-xs rounded"
      >
        Debug Env
      </button>
    )
  }

  if (!showDebug) return null

  const envVars = {
    // Threads variables
    VITE_THREADS_CLIENT_ID: import.meta.env.VITE_THREADS_CLIENT_ID,
    VITE_THREADS_CLIENT_SECRET: import.meta.env.VITE_THREADS_CLIENT_SECRET,
    THREADS_CLIENT_ID: import.meta.env.THREADS_CLIENT_ID,
    THREADS_CLIENT_SECRET: import.meta.env.THREADS_CLIENT_SECRET,
    
    // Supabase variables
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    
    // Other
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl max-h-96 overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Environment Variables Debug</h3>
          <button
            onClick={() => setShowDebug(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2 text-sm">
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="flex">
              <span className="font-mono text-blue-600 w-48">{key}:</span>
              <span className="font-mono text-gray-800">
                {value ? (key.includes('SECRET') || key.includes('KEY') ? 
                  `${String(value).substring(0, 8)}...` : 
                  String(value)
                ) : '❌ undefined'}
              </span>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <h4 className="font-bold mb-2">All Environment Keys:</h4>
          <div className="text-xs font-mono">
            {Object.keys(import.meta.env).filter(key => 
              key.includes('THREADS') || key.includes('SUPABASE')
            ).join(', ')}
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-600">
          <p>Current URL: {window.location.href}</p>
          <p>Origin: {window.location.origin}</p>
        </div>
      </div>
    </div>
  )
}