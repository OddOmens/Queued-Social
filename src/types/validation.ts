// ============================================================================
// VALIDATION TYPES AND SCHEMAS
// ============================================================================

import { PostContent, Platform, PostContentType, DayOfWeek, ValidationError, ErrorCode } from './index'

// ============================================================================
// VALIDATION RULE TYPES
// ============================================================================

export type ValidatorFunction<T = any> = (value: T) => ValidationResult

export interface ValidationRule<T = any> {
  field: string
  validator: ValidatorFunction<T>
  required?: boolean
  message?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings?: ValidationWarning[]
}

// ValidationError is imported from index.ts

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

// ============================================================================
// CONTENT VALIDATION SCHEMAS
// ============================================================================

export interface PostContentValidationSchema {
  platform: Platform
  contentType: PostContentType
  rules: ValidationRule[]
}

export interface MediaValidationSchema {
  maxFileSize: number // bytes
  allowedMimeTypes: string[]
  maxDimensions?: {
    width: number
    height: number
  }
  minDimensions?: {
    width: number
    height: number
  }
  maxDuration?: number // seconds for video
}

export interface TextValidationSchema {
  minLength?: number
  maxLength: number
  allowedCharacters?: RegExp
  forbiddenPatterns?: RegExp[]
  requireHashtags?: boolean
  maxHashtags?: number
  maxMentions?: number
}

export interface ThreadValidationSchema {
  maxThreadLength: number
  minPostsRequired?: number
  allowEmptyPosts?: boolean
  requireConnectedPosts?: boolean
}

// ============================================================================
// PLATFORM-SPECIFIC VALIDATION SCHEMAS
// ============================================================================

export const THREADS_VALIDATION_SCHEMA: PostContentValidationSchema = {
  platform: 'threads',
  contentType: 'single',
  rules: [
    {
      field: 'text',
      validator: (text: string) => ({
        isValid: text.length <= 500,
        errors: text.length > 500 ? [{
          field: 'text',
          message: 'Text exceeds 500 character limit for Threads',
          code: ErrorCode.CONTENT_TOO_LONG,
          value: text.length
        }] : []
      }),
      required: true,
      message: 'Text content is required'
    },
    {
      field: 'mediaUrls',
      validator: (urls: string[] = []) => ({
        isValid: urls.length <= 10,
        errors: urls.length > 10 ? [{
          field: 'mediaUrls',
          message: 'Maximum 10 media files allowed for Threads',
          code: ErrorCode.TOO_MANY_MEDIA_FILES,
          value: urls.length
        }] : []
      }),
      required: false
    }
  ]
}

export const THREADS_THREAD_VALIDATION_SCHEMA: PostContentValidationSchema = {
  platform: 'threads',
  contentType: 'thread',
  rules: [
    {
      field: 'threadPosts',
      validator: (posts: string[] = []) => {
        const errors: ValidationError[] = []
        
        if (posts.length === 0) {
          errors.push({
            field: 'threadPosts',
            message: 'Thread must contain at least one post',
            code: ErrorCode.EMPTY_THREAD
          })
        }
        
        if (posts.length > 20) {
          errors.push({
            field: 'threadPosts',
            message: 'Thread cannot exceed 20 posts',
            code: ErrorCode.THREAD_TOO_LONG,
            value: posts.length
          })
        }
        
        posts.forEach((post, index) => {
          if (post.length > 500) {
            errors.push({
              field: `threadPosts[${index}]`,
              message: `Post ${index + 1} exceeds 500 character limit`,
              code: ErrorCode.THREAD_POST_TOO_LONG,
              value: post.length
            })
          }
        })
        
        return {
          isValid: errors.length === 0,
          errors
        }
      },
      required: true
    }
  ]
}

// ============================================================================
// TIME SLOT VALIDATION
// ============================================================================

export interface TimeSlotValidationSchema {
  rules: ValidationRule[]
}

export const TIME_SLOT_VALIDATION_SCHEMA: TimeSlotValidationSchema = {
  rules: [
    {
      field: 'dayOfWeek',
      validator: (day: DayOfWeek) => ({
        isValid: day >= 0 && day <= 6,
        errors: (day < 0 || day > 6) ? [{
          field: 'dayOfWeek',
          message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
          code: ErrorCode.INVALID_DAY_OF_WEEK,
          value: day
        }] : []
      }),
      required: true
    },
    {
      field: 'time',
      validator: (time: string) => {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
        return {
          isValid: timeRegex.test(time),
          errors: !timeRegex.test(time) ? [{
            field: 'time',
            message: 'Time must be in HH:MM format (24-hour)',
            code: ErrorCode.INVALID_TIME_FORMAT,
            value: time
          }] : []
        }
      },
      required: true
    },
    {
      field: 'timezone',
      validator: (timezone: string) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone })
          return { isValid: true, errors: [] }
        } catch {
          return {
            isValid: false,
            errors: [{
              field: 'timezone',
              message: 'Invalid timezone identifier',
              code: ErrorCode.INVALID_TIMEZONE,
              value: timezone
            }]
          }
        }
      },
      required: true
    }
  ]
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export interface ValidationContext {
  platform: Platform
  contentType: PostContentType
  userTimezone: string
  existingTimeSlots?: Array<{ dayOfWeek: DayOfWeek; time: string }>
}

export interface ValidatorRegistry {
  registerValidator(platform: Platform, contentType: PostContentType, schema: PostContentValidationSchema): void
  getValidator(platform: Platform, contentType: PostContentType): PostContentValidationSchema | null
  validateContent(content: PostContent, context: ValidationContext): ValidationResult
}

// ============================================================================
// CUSTOM VALIDATION FUNCTIONS
// ============================================================================

export const createTextLengthValidator = (maxLength: number, minLength = 0): ValidatorFunction<string> => {
  return (text: string) => {
    const errors: ValidationError[] = []
    
    if (text.length < minLength) {
      errors.push({
        field: 'text',
        message: `Text must be at least ${minLength} characters`,
        code: ErrorCode.CONTENT_TOO_SHORT,
        value: text.length
      })
    }
    
    if (text.length > maxLength) {
      errors.push({
        field: 'text',
        message: `Text cannot exceed ${maxLength} characters`,
        code: ErrorCode.CONTENT_TOO_LONG,
        value: text.length
      })
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

export const createMediaCountValidator = (maxCount: number): ValidatorFunction<string[]> => {
  return (mediaUrls: string[] = []) => ({
    isValid: mediaUrls.length <= maxCount,
    errors: mediaUrls.length > maxCount ? [{
      field: 'mediaUrls',
      message: `Maximum ${maxCount} media files allowed`,
      code: ErrorCode.TOO_MANY_MEDIA_FILES,
      value: mediaUrls.length
    }] : []
  })
}

export const createRequiredFieldValidator = (fieldName: string): ValidatorFunction => {
  return (value: any) => ({
    isValid: value !== null && value !== undefined && value !== '',
    errors: (!value) ? [{
      field: fieldName,
      message: `${fieldName} is required`,
      code: ErrorCode.REQUIRED_FIELD_MISSING
    }] : []
  })
}