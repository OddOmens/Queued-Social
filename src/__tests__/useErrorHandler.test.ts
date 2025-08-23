import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useErrorHandler, useApiCall } from '@/hooks/useErrorHandler'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'

// Mock fetch
global.fetch = vi.fn()

// Mock the Toast component
vi.mock('@/components/Toast', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn()
  })
}))

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with no error and not loading', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should set and clear errors', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.setError(new Error('Test error'))
    })
    
    expect(result.current.error).toBeInstanceOf(ClientError)
    expect(result.current.error?.message).toBe('Test error')
    
    act(() => {
      result.current.clearError()
    })
    
    expect(result.current.error).toBeNull()
  })

  it('should handle loading state', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.setLoading(true)
    })
    
    expect(result.current.isLoading).toBe(true)
    
    act(() => {
      result.current.setLoading(false)
    })
    
    expect(result.current.isLoading).toBe(false)
  })

  it('should execute function with error handling', async () => {
    const { result } = renderHook(() => useErrorHandler())
    const mockFn = vi.fn().mockResolvedValue('success')
    
    let returnValue: string | null = null
    
    await act(async () => {
      returnValue = await result.current.executeWithErrorHandling(mockFn)
    })
    
    expect(returnValue).toBe('success')
    expect(result.current.error).toBeNull()
  })

  it('should handle errors in executed function', async () => {
    const { result } = renderHook(() => useErrorHandler())
    const error = new Error('Function failed')
    const mockFn = vi.fn().mockRejectedValue(error)
    
    let returnValue: string | null = 'initial'
    
    await act(async () => {
      returnValue = await result.current.executeWithErrorHandling(mockFn)
    })
    
    expect(returnValue).toBeNull()
    expect(result.current.error).toBeInstanceOf(ClientError)
    expect(result.current.error?.message).toBe('Function failed')
  })

  it('should show loading during execution', async () => {
    const { result } = renderHook(() => useErrorHandler())
    const mockFn = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('success'), 100))
    )
    
    const promise = act(async () => {
      return result.current.executeWithErrorHandling(mockFn, { showLoading: true })
    })
    
    // Should be loading initially
    expect(result.current.isLoading).toBe(true)
    
    await promise
    
    // Should not be loading after completion
    expect(result.current.isLoading).toBe(false)
  })
})

describe('useApiCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should make successful API call', async () => {
    const mockResponse = { data: 'test' }
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    
    const { result } = renderHook(() => useApiCall())
    
    let response: any = null
    
    await act(async () => {
      response = await result.current.apiCall('/api/test')
    })
    
    expect(response).toEqual(mockResponse)
    expect(result.current.error).toBeNull()
  })

  it('should handle 401 authentication error', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' })
    })
    
    const { result } = renderHook(() => useApiCall())
    
    let response: any = 'initial'
    
    await act(async () => {
      response = await result.current.apiCall('/api/test')
    })
    
    expect(response).toBeNull()
    expect(result.current.error?.code).toBe(ErrorCodes.AUTH_REQUIRED)
  })

  it('should handle 422 validation error', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ 
        message: 'Validation failed',
        errors: { email: ['Invalid'] }
      })
    })
    
    const { result } = renderHook(() => useApiCall())
    
    let response: any = 'initial'
    
    await act(async () => {
      response = await result.current.apiCall('/api/test')
    })
    
    expect(response).toBeNull()
    expect(result.current.error?.code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(result.current.error?.details?.errors).toEqual({ email: ['Invalid'] })
  })

  it('should handle 500 server error', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal server error' })
    })
    
    const { result } = renderHook(() => useApiCall())
    
    let response: any = 'initial'
    
    await act(async () => {
      response = await result.current.apiCall('/api/test')
    })
    
    expect(response).toBeNull()
    expect(result.current.error?.code).toBe(ErrorCodes.SERVER_ERROR)
  })

  it('should retry on network errors', async () => {
    ;(fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'success' })
      })
    
    const { result } = renderHook(() => useApiCall())
    
    const promise = act(async () => {
      return result.current.apiCall('/api/test')
    })
    
    // Fast-forward through retry delays
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    
    const response = await promise
    
    expect(response).toEqual({ data: 'success' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('should include custom headers', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    })
    
    const { result } = renderHook(() => useApiCall())
    
    await act(async () => {
      await result.current.apiCall('/api/test', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer token' }
      })
    })
    
    expect(fetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      }
    })
  })
})