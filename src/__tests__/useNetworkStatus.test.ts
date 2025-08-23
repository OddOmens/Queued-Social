import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus, useOfflineDetection } from '@/hooks/useNetworkStatus'

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

// Mock navigator.connection
Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: {
    type: 'wifi',
    effectiveType: '4g',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
})

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigator.onLine = true
    if (navigator.connection) {
      navigator.connection.type = 'wifi'
      navigator.connection.effectiveType = '4g'
    }
  })

  it('should initialize with online status', () => {
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(true)
    expect(result.current.isSlowConnection).toBe(false)
    expect(result.current.connectionType).toBe('wifi')
    expect(result.current.effectiveType).toBe('4g')
  })

  it('should detect offline status', () => {
    navigator.onLine = false
    
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(false)
  })

  it('should detect slow connection', () => {
    if (navigator.connection) {
      navigator.connection.effectiveType = '2g'
    }
    
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isSlowConnection).toBe(true)
    expect(result.current.effectiveType).toBe('2g')
  })

  it('should detect very slow connection', () => {
    if (navigator.connection) {
      navigator.connection.effectiveType = 'slow-2g'
    }
    
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isSlowConnection).toBe(true)
    expect(result.current.effectiveType).toBe('slow-2g')
  })

  it('should handle missing connection API', () => {
    const originalConnection = navigator.connection
    Object.defineProperty(navigator, 'connection', {
      value: undefined,
      configurable: true
    })
    
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.connectionType).toBeNull()
    expect(result.current.effectiveType).toBeNull()
    expect(result.current.isSlowConnection).toBe(false)
    
    // Restore
    Object.defineProperty(navigator, 'connection', {
      value: originalConnection,
      configurable: true
    })
  })

  it('should listen for online/offline events', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    
    const { unmount } = renderHook(() => useNetworkStatus())
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    
    unmount()
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('should update status on online event', () => {
    navigator.onLine = false
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(false)
    
    // Simulate going online
    navigator.onLine = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    
    expect(result.current.isOnline).toBe(true)
  })

  it('should update status on offline event', () => {
    navigator.onLine = true
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(true)
    
    // Simulate going offline
    navigator.onLine = false
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    
    expect(result.current.isOnline).toBe(false)
  })
})

describe('useOfflineDetection', () => {
  beforeEach(() => {
    navigator.onLine = true
  })

  it('should initialize with online status', () => {
    const { result } = renderHook(() => useOfflineDetection())
    
    expect(result.current.isOnline).toBe(true)
    expect(result.current.wasOffline).toBe(false)
    expect(result.current.justCameOnline).toBe(false)
  })

  it('should track offline state', () => {
    const { result } = renderHook(() => useOfflineDetection())
    
    // Go offline
    navigator.onLine = false
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    
    expect(result.current.isOnline).toBe(false)
    expect(result.current.wasOffline).toBe(true)
    expect(result.current.justCameOnline).toBe(false)
  })

  it('should detect when coming back online', () => {
    navigator.onLine = false
    const { result } = renderHook(() => useOfflineDetection())
    
    // Start offline
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    
    expect(result.current.wasOffline).toBe(true)
    
    // Come back online
    navigator.onLine = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    
    expect(result.current.isOnline).toBe(true)
    expect(result.current.wasOffline).toBe(false)
    expect(result.current.justCameOnline).toBe(true)
  })

  it('should reset justCameOnline after being online', () => {
    navigator.onLine = false
    const { result, rerender } = renderHook(() => useOfflineDetection())
    
    // Go offline then online
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    
    navigator.onLine = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    
    expect(result.current.justCameOnline).toBe(true)
    
    // Rerender should reset justCameOnline
    rerender()
    
    expect(result.current.justCameOnline).toBe(false)
  })
})