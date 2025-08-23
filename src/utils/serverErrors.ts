export interface ServerErrorDetails {
  code: string
  message: string
  statusCode: number
  details?: Record<string, any>
  stack?: string
}

export class ServerError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'ServerError'
  }

  toJSON(): ServerErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    }
  }
}

export const ServerErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // Business Logic
  SCHEDULING_CONFLICT: 'SCHEDULING_CONFLICT',
  INVALID_TIME_SLOT: 'INVALID_TIME_SLOT',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
  
  // External Services
  PLATFORM_API_ERROR: 'PLATFORM_API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // File Operations
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  
  // Generic
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const

export type ServerErrorCode = typeof ServerErrorCodes[keyof typeof ServerErrorCodes]

// Predefined error creators
export const createAuthError = (message: string = 'Authentication required') =>
  new ServerError(ServerErrorCodes.UNAUTHORIZED, message, 401)

export const createForbiddenError = (message: string = 'Access denied') =>
  new ServerError(ServerErrorCodes.FORBIDDEN, message, 403)

export const createValidationError = (message: string, details?: Record<string, any>) =>
  new ServerError(ServerErrorCodes.VALIDATION_ERROR, message, 422, details)

export const createNotFoundError = (resource: string = 'Resource') =>
  new ServerError(ServerErrorCodes.RECORD_NOT_FOUND, `${resource} not found`, 404)

export const createConflictError = (message: string) =>
  new ServerError(ServerErrorCodes.SCHEDULING_CONFLICT, message, 409)

export const createRateLimitError = (message: string = 'Rate limit exceeded') =>
  new ServerError(ServerErrorCodes.RATE_LIMIT_EXCEEDED, message, 429)

export const createInternalError = (message: string = 'Internal server error') =>
  new ServerError(ServerErrorCodes.INTERNAL_SERVER_ERROR, message, 500)

// Error type guards
export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError
}

export function isValidationError(error: unknown): error is ServerError {
  return isServerError(error) && error.code === ServerErrorCodes.VALIDATION_ERROR
}

export function isAuthError(error: unknown): error is ServerError {
  return isServerError(error) && 
    [ServerErrorCodes.UNAUTHORIZED, ServerErrorCodes.FORBIDDEN, ServerErrorCodes.TOKEN_EXPIRED].includes(error.code as ServerErrorCode)
}

export function isDatabaseError(error: unknown): error is ServerError {
  return isServerError(error) && 
    [ServerErrorCodes.DATABASE_ERROR, ServerErrorCodes.RECORD_NOT_FOUND, ServerErrorCodes.DUPLICATE_RECORD].includes(error.code as ServerErrorCode)
}