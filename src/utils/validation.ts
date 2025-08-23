// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

import {
  PostContent,
  Platform,
  ValidationResult,
  ValidationError,
  THREADS_VALIDATION_SCHEMA,
  THREADS_THREAD_VALIDATION_SCHEMA,
  TIME_SLOT_VALIDATION_SCHEMA,
  TimeSlotRequest,
  DayOfWeek,
  ErrorCode
} from '../types'

// ============================================================================
// CONTENT VALIDATION
// ============================================================================

export function validatePostContent(content: PostContent, platform: Platform): ValidationResult {
  const errors: ValidationError[] = []
  
  // Get platform-specific validation schema
  let schema = THREADS_VALIDATION_SCHEMA
  if (platform === 'threads' && content.type === 'thread') {
    schema = THREADS_THREAD_VALIDATION_SCHEMA
  }
  
  // Run all validation rules
  for (const rule of schema.rules) {
    const fieldValue = (content as any)[rule.field]
    const result = rule.validator(fieldValue)
    
    if (!result.isValid) {
      errors.push(...result.errors)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ============================================================================
// TIME SLOT VALIDATION
// ============================================================================

export function validateTimeSlot(timeSlot: TimeSlotRequest): ValidationResult {
  const errors: ValidationError[] = []
  
  // Run all validation rules
  for (const rule of TIME_SLOT_VALIDATION_SCHEMA.rules) {
    const fieldValue = (timeSlot as any)[rule.field]
    const result = rule.validator(fieldValue)
    
    if (!result.isValid) {
      errors.push(...result.errors)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateTimeSlotConflicts(
  newSlot: TimeSlotRequest,
  existingSlots: TimeSlotRequest[]
): ValidationResult {
  const errors: ValidationError[] = []
  
  // Check for conflicts on the same day
  const conflictingSlots = existingSlots.filter(
    slot => slot.dayOfWeek === newSlot.dayOfWeek && slot.time === newSlot.time
  )
  
  if (conflictingSlots.length > 0) {
    errors.push({
      field: 'time',
      message: `Time slot ${newSlot.time} already exists for this day`,
      code: ErrorCode.TIME_SLOT_CONFLICT,
      value: newSlot.time
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.map(error => `${error.field}: ${error.message}`)
}

export function hasValidationErrors(result: ValidationResult): boolean {
  return !result.isValid && result.errors.length > 0
}

export function getFirstValidationError(result: ValidationResult): string | null {
  if (result.errors.length === 0) return null
  return result.errors[0].message
}

// ============================================================================
// PLATFORM-SPECIFIC VALIDATION HELPERS
// ============================================================================

export function validateThreadsPost(content: PostContent): ValidationResult {
  return validatePostContent(content, 'threads')
}

export function canScheduleToTimeSlot(
  scheduledTime: Date,
  timeSlots: Array<{ dayOfWeek: DayOfWeek; time: string; isActive: boolean }>
): boolean {
  const dayOfWeek = scheduledTime.getDay() as DayOfWeek
  const timeString = scheduledTime.toTimeString().slice(0, 5) // HH:MM format
  
  return timeSlots.some(
    slot => slot.dayOfWeek === dayOfWeek && 
            slot.time === timeString && 
            slot.isActive
  )
}