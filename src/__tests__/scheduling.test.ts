/**
 * Scheduling Service Tests
 * Comprehensive unit tests for scheduling algorithms and logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SchedulingService } from '../services/scheduling'
import { DatabaseService } from '../services/database'
import { TimeSlotService } from '../services/timeSlots'
import type {
  ScheduledPost,
  TimeSlotConfig,
  PostContent,
  Platform,
  DayOfWeek
} from '../types'

// Mock dependencies
vi.mock('../services/database')
vi.mock('../services/timeSlots')

describe('SchedulingService', () => {
  let schedulingService: SchedulingService
  let mockDb: vi.Mocked<DatabaseService>
  let mockTimeSlotService: vi.Mocked<TimeSlotService>

  const mockUserId = 'user-123'
  const mockPlatform: Platform = 'threads'
  
  const mockContent: PostContent = {
    type: 'single',
    text: 'Test post content',
    metadata: {}
  }

  const mockTimeSlots: TimeSlotConfig[] = [
    {
      id: 'slot-1',
      userId: mockUserId,
      dayOfWeek: 1, // Monday
      time: '09:00',
      timezone: 'UTC',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'slot-2',
      userId: mockUserId,
      dayOfWeek: 1, // Monday
      time: '15:00',
      timezone: 'UTC',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'slot-3',
      userId: mockUserId,
      dayOfWeek: 3, // Wednesday
      time: '12:00',
      timezone: 'UTC',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockDb = {
      getScheduledPosts: vi.fn(),
      createScheduledPost: vi.fn(),
      updateScheduledPost: vi.fn(),
      deleteScheduledPost: vi.fn()
    } as any

    mockTimeSlotService = {
      getUserTimeSlots: vi.fn(),
      getTimeSlotsForDay: vi.fn()
    } as any

    schedulingService = new SchedulingService(mockDb, mockTimeSlotService)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('scheduleToNextSlot', () => {
    it('should schedule to the next available slot successfully', async () => {
      // Mock current time to Sunday 10:00 UTC
      const mockNow = new Date('2024-01-07T10:00:00Z') // Sunday
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      mockTimeSlotService.getUserTimeSlots.mockResolvedValue(mockTimeSlots)
      mockDb.getScheduledPosts.mockResolvedValue([])
      
      const mockScheduledPost: ScheduledPost = {
        id: 'post-1',
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date('2024-01-08T09:00:00Z'), // Monday 09:00
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockDb.createScheduledPost.mockResolvedValue(mockScheduledPost)

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform
      })

      expect(result.success).toBe(true)
      expect(result.scheduledPost).toEqual(mockScheduledPost)
      expect(mockDb.createScheduledPost).toHaveBeenCalledWith({
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date('2024-01-08T09:00:00Z'),
        status: 'scheduled'
      })
    })

    it('should skip occupied slots and find the next available one', async () => {
      const mockNow = new Date('2024-01-07T10:00:00Z') // Sunday
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      mockTimeSlotService.getUserTimeSlots.mockResolvedValue(mockTimeSlots)
      
      // Mock that Monday 09:00 is occupied
      mockDb.getScheduledPosts
        .mockResolvedValueOnce([{ // First call for Monday 09:00
          id: 'existing-post',
          scheduledTime: new Date('2024-01-08T09:00:00Z')
        } as ScheduledPost])
        .mockResolvedValueOnce([]) // Second call for Monday 15:00 (available)

      const mockScheduledPost: ScheduledPost = {
        id: 'post-1',
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date('2024-01-08T15:00:00Z'), // Monday 15:00
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockDb.createScheduledPost.mockResolvedValue(mockScheduledPost)

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform
      })

      expect(result.success).toBe(true)
      expect(result.scheduledPost?.scheduledTime).toEqual(new Date('2024-01-08T15:00:00Z'))
    })

    it('should return error when no available slots found', async () => {
      const mockNow = new Date('2024-01-07T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      mockTimeSlotService.getUserTimeSlots.mockResolvedValue([])

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('No available time slots found')
    })

    it('should validate content before scheduling', async () => {
      const invalidContent: PostContent = {
        type: 'single',
        text: '', // Empty content
        metadata: {}
      }

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: invalidContent,
        platform: mockPlatform
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Content validation failed')
    })

    it('should respect exclude dates', async () => {
      const mockNow = new Date('2024-01-07T10:00:00Z') // Sunday
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      mockTimeSlotService.getUserTimeSlots.mockResolvedValue(mockTimeSlots)
      mockDb.getScheduledPosts.mockResolvedValue([])

      const excludeDates = [new Date('2024-01-08T09:00:00Z')] // Exclude Monday 09:00

      const mockScheduledPost: ScheduledPost = {
        id: 'post-1',
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date('2024-01-08T15:00:00Z'), // Should skip to Monday 15:00
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockDb.createScheduledPost.mockResolvedValue(mockScheduledPost)

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform,
        excludeDates
      })

      expect(result.success).toBe(true)
      expect(result.scheduledPost?.scheduledTime).toEqual(new Date('2024-01-08T15:00:00Z'))
    })
  })

  describe('scheduleToCustomTime', () => {
    it('should schedule to custom time successfully when no conflicts', async () => {
      const customTime = new Date('2024-01-10T14:00:00Z')
      
      mockDb.getScheduledPosts.mockResolvedValue([]) // No conflicts
      
      const mockScheduledPost: ScheduledPost = {
        id: 'post-1',
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: customTime,
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockDb.createScheduledPost.mockResolvedValue(mockScheduledPost)

      const result = await schedulingService.scheduleToCustomTime({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: customTime
      })

      expect(result.success).toBe(true)
      expect(result.scheduledPost).toEqual(mockScheduledPost)
    })

    it('should detect conflicts and suggest alternative time', async () => {
      const customTime = new Date('2024-01-10T14:00:00Z')
      
      const conflictingPost: ScheduledPost = {
        id: 'conflict-post',
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date('2024-01-10T14:05:00Z'), // 5 minutes later (conflict)
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockDb.getScheduledPosts.mockResolvedValue([conflictingPost])
      mockTimeSlotService.getUserTimeSlots.mockResolvedValue(mockTimeSlots)

      const result = await schedulingService.scheduleToCustomTime({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: customTime
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Time slot conflict detected')
      expect(result.conflicts).toContain(conflictingPost)
      expect(result.suggestedTime).toBeDefined()
    })

    it('should allow conflicts when allowConflicts is true', async () => {
      const customTime = new Date('2024-01-10T14:00:00Z')
      
      const conflictingPost: ScheduledPost = {
        id: 'conflict-post',
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date('2024-01-10T14:05:00Z'),
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockDb.getScheduledPosts.mockResolvedValue([conflictingPost])
      
      const mockScheduledPost: ScheduledPost = {
        id: 'post-1',
        userId: mockUserId,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: customTime,
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockDb.createScheduledPost.mockResolvedValue(mockScheduledPost)

      const result = await schedulingService.scheduleToCustomTime({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: customTime,
        allowConflicts: true
      })

      expect(result.success).toBe(true)
      expect(result.scheduledPost).toEqual(mockScheduledPost)
      expect(result.conflicts).toContain(conflictingPost)
    })

    it('should reject past dates', async () => {
      const pastTime = new Date('2020-01-01T12:00:00Z')

      const result = await schedulingService.scheduleToCustomTime({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: pastTime
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Scheduled time cannot be in the past')
    })

    it('should reject dates too far in the future', async () => {
      const farFutureTime = new Date()
      farFutureTime.setFullYear(farFutureTime.getFullYear() + 2) // 2 years from now

      const result = await schedulingService.scheduleToCustomTime({
        userId: mockUserId,
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: farFutureTime
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('more than 1 year in the future')
    })
  })

  describe('detectConflicts', () => {
    it('should detect conflicts within 15-minute window', async () => {
      const targetTime = new Date('2024-01-10T14:00:00Z')
      
      const conflictingPosts: ScheduledPost[] = [
        {
          id: 'post-1',
          userId: mockUserId,
          platform: mockPlatform,
          content: mockContent,
          scheduledTime: new Date('2024-01-10T14:05:00Z'), // 5 minutes later
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'post-2',
          userId: mockUserId,
          platform: mockPlatform,
          content: mockContent,
          scheduledTime: new Date('2024-01-10T13:50:00Z'), // 10 minutes earlier
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      mockDb.getScheduledPosts.mockResolvedValue(conflictingPosts)

      const conflicts = await schedulingService.detectConflicts(mockUserId, targetTime)

      expect(conflicts).toHaveLength(2)
      expect(conflicts).toEqual(conflictingPosts)
    })

    it('should not detect conflicts outside 15-minute window', async () => {
      const targetTime = new Date('2024-01-10T14:00:00Z')
      
      const nonConflictingPosts: ScheduledPost[] = [
        {
          id: 'post-1',
          userId: mockUserId,
          platform: mockPlatform,
          content: mockContent,
          scheduledTime: new Date('2024-01-10T14:20:00Z'), // 20 minutes later
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      mockDb.getScheduledPosts.mockResolvedValue(nonConflictingPosts)

      const conflicts = await schedulingService.detectConflicts(mockUserId, targetTime)

      expect(conflicts).toHaveLength(0)
    })
  })

  describe('content validation', () => {
    it('should validate Threads single post character limit', async () => {
      const longContent: PostContent = {
        type: 'single',
        text: 'a'.repeat(501), // Exceeds 500 character limit
        metadata: {}
      }

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: longContent,
        platform: 'threads'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('cannot exceed 500 characters')
    })

    it('should validate Threads thread post limits', async () => {
      const threadContent: PostContent = {
        type: 'thread',
        text: 'Thread starter',
        threadPosts: Array(26).fill('Thread post'), // Exceeds 25 post limit
        metadata: {}
      }

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: threadContent,
        platform: 'threads'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('cannot exceed 25 posts')
    })

    it('should validate individual thread post character limits', async () => {
      const threadContent: PostContent = {
        type: 'thread',
        text: 'Thread starter',
        threadPosts: ['Valid post', 'a'.repeat(501)], // Second post exceeds limit
        metadata: {}
      }

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: threadContent,
        platform: 'threads'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Thread post 2 cannot exceed 500 characters')
    })

    it('should validate media file limits', async () => {
      const mediaContent: PostContent = {
        type: 'media',
        text: 'Post with media',
        mediaUrls: Array(11).fill('https://example.com/image.jpg'), // Exceeds 10 file limit
        metadata: {}
      }

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: mediaContent,
        platform: 'threads'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('cannot have more than 10 media files')
    })

    it('should reject empty content', async () => {
      const emptyContent: PostContent = {
        type: 'single',
        text: '',
        metadata: {}
      }

      const result = await schedulingService.scheduleToNextSlot({
        userId: mockUserId,
        content: emptyContent,
        platform: mockPlatform
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Post content cannot be empty')
    })
  })

  describe('getAvailableSlots', () => {
    it('should return available slots for date range', async () => {
      const startDate = new Date('2024-01-08T00:00:00Z') // Monday
      const endDate = new Date('2024-01-10T23:59:59Z') // Wednesday
      
      mockTimeSlotService.getUserTimeSlots.mockResolvedValue(mockTimeSlots)
      mockDb.getScheduledPosts.mockResolvedValue([]) // No conflicts

      const availableSlots = await schedulingService.getAvailableSlots(
        mockUserId,
        startDate,
        endDate
      )

      expect(availableSlots).toHaveLength(3) // 2 Monday slots + 1 Wednesday slot
      expect(availableSlots.every(slot => slot.available)).toBe(true)
    })

    it('should mark slots as unavailable when conflicts exist', async () => {
      const startDate = new Date('2024-01-08T00:00:00Z')
      const endDate = new Date('2024-01-08T23:59:59Z')
      
      mockTimeSlotService.getUserTimeSlots.mockResolvedValue(mockTimeSlots)
      
      // Mock conflict for Monday 09:00
      mockDb.getScheduledPosts
        .mockResolvedValueOnce([{ // First slot has conflict
          id: 'conflict-post',
          scheduledTime: new Date('2024-01-08T09:00:00Z')
        } as ScheduledPost])
        .mockResolvedValueOnce([]) // Second slot is available

      const availableSlots = await schedulingService.getAvailableSlots(
        mockUserId,
        startDate,
        endDate
      )

      expect(availableSlots).toHaveLength(2) // 2 Monday slots
      expect(availableSlots[0].available).toBe(false) // First slot unavailable
      expect(availableSlots[1].available).toBe(true) // Second slot available
    })
  })

  describe('getSchedulingStats', () => {
    it('should return comprehensive scheduling statistics', async () => {
      mockTimeSlotService.getUserTimeSlots.mockResolvedValue(mockTimeSlots)
      mockDb.getScheduledPosts.mockResolvedValue([
        { id: 'post-1', status: 'scheduled' } as ScheduledPost,
        { id: 'post-2', status: 'scheduled' } as ScheduledPost
      ])

      // Mock next available slot
      const mockNow = new Date('2024-01-07T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      const stats = await schedulingService.getSchedulingStats(mockUserId)

      expect(stats.totalSlots).toBe(3)
      expect(stats.activeSlots).toBe(3)
      expect(stats.scheduledPosts).toBe(2)
      expect(stats.nextAvailableSlot).toBeDefined()
    })
  })

  describe('resolveConflict', () => {
    const conflictingPost: ScheduledPost = {
      id: 'conflict-post',
      userId: mockUserId,
      platform: mockPlatform,
      content: mockContent,
      scheduledTime: new Date('2024-01-10T14:00:00Z'),
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    it('should reschedule conflicting post', async () => {
      const newTime = new Date('2024-01-10T15:00:00Z')
      const updatedPost = { ...conflictingPost, scheduledTime: newTime }
      
      mockDb.updateScheduledPost.mockResolvedValue(updatedPost)

      const result = await schedulingService.resolveConflict(
        mockUserId,
        conflictingPost,
        { type: 'reschedule', targetTime: newTime }
      )

      expect(result.success).toBe(true)
      expect(result.scheduledPost?.scheduledTime).toEqual(newTime)
      expect(mockDb.updateScheduledPost).toHaveBeenCalledWith(conflictingPost.id, {
        scheduledTime: newTime
      })
    })

    it('should replace conflicting post', async () => {
      mockDb.deleteScheduledPost.mockResolvedValue(undefined)

      const result = await schedulingService.resolveConflict(
        mockUserId,
        conflictingPost,
        { type: 'replace' }
      )

      expect(result.success).toBe(true)
      expect(mockDb.deleteScheduledPost).toHaveBeenCalledWith(conflictingPost.id)
    })

    it('should allow stacking posts', async () => {
      const result = await schedulingService.resolveConflict(
        mockUserId,
        conflictingPost,
        { type: 'stack' }
      )

      expect(result.success).toBe(true)
      expect(result.scheduledPost).toEqual(conflictingPost)
    })

    it('should require target time for reschedule', async () => {
      const result = await schedulingService.resolveConflict(
        mockUserId,
        conflictingPost,
        { type: 'reschedule' } // Missing targetTime
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Target time required for reschedule')
    })
  })
})