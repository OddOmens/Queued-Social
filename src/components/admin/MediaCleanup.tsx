'use client'

import { useState } from 'react'
import { triggerMediaCleanup } from '@/services/mediaStorage'

export function MediaCleanup() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleCleanup = async () => {
    setIsLoading(true)
    setResult(null)
    
    try {
      const cleanupResult = await triggerMediaCleanup()
      setResult(cleanupResult)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Media Storage Cleanup</h3>
      
      <div className="space-y-4">
        <p className="text-gray-300 text-sm">
          Clean up orphaned media files and files from failed posts to free up storage space.
        </p>
        
        <div className="space-y-2 text-xs text-gray-400">
          <p>• Removes media from failed posts older than 24 hours</p>
          <p>• Removes orphaned media files older than 7 days</p>
          <p>• Cleanup runs automatically daily at 4 AM</p>
        </div>

        {result && (
          <div className={`p-3 rounded-md text-sm ${
            result.success 
              ? 'bg-green-900/50 border border-green-800 text-green-200'
              : 'bg-red-900/50 border border-red-800 text-red-200'
          }`}>
            {result.message}
          </div>
        )}

        <button
          onClick={handleCleanup}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Running Cleanup...</span>
            </div>
          ) : (
            'Run Manual Cleanup'
          )}
        </button>
      </div>
    </div>
  )
}