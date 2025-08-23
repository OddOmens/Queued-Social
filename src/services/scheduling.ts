/**
 * Scheduling Service
 * Core scheduling logic and algorithms for social media posts
 */

import { DatabaseService } from './database'
import { TimeSlotService } from './timeSlots'
import type {
  ScheduledPost,
  PostContent,
  Platform,
  DayOfWeek,
  TimeSlotConfig,
  SchedulingError,
  ErrorCode,
  ValidationResult,
  ValidationError
} from '../types'

export interface SchedulingOptions {
  userId: string
  content: PostContent
  platform: Platform
}

export interface NextSlotOptions extends SchedulingOptions {
  startDate?: Date
  excludeDates?: Date[]
}

export interface CustomTimeOptions extends SchedulingOptions {
  scheduledTime: Date
  allowConflicts?: boolean
}

export interface SchedulingResult {
  success: boolean
  scheduledPost?: ScheduledPost
  suggestedTime?: Date
  conflicts?: ScheduledPost[]
  error?: string
}

export interface ConflictResolution {
  type: 'reschedule' | 'replace' | 'stack'
  targetTime?: Date
  conflictingPost?: ScheduledPost
}

export class SchedulingService {
  private db: DatabaseService
  private timeSlotService: TimeSlotService

  constructor(db?: DatabaseService, timeSlotService?: TimeSlotService) {
    this.db = db || new DatabaseService()
    this.timeSlotService = timeSlotService || new TimeSlotService(this.db)
  }

  /**
   * Schedule a post to the next available time slot
   */
  async scheduleToNextSlot(options: NextSlotOptions): Promise<SchedulingResult> {
    try {
      // Validate content first
      const contentValidation = this.validateContent(options.content, options.platform)
      if (!contentValidation.isValid) {
        return {
          success: false,
          error: `Content validation failed: ${contentValidation.errors.map(e => e.message).join(', ')}`
        }
      }

      // Find the next available slot
      const nextSlot = await this.findNextAvailableSlot(
        options.userId,
        options.startDate,
        options.excludeDates
      )

      if (!nextSlot) {
        return {
          success: false,
          error: 'No available time slots found in the next 14 days'
        }
      }

      // Create the scheduled post
      const scheduledPost = await this.createScheduledPost({
        userId: options.userId,
        platform: options.platform,
        content: options.content,
        scheduledTime: nextSlot,
        status: 'scheduled'
      })

      return {
        success: true,
        scheduledPost
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Schedule a post to a custom time
   */
  async scheduleToCustomTime(options: CustomTimeOptions): Promise<SchedulingResult> {
    try {
      // Validate content first
      const contentValidation = this.validateContent(options.content, options.platform)
      if (!contentValidation.isValid) {
        return {
          success: false,
          error: `Content validation failed: ${contentValidation.errors.map(e => e.message).join(', ')}`
        }
      }

      // Validate the custom time
      const timeValidation = this.validateCustomTime(options.scheduledTime)
      if (!timeValidation.isValid) {
        return {
          success: false,
          error: `Invalid scheduled time: ${timeValidation.errors.map(e => e.message).join(', ')}`
        }
      }

      // Check for conflicts
      const conflicts = await this.detectConflicts(options.userId, options.scheduledTime)
      
      if (conflicts.length > 0 && !options.allowConflicts) {
        // Suggest alternative times
        const suggestedTime = await this.findNextAvailableSlot(
          options.userId,
          options.scheduledTime
        )

        return {
          success: false,
          error: 'Time slot conflict detected',
          conflicts,
          suggestedTime
        }
      }

      // Create the scheduled post
      const scheduledPost = await this.createScheduledPost({
        userId: options.userId,
        platform: options.platform,
        content: options.content,
        scheduledTime: options.scheduledTime,
        status: 'scheduled'
      })

      return {
        success: true,
        scheduledPost,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Find the next available time slot
   */
  async findNextAvailableSlot(
    userId: string,
    startDate?: Date,
    excludeDates?: Date[]
  ): Promise<Date | null> {
    try {
      const timeSlots = await this.timeSlotService.getUserTimeSlots(userId)
      const activeSlots = timeSlots.filter(slot => slot.isActive)
      
      if (activeSlots.length === 0) {
        return null
      }

      const now = startDate || new Date()
      const excludeSet = new Set(excludeDates?.map(d => d.getTime()) || [])

      // Sort slots by day and time for consistent ordering
      const sortedSlots = this.sortTimeSlots(activeSlots)

      // Look up to 14 days ahead
      for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
        const targetDate = new Date(now)
        targetDate.setDate(targetDate.getDate() + daysAhead)
        const targetDay = targetDate.getDay() as DayOfWeek

        const daySlots = sortedSlots.filter(slot => slot.dayOfWeek === targetDay)
        
        for (const slot of daySlots) {
          const slotDateTime = this.createSlotDateTime(targetDate, slot.time)

          // Skip if this slot is in the past
          if (slotDateTime <= now) {
            continue
          }

          // Skip if this date is excluded
          if (excludeSet.has(slotDateTime.getTime())) {
            continue
          }

          // Check if this slot is available
          const isAvailable = await this.isSlotAvailable(userId, slotDateTime)
          if (isAvailable) {
            return slotDateTime
          }
        }
      }

      return null
    } catch (error) {
      throw new Error(`Failed to find next available slot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Detect scheduling conflicts for a given time
   */
  async detectConflicts(userId: string, scheduledTime: Date): Promise<ScheduledPost[]> {
    try {
      // Check for posts scheduled within a 15-minute window
      const startTime = new Date(scheduledTime.getTime() - 15 * 60 * 1000) // 15 minutes before
      const endTime = new Date(scheduledTime.getTime() + 15 * 60 * 1000) // 15 minutes after

      const posts = await this.db.getScheduledPosts(userId, {
        startDate: startTime,
        endDate: endTime,
        status: 'scheduled'
      })

      return posts.filter(post => {
        const timeDiff = Math.abs(post.scheduledTime.getTime() - scheduledTime.getTime())
        return timeDiff < 15 * 60 * 1000 // Within 15 minutes
      })
    } catch (error) {
      throw new Error(`Failed to detect conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Resolve scheduling conflicts
   */
  async resolveConflict(
    userId: string,
    conflictingPost: ScheduledPost,
    resolution: ConflictResolution
  ): Promise<SchedulingResult> {
    try {
      switch (resolution.type) {
        case 'reschedule':
          if (!resolution.targetTime) {
            throw new Error('Target time required for reschedule resolution')
          }
          
          const updatedPost = await this.db.updateScheduledPost(conflictingPost.id, {
            scheduledTime: resolution.targetTime
          })
          
          return {
            success: true,
            scheduledPost: updatedPost
          }

        case 'replace':
          await this.db.deleteScheduledPost(conflictingPost.id)
          return {
            success: true
          }

        case 'stack':
          // For stacking, we allow the conflict and return success
          return {
            success: true,
            scheduledPost: conflictingPost
          }

        default:
          throw new Error('Invalid conflict resolution type')
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Get available time slots for a date range
   */
  async getAvailableSlots(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: Date; available: boolean; conflicts: ScheduledPost[] }[]> {
    try {
      const timeSlots = await this.timeSlotService.getUserTimeSlots(userId)
      const activeSlots = timeSlots.filter(slot => slot.isActive)
      const availableSlots: { date: Date; available: boolean; conflicts: ScheduledPost[] }[] = []

      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay() as DayOfWeek
        const daySlots = activeSlots.filter(slot => slot.dayOfWeek === dayOfWeek)

        for (const slot of daySlots) {
          const slotDateTime = this.createSlotDateTime(currentDate, slot.time)
          const conflicts = await this.detectConflicts(userId, slotDateTime)
          
          availableSlots.push({
            date: new Date(slotDateTime),
            available: conflicts.length === 0,
            conflicts
          })
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }

      return availableSlots
    } catch (error) {
      throw new Error(`Failed to get available slots: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate post content for scheduling
   */
  private validateContent(content: PostContent, platform: Platform): ValidationResult {
    const errors: ValidationError[] = []

    // Basic content validation
    if (!content.text || content.text.trim().length === 0) {
      errors.push({
        field: 'content.text',
        message: 'Post content cannot be empty',
        code: ErrorCode.REQUIRED_FIELD_MISSING,
        value: content.text
      })
    }

    // Platform-specific validation
    switch (platform) {
      case 'threads':
        if (content.type === 'single' && content.text.length > 500) {
          errors.push({
            field: 'content.text',
            message: 'Threads posts cannot exceed 500 characters',
            code: ErrorCode.CONTENT_TOO_LONG,
            value: content.text.length
          })
        }
        
        if (content.type === 'thread' && content.threadPosts) {
          if (content.threadPosts.length > 25) {
            errors.push({
              field: 'content.threadPosts',
              message: 'Threads cannot exceed 25 posts',
              code: ErrorCode.THREAD_TOO_LONG,
              value: content.threadPosts.length
            })
          }
          
          content.threadPosts.forEach((post, index) => {
            if (post.length > 500) {
              errors.push({
                field: `content.threadPosts[${index}]`,
                message: `Thread post ${index + 1} cannot exceed 500 characters`,
                code: ErrorCode.THREAD_POST_TOO_LONG,
                value: post.length
              })
            }
          })
        }
        
        if (content.mediaUrls && content.mediaUrls.length > 10) {
          errors.push({
            field: 'content.mediaUrls',
            message: 'Threads posts cannot have more than 10 media files',
            code: ErrorCode.TOO_MANY_MEDIA_FILES,
            value: content.mediaUrls.length
          })
        }
        break

      // Add validation for other platforms as needed
      default:
        break
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate custom scheduling time
   */
  private validateCustomTime(scheduledTime: Date): ValidationResult {
    const errors: ValidationError[] = []
    const now = new Date()

    // Check if time is in the past
    if (scheduledTime <= now) {
      errors.push({
        field: 'scheduledTime',
        message: 'Scheduled time cannot be in the past',
        code: ErrorCode.INVALID_TIME_SLOT,
        value: scheduledTime
      })
    }

    // Check if time is too far in the future (1 year)
    const oneYearFromNow = new Date()
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
    
    if (scheduledTime > oneYearFromNow) {
      errors.push({
        field: 'scheduledTime',
        message: 'Scheduled time cannot be more than 1 year in the future',
        code: ErrorCode.INVALID_TIME_SLOT,
        value: scheduledTime
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Check if a specific time slot is available
   */
  private async isSlotAvailable(userId: string, slotDateTime: Date): Promise<boolean> {
    try {
      const conflicts = await this.detectConflicts(userId, slotDateTime)
      return conflicts.length === 0
    } catch (error) {
      // If we can't check, assume it's not available to be safe
      return false
    }
  }

  /**
   * Create a scheduled post in the database
   */
  private async createScheduledPost(
    postData: Omit<ScheduledPost, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScheduledPost> {
    try {
      return await this.db.createScheduledPost(postData)
    } catch (error) {
      throw new Error(`Failed to create scheduled post: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Sort time slots by day and time for consistent ordering
   */
  private sortTimeSlots(timeSlots: TimeSlotConfig[]): TimeSlotConfig[] {
    return timeSlots.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek
      }
      return a.time.localeCompare(b.time)
    })
  }

  /**
   * Create a DateTime object from a date and time string
   */
  private createSlotDateTime(date: Date, time: string): Date {
    const slotDateTime = new Date(date)
    const [hours, minutes] = time.split(':').map(Number)
    slotDateTime.setHours(hours, minutes, 0, 0)
    return slotDateTime
  }

  /**
   * Get scheduling statistics for a user
   */
  async getSchedulingStats(userId: string): Promise<{
    totalSlots: number
    activeSlots: number
    scheduledPosts: number
    availableSlots: number
    nextAvailableSlot: Date | null
  }> {
    try {
      const timeSlots = await this.timeSlotService.getUserTimeSlots(userId)
      const scheduledPosts = await this.db.getScheduledPosts(userId, { status: 'scheduled' })
      const nextSlot = await this.findNextAvailableSlot(userId)

      // Calculate available slots for the next 7 days
      const weekFromNow = new Date()
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      
      const availableSlots = await this.getAvailableSlots(userId, new Date(), weekFromNow)
      const availableCount = availableSlots.filter(slot => slot.available).length

      return {
        totalSlots: timeSlots.length,
        activeSlots: timeSlots.filter(slot => slot.isActive).length,
        scheduledPosts: scheduledPosts.length,
        availableSlots: availableCount,
        nextAvailableSlot: nextSlot
      }
    } catch (error) {
      throw new Error(`Failed to get scheduling stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Export singleton instance
export const schedulingService = new SchedulingService()