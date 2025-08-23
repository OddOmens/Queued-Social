import { useState, useEffect, useCallback } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  connectionType: string | null
  effectiveType: string | null
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: null,
    effectiveType: null
  }))

  const updateNetworkStatus = useCallback(() => {
    const isOnline = navigator.onLine
    let isSlowConnection = false
    let connectionType: string | null = null
    let effectiveType: string | null = null

    // Check for Network Information API support
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connectionType = connection.type || null
      effectiveType = connection.effectiveType || null
      
      // Consider 2g or slow-2g as slow connections
      isSlowConnection = effectiveType === '2g' || effectiveType === 'slow-2g'
    }

    setNetworkStatus({
      isOnline,
      isSlowConnection,
      connectionType,
      effectiveType
    })
  }, [])

  useEffect(() => {
    // Initial check
    updateNetworkStatus()

    // Listen for online/offline events
    const handleOnline = () => updateNetworkStatus()
    const handleOffline = () => updateNetworkStatus()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for connection changes if supported
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', updateNetworkStatus)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        connection.removeEventListener('change', updateNetworkStatus)
      }
    }
  }, [updateNetworkStatus])

  return networkStatus
}

export function useOfflineDetection() {
  const { isOnline } = useNetworkStatus()
  const [wasOffline, setWasOffline] = useState(false)
  const [justCameOnline, setJustCameOnline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
      setJustCameOnline(false)
    } else if (wasOffline && isOnline) {
      // Just came back online
      setJustCameOnline(true)
      setWasOffline(false)
      
      // Reset justCameOnline after a short delay
      const timeout = setTimeout(() => {
        setJustCameOnline(false)
      }, 100)
      
      return () => clearTimeout(timeout)
    }
  }, [isOnline, wasOffline])

  return {
    isOnline,
    wasOffline,
    justCameOnline
  }
}