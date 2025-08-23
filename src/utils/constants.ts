// Application constants

export const PLATFORMS = {
  THREADS: 'threads',
  // Future platforms can be added here
} as const

export const POST_STATUS = {
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export const CONTENT_TYPES = {
  SINGLE: 'single',
  THREAD: 'thread',
  MEDIA: 'media',
} as const

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const DEFAULT_TIMEZONE = 'UTC'