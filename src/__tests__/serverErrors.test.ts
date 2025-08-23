import { describe, it, expect } from 'vitest'
import {
  ServerError,
  ServerErrorCodes,
  createAuthError,
  createValidationError,
  createNotFoundError,
  createInternalError,
  isServerError,
  isValidationError,
  isAuthError,
  isDatabaseError
} from '@/utils/serverErrors'

describe('ServerError', () => {
  it('should create error with code, message and status', () => {
    const error = new ServerError(
      ServerErrorCodes.VALIDATION_ERROR,
      'Test validation error',
      422
    )

    expect(error.code).toBe(ServerErrorCodes.VALIDATION_ERROR)
    expect(error.message).toBe('Test validation error')
    expect(error.statusCode).toBe(422)
    expect(error.name).toBe('ServerError')
  })

  it('should include details when provided', () => {
    const details = { field: 'email', value: 'invalid' }
    const error = new ServerError(
      ServerErrorCodes.VALIDATION_ERROR,
      'Validation failed',
      422,
      details
    )

    expect(error.details).toEqual(details)
  })

  it('should serialize to JSON correctly', () => {
    const error = new ServerError(
      ServerErrorCodes.VALIDATION_ERROR,
      'Test error',
      422,
      { field: 'email' }
    )

    const json = error.toJSON()

    expect(json).toEqual({
      code: ServerErrorCodes.VALIDATION_ERROR,
      message: 'Test error',
      statusCode: 422,
      details: { field: 'email' },
      stack: undefined // Should be undefined in test environment
    })
  })

  it('should include stack trace in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const error = new ServerError(ServerErrorCodes.INTERNAL_SERVER_ERROR, 'Test error')
    const json = error.toJSON()

    expect(json.stack).toBeDefined()
    expect(typeof json.stack).toBe('string')

    process.env.NODE_ENV = originalEnv
  })
})

describe('Error creators', () => {
  it('should create auth error', () => {
    const error = createAuthError('Custom auth message')

    expect(error.code).toBe(ServerErrorCodes.UNAUTHORIZED)
    expect(error.message).toBe('Custom auth message')
    expect(error.statusCode).toBe(401)
  })

  it('should create auth error with default message', () => {
    const error = createAuthError()

    expect(error.message).toBe('Authentication required')
  })

  it('should create validation error', () => {
    const details = { errors: { email: ['Invalid format'] } }
    const error = createValidationError('Validation failed', details)

    expect(error.code).toBe(ServerErrorCodes.VALIDATION_ERROR)
    expect(error.message).toBe('Validation failed')
    expect(error.statusCode).toBe(422)
    expect(error.details).toEqual(details)
  })

  it('should create not found error', () => {
    const error = createNotFoundError('User')

    expect(error.code).toBe(ServerErrorCodes.RECORD_NOT_FOUND)
    expect(error.message).toBe('User not found')
    expect(error.statusCode).toBe(404)
  })

  it('should create internal error', () => {
    const error = createInternalError('Something went wrong')

    expect(error.code).toBe(ServerErrorCodes.INTERNAL_SERVER_ERROR)
    expect(error.message).toBe('Something went wrong')
    expect(error.statusCode).toBe(500)
  })
})

describe('Error type guards', () => {
  it('should identify ServerError instances', () => {
    const serverError = new ServerError(ServerErrorCodes.VALIDATION_ERROR, 'Test')
    const regularError = new Error('Test')
    const notError = { message: 'Not an error' }

    expect(isServerError(serverError)).toBe(true)
    expect(isServerError(regularError)).toBe(false)
    expect(isServerError(notError)).toBe(false)
  })

  it('should identify validation errors', () => {
    const validationError = createValidationError('Validation failed')
    const authError = createAuthError()

    expect(isValidationError(validationError)).toBe(true)
    expect(isValidationError(authError)).toBe(false)
  })

  it('should identify auth errors', () => {
    const authError = createAuthError()
    const forbiddenError = new ServerError(ServerErrorCodes.FORBIDDEN, 'Forbidden', 403)
    const validationError = createValidationError('Validation failed')

    expect(isAuthError(authError)).toBe(true)
    expect(isAuthError(forbiddenError)).toBe(true)
    expect(isAuthError(validationError)).toBe(false)
  })

  it('should identify database errors', () => {
    const notFoundError = createNotFoundError()
    const dbError = new ServerError(ServerErrorCodes.DATABASE_ERROR, 'DB Error', 500)
    const validationError = createValidationError('Validation failed')

    expect(isDatabaseError(notFoundError)).toBe(true)
    expect(isDatabaseError(dbError)).toBe(true)
    expect(isDatabaseError(validationError)).toBe(false)
  })
})