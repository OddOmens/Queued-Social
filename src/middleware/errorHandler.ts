import { NextRequest, NextResponse } from 'next/server'
import { ServerError, ServerErrorCodes, createInternalError, isServerError } from '@/utils/serverErrors'
import { logger } from '@/utils/logger'

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, any>
    timestamp: string
    requestId?: string
  }
}

export function createErrorResponse(
  error: ServerError | Error | unknown,
  requestId?: string
): NextResponse<ErrorResponse> {
  let serverError: ServerError

  if (isServerError(error)) {
    serverError = error
  } else if (error instanceof Error) {
    // Convert generic errors to ServerError
    if (error.message.includes('not found') || error.message.includes('404')) {
      serverError = new ServerError(ServerErrorCodes.RECORD_NOT_FOUND, error.message, 404)
    } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
      serverError = new ServerError(ServerErrorCodes.UNAUTHORIZED, error.message, 401)
    } else if (error.message.includes('forbidden') || error.message.includes('403')) {
      serverError = new ServerError(ServerErrorCodes.FORBIDDEN, error.message, 403)
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      serverError = new ServerError(ServerErrorCodes.VALIDATION_ERROR, error.message, 422)
    } else {
      serverError = createInternalError(error.message)
    }
  } else {
    serverError = createInternalError('An unexpected error occurred')
  }

  // Log the error
  logger.error('API Error', {
    error: serverError.toJSON(),
    requestId,
    timestamp: new Date().toISOString()
  })

  const response: ErrorResponse = {
    error: {
      code: serverError.code,
      message: serverError.message,
      details: serverError.details,
      timestamp: new Date().toISOString(),
      requestId
    }
  }

  return NextResponse.json(response, { status: serverError.statusCode })
}

export function withErrorHandler<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T | ErrorResponse>> => {
    const requestId = crypto.randomUUID()
    
    try {
      // Log incoming request
      logger.info('API Request', {
        method: request.method,
        url: request.url,
        requestId,
        timestamp: new Date().toISOString()
      })

      const response = await handler(request)
      
      // Log successful response
      logger.info('API Response', {
        status: response.status,
        requestId,
        timestamp: new Date().toISOString()
      })

      return response
    } catch (error) {
      return createErrorResponse(error, requestId)
    }
  }
}

// Validation helper
export function validateRequestBody<T>(
  body: any,
  requiredFields: (keyof T)[],
  optionalFields: (keyof T)[] = []
): T {
  if (!body || typeof body !== 'object') {
    throw new ServerError(
      ServerErrorCodes.VALIDATION_ERROR,
      'Request body is required and must be an object',
      422
    )
  }

  const errors: Record<string, string[]> = {}

  // Check required fields
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === null || body[field] === undefined || body[field] === '') {
      if (!errors[field as string]) {
        errors[field as string] = []
      }
      errors[field as string].push('This field is required')
    }
  }

  // Validate field types and constraints
  const allFields = [...requiredFields, ...optionalFields]
  for (const field of allFields) {
    if (field in body && body[field] !== null && body[field] !== undefined) {
      // Add specific validation logic here based on field names
      if (field === 'email' && typeof body[field] === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(body[field])) {
          if (!errors[field as string]) {
            errors[field as string] = []
          }
          errors[field as string].push('Invalid email format')
        }
      }
      
      if (field === 'scheduledTime' && body[field]) {
        const date = new Date(body[field])
        if (isNaN(date.getTime())) {
          if (!errors[field as string]) {
            errors[field as string] = []
          }
          errors[field as string].push('Invalid date format')
        } else if (date < new Date()) {
          if (!errors[field as string]) {
            errors[field as string] = []
          }
          errors[field as string].push('Scheduled time cannot be in the past')
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ServerError(
      ServerErrorCodes.VALIDATION_ERROR,
      'Validation failed',
      422,
      { errors }
    )
  }

  return body as T
}

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): void {
  const now = Date.now()
  const windowStart = now - windowMs
  
  // Clean up old entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < windowStart) {
      rateLimitMap.delete(key)
    }
  }
  
  const current = rateLimitMap.get(identifier)
  
  if (!current) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now })
    return
  }
  
  if (current.resetTime < windowStart) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now })
    return
  }
  
  if (current.count >= maxRequests) {
    throw new ServerError(
      ServerErrorCodes.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
      429,
      {
        limit: maxRequests,
        windowMs,
        retryAfter: Math.ceil((current.resetTime + windowMs - now) / 1000)
      }
    )
  }
  
  current.count++
}