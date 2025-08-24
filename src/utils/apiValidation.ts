/**
 * API Validation Utilities
 * Common validation functions for API endpoints
 */

import type { PostContent, Platform, ValidationResult, ValidationError } from '../types'
import { ErrorCode } from '../types'

/**
 * Validate post content for API requests
 */
export function validatePostContent(content: any): ValidationResult {
  const errors: ValidationError[] = []

  if (!content) {
    errors.push({
      field: 'content',
      message: 'Content is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: content
    })
    return { isValid: false, errors }
  }

  if (!content.text || typeof content.text !== 'string') {
    errors.push({
      field: 'content.text',
      message: 'Content text is required and must be a string',
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: content.text
    })
  }

  if (content.text && content.text.trim().length === 0) {
    errors.push({
      field: 'content.text',
      message: 'Content text cannot be empty',
      code: ErrorCode.CONTENT_TOO_SHORT,
      value: content.text
    })
  }

  if (!content.type) {
    errors.push({
      field: 'content.type',
      message: 'Content type is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: content.type
    })
  } else {
    const validTypes = ['single', 'thread', 'media']
    if (!validTypes.includes(content.type)) {
      errors.push({
        field: 'content.type',
        message: `Invalid content type. Must be one of: ${validTypes.join(', ')}`,
        code: ErrorCode.VALIDATION_ERROR,
        value: content.type
      })
    }
  }

  // Validate thread-specific fields
  if (content.type === 'thread') {
    if (!content.threadPosts || !Array.isArray(content.threadPosts)) {
      errors.push({
        field: 'content.threadPosts',
        message: 'Thread posts array is required for thread content',
        code: ErrorCode.REQUIRED_FIELD_MISSING,
        value: content.threadPosts
      })
    } else {
      content.threadPosts.forEach((post: any, index: number) => {
        if (typeof post !== 'string') {
          errors.push({
            field: `content.threadPosts[${index}]`,
            message: `Thread post ${index + 1} must be a string`,
            code: ErrorCode.VALIDATION_ERROR,
            value: post
          })
        }
      })
    }
  }

  // Validate media-specific fields
  if (content.type === 'media') {
    if (content.mediaUrls && !Array.isArray(content.mediaUrls)) {
      errors.push({
        field: 'content.mediaUrls',
        message: 'Media URLs must be an array',
        code: ErrorCode.VALIDATION_ERROR,
        value: content.mediaUrls
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate platform parameter
 */
export function validatePlatform(platform: any): ValidationResult {
  const errors: ValidationError[] = []

  if (!platform) {
    errors.push({
      field: 'platform',
      message: 'Platform is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: platform
    })
    return { isValid: false, errors }
  }

  const validPlatforms: Platform[] = ['threads', 'twitter', 'instagram', 'linkedin']
  if (!validPlatforms.includes(platform)) {
    errors.push({
      field: 'platform',
      message: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`,
      code: ErrorCode.VALIDATION_ERROR,
      value: platform
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate date string and convert to Date object
 */
export function validateAndParseDate(dateString: any, fieldName: string): {
  isValid: boolean
  date?: Date
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []

  if (!dateString) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: dateString
    })
    return { isValid: false, errors }
  }

  if (typeof dateString !== 'string') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a string`,
      code: ErrorCode.VALIDATION_ERROR,
      value: dateString
    })
    return { isValid: false, errors }
  }

  let date: Date
  try {
    date = new Date(dateString)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
  } catch (error) {
    errors.push({
      field: fieldName,
      message: `Invalid ${fieldName} format. Must be a valid ISO date string.`,
      code: ErrorCode.VALIDATION_ERROR,
      value: dateString
    })
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    date,
    errors: []
  }
}

/**
 * Validate that a date is not in the past
 */
export function validateFutureDate(date: Date, fieldName: string): ValidationResult {
  const errors: ValidationError[] = []
  const now = new Date()

  if (date <= now) {
    errors.push({
      field: fieldName,
      message: `${fieldName} cannot be in the past`,
      code: ErrorCode.INVALID_TIME_SLOT,
      value: date
    })
  }

  // Check if date is too far in the future (1 year)
  const oneYearFromNow = new Date()
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
  
  if (date > oneYearFromNow) {
    errors.push({
      field: fieldName,
      message: `${fieldName} cannot be more than 1 year in the future`,
      code: ErrorCode.INVALID_TIME_SLOT,
      value: date
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate array of date strings
 */
export function validateDateArray(dateStrings: any, fieldName: string): {
  isValid: boolean
  dates?: Date[]
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []

  if (!Array.isArray(dateStrings)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be an array`,
      code: ErrorCode.VALIDATION_ERROR,
      value: dateStrings
    })
    return { isValid: false, errors }
  }

  const dates: Date[] = []
  
  dateStrings.forEach((dateString: any, index: number) => {
    const validation = validateAndParseDate(dateString, `${fieldName}[${index}]`)
    if (!validation.isValid) {
      errors.push(...validation.errors)
    } else if (validation.date) {
      dates.push(validation.date)
    }
  })

  return {
    isValid: errors.length === 0,
    dates: errors.length === 0 ? dates : undefined,
    errors
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number = 400,
  details?: any
) {
  return {
    success: false as const,
    error: {
      code,
      message,
      details,
      timestamp: new Date()
    }
  }
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  warnings?: string[]
) {
  const response: any = {
    success: true as const,
    data
  }

  if (message) {
    response.message = message
  }

  if (warnings && warnings.length > 0) {
    response.warnings = warnings
  }

  return response
}

/**
 * Validate request body structure
 */
export function validateRequestBody(body: any, requiredFields: string[]): ValidationResult {
  const errors: ValidationError[] = []

  if (!body || typeof body !== 'object') {
    errors.push({
      field: 'body',
      message: 'Request body must be a valid JSON object',
      code: ErrorCode.VALIDATION_ERROR,
      value: body
    })
    return { isValid: false, errors }
  }

  requiredFields.forEach(field => {
    if (!(field in body) || body[field] === undefined || body[field] === null) {
      errors.push({
        field,
        message: `${field} is required`,
        code: ErrorCode.REQUIRED_FIELD_MISSING,
        value: body[field]
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Combine multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: ValidationError[] = []
  
  results.forEach(result => {
    if (!result.isValid) {
      allErrors.push(...result.errors)
    }
  })

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  }
}