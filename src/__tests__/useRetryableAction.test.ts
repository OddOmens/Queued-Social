import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRetryableAction } from '@/hooks/useRetryableAction'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'
import { ToastProvider } from '@/components/Toast'

// Mock the network status hook
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true })
}))

// Wrapper component for toast provider
function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('useRetryableAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should execute action successfully', async () => {
    const mockAction = vi.fn().mockResolvedValue('success')
    const { result } = renderHook(() => useRetryableAction(mockAction), { wrapper })
    
    let returnValue: any
    
    await act(async () => {
      returnValue = await result.current.execute()
    })
    
    expect(returnValue).toBe('success')
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('should handle action failure', async () => {
    const error = new Error('Action failed')
    const mockAction = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useRetryableAction(mockAction), { wrapper })
    
    let returnValue: any
    
    await act(async () => {
      returnValue = await result.current.execute()
    })
    
    expect(returnValue).toBeNull()
    expect(result.current.error).toBeInstanceOf(ClientError)
    expect(result.current.error?.message).toBe('Action failed')
    expect(result.current.isLoading).toBe(false)
  })

  it('should retry on network errors', async () => {
    const networkError = new ClientError(ErrorCodes.NETWORK_ERROR, 'Network failed')
    const mockAction = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue('success')
    
    const { result } = renderHook(() => 
      useRetryableAction(mockAction, { maxAttempts: 3, delay: 100 }), 
      { wrapper }
    )
    
    const promise = act(async () => {
      return result.current.execute()
    })
    
    // Fast-forward through retry delays
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    
    const returnValue = await promise
    
    expect(returnValue).toBe('success')
    expect(mockAction).toHaveBeenCalledTimes(3)
    expect(result.current.attemptCount).toBe(3)
  })

  it('should not retry non-network errors', async () => {
    const validationError = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Validation failed')
    const mockAction = vi.fn().mockRejectedValue(validationError)
    
    const { result } = renderHook(() => 
      useRetryableAction(mockAction, { maxAttempts: 3 }), 
      { wrapper }
    )
    
    let returnValue: any
    
    await act(async () => {
      returnValue = await result.current.execute()
    })
    
    expect(returnValue).toBeNull()
    expect(mockAction).toHaveBeenCalledTimes(1)
    expect(result.current.error?.code).toBe(ErrorCodes.VALIDATION_ERROR)
  })

  it('should handle loading state', async () => {
    const mockAction = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('success'), 100))
    )
    
    const { result } = renderHook(() => useRetryableAction(mockAction), { wrapper })
    
    const promise = act(async () => {
      return result.current.execute()
    })
    
    // Should be loading initially
    expect(result.current.isLoading).toBe(true)
    
    await promise
    
    // Should not be loading after completion
    expect(result.current.isLoading).toBe(false)
  })

  it('should provide retry functionality', async () => {
    const error = new ClientError(ErrorCodes.NETWORK_ERROR, 'Network failed')
    const mockAction = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success')
    
    const { result } = renderHook(() => useRetryableAction(mockAction), { wrapper })
    
    // First execution fails
    await act(async () => {
      await result.current.execute()
    })
    
    expect(result.current.error).toBeTruthy()
    expect(result.current.canRetry).toBe(true)
    
    // Retry should succeed
    let retryValue: any
    
    await act(async () => {
      retryValue = await result.current.retry()
    })
    
    expect(retryValue).toBe('success')
    expect(result.current.error).toBeNull()
  })

  it('should reset state', () => {
    const mockAction = vi.fn()
    const { result } = renderHook(() => useRetryableAction(mockAction), { wrapper })
    
    // Set some state
    act(() => {
      result.current.execute()
    })
    
    // Reset
    act(() => {
      result.current.reset()
    })
    
    expect(result.current.error).toBeNull()
    expect(result.current.attemptCount).toBe(0)
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle offline state', async () => {
    // Mock offline state
    vi.mocked(require('@/hooks/useNetworkStatus').useNetworkStatus).mockReturnValue({
      isOnline: false
    })
    
    const mockAction = vi.fn().mockResolvedValue('success')
    const { result } = renderHook(() => useRetryableAction(mockAction), { wrapper })
    
    let returnValue: any
    
    await act(async () => {
      returnValue = await result.current.execute()
    })
    
    expect(returnValue).toBeNull()
    expect(result.current.error?.code).toBe(ErrorCodes.NETWORK_ERROR)
    expect(mockAction).not.toHaveBeenCalled()
  })

  it('should respect maxAttempts limit', async () => {
    const networkError = new ClientError(ErrorCodes.NETWORK_ERROR, 'Network failed')
    const mockAction = vi.fn().mockRejectedValue(networkError)
    
    const { result } = renderHook(() => 
      useRetryableAction(mockAction, { maxAttempts: 2, delay: 1 }), 
      { wrapper }
    )
    
    await act(async () => {
      await result.current.execute()
    })
    
    expect(mockAction).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeTruthy()
  })
})