'use client'

import React from 'react'
import { useNetworkStatus, useOfflineDetection } from '@/hooks/useNetworkStatus'
import { useToast } from '@/components/Toast'

interface NetworkStatusProps {
  showToastOnReconnect?: boolean
}

export function NetworkStatus({ showToastOnReconnect = true }: NetworkStatusProps) {
  const { isOnline, isSlowConnection, effectiveType } = useNetworkStatus()
  const { justCameOnline } = useOfflineDetection()
  const { showSuccess, showWarning } = useToast()

  React.useEffect(() => {
    if (justCameOnline && showToastOnReconnect) {
      showSuccess('Connection restored', {
        title: 'Back Online'
      })
    }
  }, [justCameOnline, showToastOnReconnect, showSuccess])

  React.useEffect(() => {
    if (isSlowConnection) {
      showWarning('You appear to have a slow connection. Some features may be limited.', {
        title: 'Slow Connection'
      })
    }
  }, [isSlowConnection, showWarning])

  if (isOnline) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center text-sm font-medium z-50">
      <div className="flex items-center justify-center space-x-2">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 109.75 9.75c0-1.856-.5-3.6-1.372-5.098" />
        </svg>
        <span>You&apos;re offline. Some features may not work properly.</span>
      </div>
    </div>
  )
}

interface ConnectionIndicatorProps {
  className?: string
}

export function ConnectionIndicator({ className = '' }: ConnectionIndicatorProps) {
  const { isOnline, isSlowConnection, effectiveType } = useNetworkStatus()

  const getIndicatorColor = () => {
    if (!isOnline) return 'bg-red-500'
    if (isSlowConnection) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getTooltipText = () => {
    if (!isOnline) return 'Offline'
    if (isSlowConnection) return `Slow connection (${effectiveType})`
    return `Online${effectiveType ? ` (${effectiveType})` : ''}`
  }

  return (
    <div className={`relative ${className}`} title={getTooltipText()}>
      <div className={`w-3 h-3 rounded-full ${getIndicatorColor()}`}>
        {!isOnline && (
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
        )}
      </div>
    </div>
  )
}