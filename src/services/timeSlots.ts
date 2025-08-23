/**
 * Time Slot Service
 * Handles CRUD operations and business logic for time slots
 */

import { DatabaseService } from './database'
import type {
  TimeSlotConfig,
  TimeSlotRequest,
  DayOfWeek,
  ValidationResult,
  ErrorCode,
  ValidationError
} from '../types'
import { validateTimeSlot, validateTimeSlotConflicts } from '../utils/timeSlotValidation'

export class TimeSlotService {
  private db: DatabaseService

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService()
  }

  /**
   * Get all time slots for a user
   */
  async getUserTimeSlots(userId: string): Promise<TimeSlotConfig[]> {
    try {
      return await this.db.getTimeSlots(userId)
    } catch (error) {
      throw new Error(`Failed to get user time slots: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get time slots for a specific day
   */
  async getTimeSlotsForDay(userId: string, dayOfWeek: DayOfWeek): Promise<TimeSlotConfig[]> {
    try {
      const allSlots = await this.db.getTimeSlots(userId)
      return allSlots.filter(slot => slot.dayOfWeek === dayOfWeek && slot.isActive)
    } catch (error) {
      throw new Error(`Failed to get time slots for day: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new time slot
   */
  async createTimeSlot(userId: string, timeSlotData: TimeSlotRequest): Promise<TimeSlotConfig> {
    // Validate the time slot data
    const validation = validateTimeSlot(timeSlotData)
    if (!validation.isValid) {
      throw new Error(`Invalid time slot data: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    // Check for conflicts with existing time slots
    const existingSlots = await this.getTimeSlotsForDay(userId, timeSlotData.dayOfWeek)
    const conflictValidation = validateTimeSlotConflicts(timeSlotData, existingSlots)
    if (!conflictValidation.isValid) {
      throw new Error(`Time slot conflict: ${conflictValidation.errors.map(e => e.message).join(', ')}`)
    }

    try {
      const newTimeSlot: Omit<TimeSlotConfig, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        dayOfWeek: timeSlotData.dayOfWeek,
        time: timeSlotData.time,
        timezone: timeSlotData.timezone,
        isActive: timeSlotData.isActive ?? true
      }

      return await this.db.createTimeSlot(newTimeSlot)
    } catch (error) {
      throw new Error(`Failed to create time slot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update an existing time slot
   */
  async updateTimeSlot(
    userId: string, 
    timeSlotId: string, 
    updates: Partial<TimeSlotRequest>
  ): Promise<TimeSlotConfig> {
    // Validate the updates
    if (Object.keys(updates).length === 0) {
      throw new Error('No updates provided')
    }

    // If updating time or day, validate the new values
    if (updates.time !== undefined || updates.dayOfWeek !== undefined) {
      const validation = validateTimeSlot(updates as TimeSlotRequest)
      if (!validation.isValid) {
        throw new Error(`Invalid time slot updates: ${validation.errors.map(e => e.message).join(', ')}`)
      }

      // Check for conflicts if changing time or day
      if (updates.dayOfWeek !== undefined) {
        const existingSlots = await this.getTimeSlotsForDay(userId, updates.dayOfWeek)
        // Filter out the current slot being updated
        const otherSlots = existingSlots.filter(slot => slot.id !== timeSlotId)
        
        const testSlot: TimeSlotRequest = {
          dayOfWeek: updates.dayOfWeek,
          time: updates.time || '12:00', // Default time for validation
          timezone: updates.timezone || 'UTC'
        }
        
        const conflictValidation = validateTimeSlotConflicts(testSlot, otherSlots)
        if (!conflictValidation.isValid) {
          throw new Error(`Time slot conflict: ${conflictValidation.errors.map(e => e.message).join(', ')}`)
        }
      }
    }

    try {
      return await this.db.updateTimeSlot(timeSlotId, updates)
    } catch (error) {
      throw new Error(`Failed to update time slot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a time slot
   */
  async deleteTimeSlot(timeSlotId: string): Promise<void> {
    try {
      await this.db.deleteTimeSlot(timeSlotId)
    } catch (error) {
      throw new Error(`Failed to delete time slot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Bulk update time slots for a user
   * This replaces all existing time slots with the provided ones
   */
  async bulkUpdateTimeSlots(userId: string, timeSlots: TimeSlotRequest[]): Promise<TimeSlotConfig[]> {
    // Validate all time slots
    const validationErrors: string[] = []
    
    for (let i = 0; i < timeSlots.length; i++) {
      const validation = validateTimeSlot(timeSlots[i])
      if (!validation.isValid) {
        validationErrors.push(`Slot ${i + 1}: ${validation.errors.map(e => e.message).join(', ')}`)
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(`Validation errors: ${validationErrors.join('; ')}`)
    }

    // Check for conflicts within the new set
    const conflictErrors: string[] = []
    const slotsByDay = new Map<DayOfWeek, TimeSlotRequest[]>()
    
    // Group slots by day
    timeSlots.forEach(slot => {
      if (!slotsByDay.has(slot.dayOfWeek)) {
        slotsByDay.set(slot.dayOfWeek, [])
      }
      slotsByDay.get(slot.dayOfWeek)!.push(slot)
    })

    // Check for conflicts within each day
    slotsByDay.forEach((daySlots, dayOfWeek) => {
      for (let i = 0; i < daySlots.length; i++) {
        const otherSlots = daySlots.filter((_, index) => index !== i)
        const conflictValidation = validateTimeSlotConflicts(daySlots[i], otherSlots.map(slot => ({
          id: 'temp',
          userId,
          dayOfWeek: slot.dayOfWeek,
          time: slot.time,
          timezone: slot.timezone,
          isActive: slot.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date()
        })))
        
        if (!conflictValidation.isValid) {
          conflictErrors.push(`Day ${dayOfWeek}, slot ${i + 1}: ${conflictValidation.errors.map(e => e.message).join(', ')}`)
        }
      }
    })

    if (conflictErrors.length > 0) {
      throw new Error(`Conflict errors: ${conflictErrors.join('; ')}`)
    }

    try {
      // Get existing time slots
      const existingSlots = await this.getUserTimeSlots(userId)
      
      // Delete all existing time slots
      await Promise.all(existingSlots.map(slot => this.db.deleteTimeSlot(slot.id)))
      
      // Create new time slots
      const newSlots = await Promise.all(
        timeSlots.map(slot => this.createTimeSlot(userId, slot))
      )
      
      return newSlots
    } catch (error) {
      throw new Error(`Failed to bulk update time slots: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get the next available time slot for scheduling
   */
  async getNextAvailableSlot(userId: string, startDate?: Date): Promise<Date | null> {
    try {
      const timeSlots = await this.getUserTimeSlots(userId)
      const activeSlots = timeSlots.filter(slot => slot.isActive)
      
      if (activeSlots.length === 0) {
        return null
      }

      const now = startDate || new Date()
      const currentDay = now.getDay() as DayOfWeek
      const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

      // Sort slots by day and time
      const sortedSlots = activeSlots.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) {
          return a.dayOfWeek - b.dayOfWeek
        }
        return a.time.localeCompare(b.time)
      })

      // Find the next available slot
      for (let daysAhead = 0; daysAhead < 14; daysAhead++) { // Look up to 2 weeks ahead
        const targetDate = new Date(now)
        targetDate.setDate(targetDate.getDate() + daysAhead)
        const targetDay = targetDate.getDay() as DayOfWeek

        const daySlots = sortedSlots.filter(slot => slot.dayOfWeek === targetDay)
        
        for (const slot of daySlots) {
          const slotDateTime = new Date(targetDate)
          const [hours, minutes] = slot.time.split(':').map(Number)
          slotDateTime.setHours(hours, minutes, 0, 0)

          // Skip if this slot is in the past
          if (slotDateTime <= now) {
            continue
          }

          // Check if this slot is already occupied
          const isOccupied = await this.isSlotOccupied(userId, slotDateTime)
          if (!isOccupied) {
            return slotDateTime
          }
        }
      }

      return null // No available slots found
    } catch (error) {
      throw new Error(`Failed to get next available slot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if a specific time slot is occupied by a scheduled post
   */
  private async isSlotOccupied(userId: string, slotDateTime: Date): Promise<boolean> {
    try {
      // Get scheduled posts for the specific time
      const posts = await this.db.getScheduledPosts(userId, {
        startDate: slotDateTime,
        endDate: slotDateTime,
        status: 'scheduled'
      })
      
      return posts.length > 0
    } catch (error) {
      // If we can't check, assume it's not occupied to be safe
      return false
    }
  }

  /**
   * Get available time slots for a specific date range
   */
  async getAvailableSlots(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<{ date: Date; available: boolean }[]> {
    try {
      const timeSlots = await this.getUserTimeSlots(userId)
      const activeSlots = timeSlots.filter(slot => slot.isActive)
      const availableSlots: { date: Date; available: boolean }[] = []

      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay() as DayOfWeek
        const daySlots = activeSlots.filter(slot => slot.dayOfWeek === dayOfWeek)

        for (const slot of daySlots) {
          const slotDateTime = new Date(currentDate)
          const [hours, minutes] = slot.time.split(':').map(Number)
          slotDateTime.setHours(hours, minutes, 0, 0)

          const isOccupied = await this.isSlotOccupied(userId, slotDateTime)
          availableSlots.push({
            date: new Date(slotDateTime),
            available: !isOccupied
          })
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }

      return availableSlots
    } catch (error) {
      throw new Error(`Failed to get available slots: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Export singleton instance
export const timeSlotService = new TimeSlotService()