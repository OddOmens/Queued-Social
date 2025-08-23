import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  ClientError, 
  ErrorCodes, 
  getErrorMessage, 
  isNetworkError, 
  createErrorFromResponse,
  withRetry,
  formatValidationErrors
} from '@/utils/errorHandling'

describe('ClientError', () => {
  it('should create error with code and message', () => {
    const error = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Test error')
    
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(error.message).toBe('Test error')
    expect(error.name).toBe('ClientError')
  })

  it('should include details and status code', () => {
    const details = { field: 'email' }
    const error = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Test error', details, 422)
    
    expect(error.details).toEqual(details)
    expect(error.statusCode).toBe(422)
  })

  it('should serialize to JSON correctly', () => {
    const error = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Test error', { field: 'email' }, 422)
    const json = error.toJSON()
    
    expect(json).toEqual({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Test error',
      details: { field: 'email' },
      statusCode: 422
    })
  })
})

describe('getErrorMessage', () => {
  it('should return message from ClientError', () => {
    const error = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Custom error')
    expect(getErrorMessage(error)).toBe('Custom error')
  })

  it('should return message from Error', () => {
    const error = new Error('Standard error')
    expect(getErrorMessage(error)).toBe('Standard error')
  })

  it('should return string as is', () => {
    expect(getErrorMessage('String error')).toBe('String error')
  })

  it('should return default message for unknown types', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred')
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
    expect(getErrorMessage({})).toBe('An unexpected error occurred')
  })
})

describe('isNetworkError', () => {
  it('should identify network ClientErrors', () => {
    const networkError = new ClientError(ErrorCodes.NETWORK_ERROR, 'Network failed')
    const timeoutError = new ClientError(ErrorCodes.TIMEOUT_ERROR, 'Timeout')
    const connectionError = new ClientError(ErrorCodes.CONNECTION_ERROR, 'Connection failed')
    const validationError = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Validation failed')
    
    expect(isNetworkError(networkError)).toBe(true)
    expect(isNetworkError(timeoutError)).toBe(true)
    expect(isNetworkError(connectionError)).toBe(true)
    expect(isNetworkError(validationError)).toBe(false)
  })

  it('should identify network Error messages', () => {
    const networkError = new Error('Network request failed')
    const fetchError = new Error('fetch failed')
    const connectionError = new Error('connection refused')
    const otherError = new Error('Something else')
    
    expect(isNetworkError(networkError)).toBe(true)
    expect(isNetworkError(fetchError)).toBe(true)
    expect(isNetworkError(connectionError)).toBe(true)
    expect(isNetworkError(otherError)).toBe(false)
  })
})

describe('createErrorFromResponse', () => {
  it('should create auth error for 401', () => {
    const response = { status: 401 } as Response
    const error = createErrorFromResponse(response)
    
    expect(error.code).toBe(ErrorCodes.AUTH_REQUIRED)
    expect(error.statusCode).toBe(401)
  })

  it('should create validation error for 422', () => {
    const response = { status: 422 } as Response
    const data = { message: 'Validation failed', errors: { email: ['Invalid'] } }
    const error = createErrorFromResponse(response, data)
    
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(error.message).toBe('Validation failed')
    expect(error.details?.errors).toEqual({ email: ['Invalid'] })
  })

  it('should create rate limit error for 429', () => {
    const response = { status: 429 } as Response
    const error = createErrorFromResponse(response)
    
    expect(error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED)
    expect(error.statusCode).toBe(429)
  })

  it('should create server error for 500+', () => {
    const response = { status: 500 } as Response
    const error = createErrorFromResponse(response)
    
    expect(error.code).toBe(ErrorCodes.SERVER_ERROR)
    expect(error.statusCode).toBe(500)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    
    const result = await withRetry(fn, { maxAttempts: 3, delay: 1000 })
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on network errors', async () => {
    const networkError = new ClientError(ErrorCodes.NETWORK_ERROR, 'Network failed')
    const fn = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue('success')
    
    const promise = withRetry(fn, { maxAttempts: 3, delay: 1000 })
    
    // Fast-forward through delays
    await vi.advanceTimersByTimeAsync(3000)
    
    const result = await promise
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should not retry non-network errors', async () => {
    const validationError = new ClientError(ErrorCodes.VALIDATION_ERROR, 'Validation failed')
    const fn = vi.fn().mockRejectedValue(validationError)
    
    await expect(withRetry(fn, { maxAttempts: 3, delay: 1000 })).rejects.toThrow(validationError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should respect maxAttempts limit', async () => {
    const networkError = new ClientError(ErrorCodes.NETWORK_ERROR, 'Network failed')
    const fn = vi.fn().mockRejectedValue(networkError)
    
    try {
      await withRetry(fn, { maxAttempts: 2, delay: 1 })
    } catch (error) {
      expect(error).toBe(networkError)
    }
    
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('formatValidationErrors', () => {
  it('should format single field error', () => {
    const errors = { email: ['Invalid email format'] }
    const result = formatValidationErrors(errors)
    
    expect(result).toBe('Email: Invalid email format')
  })

  it('should format multiple field errors', () => {
    const errors = {
      email: ['Invalid email format'],
      password: ['Too short', 'Missing special character']
    }
    const result = formatValidationErrors(errors)
    
    expect(result).toBe('Email: Invalid email format; Password: Too short, Missing special character')
  })

  it('should handle empty errors', () => {
    const result = formatValidationErrors({})
    expect(result).toBe('')
  })
})