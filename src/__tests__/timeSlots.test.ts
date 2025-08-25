/**
 * Unit tests for Time Slot Service and Validation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { TimeSlotService } from '../services/timeSlots'
import { DatabaseService } from '../services/database'
import {
  validateTimeSlot,
  validateTimeSlotConflicts,
  validateTimeSlotBatch,
  formatTimeForDisplay,
  convertTo24Hour
} from '../utils/timeSlotValidation'
import type {
  TimeSlotConfig,
  TimeSlotRequest,
  DayOfWeek,
  ErrorCode
} from '../types'

// Mock the database service
vi.mock('../services/database')

describe('Time Slot Validation', () => {
  describe('validateTimeSlot', () => {
    it('should validate a correct time slot', () => {
      const timeSlot: TimeSlotRequest = {
        dayOfWeek: 1, // Monday
        time: '09:00',
        timezone: 'UTC'
      }

      const result = validateTimeSlot(timeSlot)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid day of week', () => {
      const timeSlot: TimeSlotRequest = {
        dayOfWeek: 7 as DayOfWeek, // Invalid
        time: '09:00',
        timezone: 'UTC'
      }

      const result = validateTimeSlot(timeSlot)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_DAY_OF_WEEK')
    })

    it('should reject invalid time format', () => {
      const timeSlot: TimeSlotRequest = {
        dayOfWeek: 1,
        time: '25:00', // Invalid hour
        timezone: 'UTC'
      }

      const result = validateTimeSlot(timeSlot)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_TIME_FORMAT')
    })

    it('should reject missing required fields', () => {
      const timeSlot: Partial<TimeSlotRequest> = {
        dayOfWeek: 1
        // Missing time and timezone
      }

      const result = validateTimeSlot(timeSlot)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors.some(e => e.code === 'REQUIRED_FIELD_MISSING')).toBe(true)
    })

    it('should accept valid timezone formats', () => {
      const validTimezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']
      
      validTimezones.forEach(timezone => {
        const timeSlot: TimeSlotRequest = {
          dayOfWeek: 1,
          time: '09:00',
          timezone
        }

        const result = validateTimeSlot(timeSlot)
        expect(result.isValid).toBe(true)
      })
    })
  })

  describe('validateTimeSlotConflicts', () => {
    const existingSlots: TimeSlotConfig[] = [
      {
        id: '1',
        userId: 'user1',
        dayOfWeek: 1, // Monday
        time: '09:00',
        timezone: 'UTC',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        userId: 'user1',
        dayOfWeek: 1, // Monday
        time: '15:00',
        timezone: 'UTC',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    it('should allow non-conflicting time slots', () => {
      const newTimeSlot: TimeSlotRequest = {
        dayOfWeek: 1, // Monday
        time: '12:00', // No conflict
        timezone: 'UTC'
      }

      const result = validateTimeSlotConflicts(newTimeSlot, existingSlots)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject exact duplicate time slots', () => {
      const newTimeSlot: TimeSlotRequest = {
        dayOfWeek: 1, // Monday
        time: '09:00', // Exact duplicate
        timezone: 'UTC'
      }

      const result = validateTimeSlotConflicts(newTimeSlot, existingSlots)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors.some(e => e.code === 'DUPLICATE_TIME_SLOT')).toBe(true)
    })

    it('should reject overlapping time slots (within 15 minutes)', () => {
      const newTimeSlot: TimeSlotRequest = {
        dayOfWeek: 1, // Monday
        time: '09:10', // Within 15 minutes of 09:00
        timezone: 'UTC'
      }

      const result = validateTimeSlotConflicts(newTimeSlot, existingSlots)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('TIME_SLOT_CONFLICT')
    })

    it('should allow time slots on different days', () => {
      const newTimeSlot: TimeSlotRequest = {
        dayOfWeek: 2, // Tuesday
        time: '09:00', // Same time but different day
        timezone: 'UTC'
      }

      const result = validateTimeSlotConflicts(newTimeSlot, existingSlots)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should ignore inactive time slots', () => {
      const inactiveSlots: TimeSlotConfig[] = [
        {
          ...existingSlots[0],
          isActive: false
        }
      ]

      const newTimeSlot: TimeSlotRequest = {
        dayOfWeek: 1, // Monday
        time: '09:00', // Same as inactive slot
        timezone: 'UTC'
      }

      const result = validateTimeSlotConflicts(newTimeSlot, inactiveSlots)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('validateTimeSlotBatch', () => {
    it('should validate a batch of valid time slots', () => {
      const timeSlots: TimeSlotRequest[] = [
        { dayOfWeek: 1, time: '09:00', timezone: 'UTC' },
        { dayOfWeek: 1, time: '15:00', timezone: 'UTC' },
        { dayOfWeek: 2, time: '09:00', timezone: 'UTC' }
      ]

      const result = validateTimeSlotBatch(timeSlots)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject batch with duplicate time slots', () => {
      const timeSlots: TimeSlotRequest[] = [
        { dayOfWeek: 1, time: '09:00', timezone: 'UTC' },
        { dayOfWeek: 1, time: '09:00', timezone: 'UTC' } // Duplicate
      ]

      const result = validateTimeSlotBatch(timeSlots)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors.some(e => e.code === 'DUPLICATE_TIME_SLOT')).toBe(true)
    })

    it('should reject batch with overlapping time slots', () => {
      const timeSlots: TimeSlotRequest[] = [
        { dayOfWeek: 1, time: '09:00', timezone: 'UTC' },
        { dayOfWeek: 1, time: '09:10', timezone: 'UTC' } // Overlapping
      ]

      const result = validateTimeSlotBatch(timeSlots)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('TIME_SLOT_CONFLICT')
    })
  })

  describe('Time formatting utilities', () => {
    describe('formatTimeForDisplay', () => {
      it('should format 24-hour time correctly', () => {
        expect(formatTimeForDisplay('09:00')).toBe('09:00')
        expect(formatTimeForDisplay('15:30')).toBe('15:30')
        expect(formatTimeForDisplay('00:00')).toBe('00:00')
      })

      it('should format 12-hour time correctly', () => {
        expect(formatTimeForDisplay('09:00', true)).toBe('9:00 AM')
        expect(formatTimeForDisplay('15:30', true)).toBe('3:30 PM')
        expect(formatTimeForDisplay('00:00', true)).toBe('12:00 AM')
        expect(formatTimeForDisplay('12:00', true)).toBe('12:00 PM')
      })
    })

    describe('convertTo24Hour', () => {
      it('should convert AM times correctly', () => {
        expect(convertTo24Hour('9:00', 'AM')).toBe('09:00')
        expect(convertTo24Hour('12:00', 'AM')).toBe('00:00')
      })

      it('should convert PM times correctly', () => {
        expect(convertTo24Hour('3:30', 'PM')).toBe('15:30')
        expect(convertTo24Hour('12:00', 'PM')).toBe('12:00')
      })
    })
  })
})

describe('TimeSlotService', () => {
  let timeSlotService: TimeSlotService
  let mockDb: vi.Mocked<DatabaseService>

  beforeEach(() => {
    mockDb = {
      getTimeSlots: vi.fn(),
      createTimeSlot: vi.fn(),
      updateTimeSlot: vi.fn(),
      deleteTimeSlot: vi.fn(),
      getScheduledPosts: vi.fn()
    } as any

    timeSlotService = new TimeSlotService(mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserTimeSlots', () => {
    it('should return user time slots', async () => {
      const mockSlots: TimeSlotConfig[] = [
        {
          id: '1',
          userId: 'user1',
          dayOfWeek: 1,
          time: '09:00',
          timezone: 'UTC',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockDb.getTimeSlots.mockResolvedValue(mockSlots)

      const result = await timeSlotService.getUserTimeSlots('user1')
      expect(result).toEqual(mockSlots)
      expect(mockDb.getTimeSlots).toHaveBeenCalledWith('user1')
    })

    it('should handle database errors', async () => {
      mockDb.getTimeSlots.mockRejectedValue(new Error('Database error'))

      await expect(timeSlotService.getUserTimeSlots('user1'))
        .rejects.toThrow('Failed to get user time slots')
    })
  })

  describe('createTimeSlot', () => {
    it('should create a valid time slot', async () => {
      const timeSlotRequest: TimeSlotRequest = {
        dayOfWeek: 1,
        time: '09:00',
        timezone: 'UTC'
      }

      const mockCreatedSlot: TimeSlotConfig = {
        id: '1',
        userId: 'user1',
        ...timeSlotRequest,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDb.getTimeSlots.mockResolvedValue([]) // No existing slots
      mockDb.createTimeSlot.mockResolvedValue(mockCreatedSlot)

      const result = await timeSlotService.createTimeSlot('user1', timeSlotRequest)
      expect(result).toEqual(mockCreatedSlot)
      expect(mockDb.createTimeSlot).toHaveBeenCalled()
    })

    it('should reject invalid time slot data', async () => {
      const invalidTimeSlot: TimeSlotRequest = {
        dayOfWeek: 7 as DayOfWeek, // Invalid
        time: '09:00',
        timezone: 'UTC'
      }

      await expect(timeSlotService.createTimeSlot('user1', invalidTimeSlot))
        .rejects.toThrow('Invalid time slot data')
    })

    it('should reject conflicting time slots', async () => {
      const existingSlots: TimeSlotConfig[] = [
        {
          id: '1',
          userId: 'user1',
          dayOfWeek: 1,
          time: '09:00',
          timezone: 'UTC',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const conflictingTimeSlot: TimeSlotRequest = {
        dayOfWeek: 1,
        time: '09:00', // Same time
        timezone: 'UTC'
      }

      mockDb.getTimeSlots.mockResolvedValue(existingSlots)

      await expect(timeSlotService.createTimeSlot('user1', conflictingTimeSlot))
        .rejects.toThrow('Time slot conflict')
    })
  })

  describe('getNextAvailableSlot', () => {
    it('should return next available slot', async () => {
      const mockSlots: TimeSlotConfig[] = [
        {
          id: '1',
          userId: 'user1',
          dayOfWeek: 1, // Monday
          time: '09:00',
          timezone: 'UTC',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockDb.getTimeSlots.mockResolvedValue(mockSlots)
      mockDb.getScheduledPosts.mockResolvedValue([]) // No scheduled posts

      // Mock current date to be Sunday
      const mockDate = new Date('2024-01-07T08:00:00Z') // Sunday
      const result = await timeSlotService.getNextAvailableSlot('user1', mockDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getDay()).toBe(1) // Should be Monday
      expect(result?.getHours()).toBe(9) // Should be 9 AM
    })

    it('should return null when no slots are available', async () => {
      mockDb.getTimeSlots.mockResolvedValue([]) // No time slots configured

      const result = await timeSlotService.getNextAvailableSlot('user1')
      expect(result).toBeNull()
    })

    it('should skip occupied slots', async () => {
      const mockSlots: TimeSlotConfig[] = [
        {
          id: '1',
          userId: 'user1',
          dayOfWeek: 1, // Monday
          time: '09:00',
          timezone: 'UTC',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          userId: 'user1',
          dayOfWeek: 1, // Monday
          time: '15:00',
          timezone: 'UTC',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      mockDb.getTimeSlots.mockResolvedValue(mockSlots)
      
      // Mock first slot as occupied, second as available
      mockDb.getScheduledPosts
        .mockResolvedValueOnce([{ id: 'post1' } as any]) // First slot occupied
        .mockResolvedValueOnce([]) // Second slot available

      const mockDate = new Date('2024-01-07T08:00:00Z') // Sunday
      const result = await timeSlotService.getNextAvailableSlot('user1', mockDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getHours()).toBe(15) // Should be 3 PM (second slot)
    })
  })

  describe('bulkUpdateTimeSlots', () => {
    it('should replace all time slots', async () => {
      const newTimeSlots: TimeSlotRequest[] = [
        { dayOfWeek: 1, time: '09:00', timezone: 'UTC' },
        { dayOfWeek: 2, time: '15:00', timezone: 'UTC' }
      ]

      const existingSlots: TimeSlotConfig[] = [
        {
          id: '1',
          userId: 'user1',
          dayOfWeek: 0,
          time: '12:00',
          timezone: 'UTC',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      const mockCreatedSlots: TimeSlotConfig[] = newTimeSlots.map((slot, index) => ({
        id: `new-${index}`,
        userId: 'user1',
        ...slot,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      mockDb.getTimeSlots.mockResolvedValue(existingSlots)
      mockDb.deleteTimeSlot.mockResolvedValue(undefined)
      
      // Mock createTimeSlot to be called for each new slot
      newTimeSlots.forEach((_, index) => {
        mockDb.createTimeSlot.mockResolvedValueOnce(mockCreatedSlots[index])
      })

      const result = await timeSlotService.bulkUpdateTimeSlots('user1', newTimeSlots)
      
      expect(result).toHaveLength(2)
      expect(mockDb.deleteTimeSlot).toHaveBeenCalledWith('1') // Existing slot deleted
      expect(mockDb.createTimeSlot).toHaveBeenCalledTimes(2) // New slots created
    })

    it('should reject invalid batch', async () => {
      const invalidTimeSlots: TimeSlotRequest[] = [
        { dayOfWeek: 7 as DayOfWeek, time: '09:00', timezone: 'UTC' } // Invalid day
      ]

      await expect(timeSlotService.bulkUpdateTimeSlots('user1', invalidTimeSlots))
        .rejects.toThrow('Validation errors')
    })
  })
})