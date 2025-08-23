/**
 * Time Slot Validation Utilities
 * Provides validation functions for time slot data and conflict detection
 */

import type {
  TimeSlotRequest,
  TimeSlotConfig,
  ValidationResult,
  ValidationError,
  ErrorCode,
  DayOfWeek
} from '../types'

/**
 * Validate a single time slot
 */
export function validateTimeSlot(timeSlot: Partial<TimeSlotRequest>): ValidationResult {
  const errors: ValidationError[] = []

  // Validate day of week
  if (timeSlot.dayOfWeek === undefined || timeSlot.dayOfWeek === null) {
    errors.push({
      field: 'dayOfWeek',
      message: 'Day of week is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: timeSlot.dayOfWeek
    })
  } else if (!isValidDayOfWeek(timeSlot.dayOfWeek)) {
    errors.push({
      field: 'dayOfWeek',
      message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      code: ErrorCode.INVALID_DAY_OF_WEEK,
      value: timeSlot.dayOfWeek
    })
  }

  // Validate time format
  if (!timeSlot.time) {
    errors.push({
      field: 'time',
      message: 'Time is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: timeSlot.time
    })
  } else if (!isValidTimeFormat(timeSlot.time)) {
    errors.push({
      field: 'time',
      message: 'Time must be in HH:MM format (24-hour)',
      code: ErrorCode.INVALID_TIME_FORMAT,
      value: timeSlot.time
    })
  }

  // Validate timezone
  if (!timeSlot.timezone) {
    errors.push({
      field: 'timezone',
      message: 'Timezone is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING,
      value: timeSlot.timezone
    })
  } else if (!isValidTimezone(timeSlot.timezone)) {
    errors.push({
      field: 'timezone',
      message: 'Invalid timezone format',
      code: ErrorCode.INVALID_TIMEZONE,
      value: timeSlot.timezone
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate time slot conflicts with existing slots
 */
export function validateTimeSlotConflicts(
  newTimeSlot: TimeSlotRequest,
  existingTimeSlots: TimeSlotConfig[]
): ValidationResult {
  const errors: ValidationError[] = []

  // Check for duplicate time slots on the same day
  const conflictingSlots = existingTimeSlots.filter(
    existing => 
      existing.dayOfWeek === newTimeSlot.dayOfWeek &&
      existing.time === newTimeSlot.time &&
      existing.timezone === newTimeSlot.timezone &&
      existing.isActive
  )

  if (conflictingSlots.length > 0) {
    errors.push({
      field: 'time',
      message: `A time slot already exists for ${getDayName(newTimeSlot.dayOfWeek)} at ${newTimeSlot.time} (${newTimeSlot.timezone})`,
      code: ErrorCode.DUPLICATE_TIME_SLOT,
      value: newTimeSlot.time
    })
  }

  // Check for overlapping time slots (within 15 minutes)
  const overlappingSlots = existingTimeSlots.filter(existing => {
    if (existing.dayOfWeek !== newTimeSlot.dayOfWeek || !existing.isActive) {
      return false
    }

    const newTime = parseTimeToMinutes(newTimeSlot.time)
    const existingTime = parseTimeToMinutes(existing.time)
    const timeDifference = Math.abs(newTime - existingTime)

    // Consider slots overlapping if they're within 15 minutes of each other
    return timeDifference < 15
  })

  if (overlappingSlots.length > 0) {
    const overlappingSlot = overlappingSlots[0]
    errors.push({
      field: 'time',
      message: `Time slot conflicts with existing slot at ${overlappingSlot.time}. Slots must be at least 15 minutes apart.`,
      code: ErrorCode.TIME_SLOT_CONFLICT,
      value: newTimeSlot.time
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate multiple time slots for bulk operations
 */
export function validateTimeSlotBatch(timeSlots: TimeSlotRequest[]): ValidationResult {
  const errors: ValidationError[] = []

  // Validate each individual time slot
  timeSlots.forEach((slot, index) => {
    const validation = validateTimeSlot(slot)
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        errors.push({
          ...error,
          field: `timeSlots[${index}].${error.field}`,
          message: `Slot ${index + 1}: ${error.message}`
        })
      })
    }
  })

  // Check for conflicts within the batch
  for (let i = 0; i < timeSlots.length; i++) {
    for (let j = i + 1; j < timeSlots.length; j++) {
      const slot1 = timeSlots[i]
      const slot2 = timeSlots[j]

      if (slot1.dayOfWeek === slot2.dayOfWeek) {
        // Check for exact duplicates
        if (slot1.time === slot2.time && slot1.timezone === slot2.timezone) {
          errors.push({
            field: `timeSlots[${j}].time`,
            message: `Duplicate time slot: ${getDayName(slot1.dayOfWeek)} at ${slot1.time}`,
            code: ErrorCode.DUPLICATE_TIME_SLOT,
            value: slot2.time
          })
        }

        // Check for overlapping times
        const time1 = parseTimeToMinutes(slot1.time)
        const time2 = parseTimeToMinutes(slot2.time)
        const timeDifference = Math.abs(time1 - time2)

        if (timeDifference < 15) {
          errors.push({
            field: `timeSlots[${j}].time`,
            message: `Time slots ${i + 1} and ${j + 1} conflict on ${getDayName(slot1.dayOfWeek)}. Slots must be at least 15 minutes apart.`,
            code: ErrorCode.TIME_SLOT_CONFLICT,
            value: slot2.time
          })
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Helper function to check if day of week is valid
 */
function isValidDayOfWeek(day: any): day is DayOfWeek {
  return typeof day === 'number' && day >= 0 && day <= 6 && Number.isInteger(day)
}

/**
 * Helper function to validate time format (HH:MM)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  if (!timeRegex.test(time)) {
    return false
  }

  const [hours, minutes] = time.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/**
 * Helper function to validate timezone
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // Try to create a date with the timezone to validate it
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/**
 * Helper function to convert time string to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Helper function to get day name from day of week number
 */
function getDayName(dayOfWeek: DayOfWeek): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayOfWeek]
}

/**
 * Helper function to format time for display
 */
export function formatTimeForDisplay(time: string, use12Hour = false): string {
  if (!isValidTimeFormat(time)) {
    return time
  }

  if (!use12Hour) {
    return time
  }

  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Helper function to convert 12-hour time to 24-hour format
 */
export function convertTo24Hour(time: string, period: 'AM' | 'PM'): string {
  const [hours, minutes] = time.split(':').map(Number)
  let convertedHours = hours

  if (period === 'AM' && hours === 12) {
    convertedHours = 0
  } else if (period === 'PM' && hours !== 12) {
    convertedHours = hours + 12
  }

  return `${convertedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Helper function to get available timezones
 */
export function getCommonTimezones(): { value: string; label: string }[] {
  return [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKST)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
    { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
    { value: 'Europe/Rome', label: 'Central European Time (CET)' },
    { value: 'Europe/Madrid', label: 'Central European Time (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
    { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
    { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
    { value: 'Australia/Melbourne', label: 'Australian Eastern Time (AET)' },
    { value: 'Australia/Perth', label: 'Australian Western Time (AWT)' }
  ]
}