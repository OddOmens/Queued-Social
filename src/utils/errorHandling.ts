export interface AppError {
  code: string
  message: string
  details?: Record<string, any>
  statusCode?: number
}

export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'ClientError'
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode
    }
  }
}

export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  
  // Content errors
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  INVALID_MEDIA: 'INVALID_MEDIA',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  
  // Scheduling errors
  SCHEDULING_CONFLICT: 'SCHEDULING_CONFLICT',
  INVALID_TIME_SLOT: 'INVALID_TIME_SLOT',
  PAST_DATE_ERROR: 'PAST_DATE_ERROR',
  
  // Platform errors
  PLATFORM_ERROR: 'PLATFORM_ERROR',
  PLATFORM_AUTH_FAILED: 'PLATFORM_AUTH_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  SERVER_ERROR: 'SERVER_ERROR'
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

export function getErrorMessage(error: unknown): string {
  if (error instanceof ClientError) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  return 'An unexpected error occurred'
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof ClientError) {
    return [
      ErrorCodes.NETWORK_ERROR,
      ErrorCodes.TIMEOUT_ERROR,
      ErrorCodes.CONNECTION_ERROR
    ].includes(error.code as any)
  }
  
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch') ||
           error.message.toLowerCase().includes('connection')
  }
  
  return false
}

export function createErrorFromResponse(response: Response, data?: any): ClientError {
  const statusCode = response.status
  
  if (statusCode === 401) {
    return new ClientError(
      ErrorCodes.AUTH_REQUIRED,
      'Authentication required',
      { statusCode },
      statusCode
    )
  }
  
  if (statusCode === 403) {
    return new ClientError(
      ErrorCodes.AUTH_INVALID,
      'Access denied',
      { statusCode },
      statusCode
    )
  }
  
  if (statusCode === 422) {
    return new ClientError(
      ErrorCodes.VALIDATION_ERROR,
      data?.message || 'Validation failed',
      { statusCode, errors: data?.errors },
      statusCode
    )
  }
  
  if (statusCode === 429) {
    return new ClientError(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Too many requests. Please try again later.',
      { statusCode },
      statusCode
    )
  }
  
  if (statusCode >= 500) {
    return new ClientError(
      ErrorCodes.SERVER_ERROR,
      'Server error. Please try again later.',
      { statusCode },
      statusCode
    )
  }
  
  return new ClientError(
    ErrorCodes.UNKNOWN_ERROR,
    data?.message || 'An unexpected error occurred',
    { statusCode },
    statusCode
  )
}

export interface RetryOptions {
  maxAttempts: number
  delay: number
  backoff?: boolean
  shouldRetry?: (error: unknown) => boolean
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, delay, backoff = true, shouldRetry = isNetworkError } = options
  
  let lastError: unknown
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error
      }
      
      const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  throw lastError
}

export function formatValidationErrors(errors: Record<string, string[]>): string {
  const messages = Object.entries(errors).map(([field, fieldErrors]) => {
    const fieldName = field.charAt(0).toUpperCase() + field.slice(1)
    return `${fieldName}: ${fieldErrors.join(', ')}`
  })
  
  return messages.join('; ')
}