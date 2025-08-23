/**
 * Scheduling API Integration Tests
 * Tests for the scheduling API endpoints
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as nextSlotPOST } from '../app/api/schedule/next-slot/route'
import { POST as customTimePOST } from '../app/api/schedule/custom/route'
import type { ScheduleNextSlotRequest, ScheduleCustomTimeRequest, PostContent, Platform } from '../types'

// Mock Supabase
vi.mock('@/services/supabase', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

// Mock scheduling service
vi.mock('@/services/scheduling', () => ({
  schedulingService: {
    scheduleToNextSlot: vi.fn(),
    scheduleToCustomTime: vi.fn()
  }
}))

describe('Scheduling API Endpoints', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockContent: PostContent = {
    type: 'single',
    text: 'Test post content',
    metadata: {}
  }
  const mockPlatform: Platform = 'threads'

  let mockSupabase: any
  let mockSchedulingService: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mocks
    const { createServerSupabaseClient } = require('@/services/supabase')
    const { schedulingService } = require('@/services/scheduling')
    
    mockSupabase = createServerSupabaseClient()
    mockSchedulingService = schedulingService
    
    // Default successful auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })
  })

  describe('POST /api/schedule/next-slot', () => {
    const createRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/schedule/next-slot', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    it('should schedule post to next available slot successfully', async () => {
      const requestBody: ScheduleNextSlotRequest = {
        content: mockContent,
        platform: mockPlatform
      }

      const mockScheduledPost = {
        id: 'post-123',
        userId: mockUser.id,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date('2024-01-08T09:00:00Z'),
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockSchedulingService.scheduleToNextSlot.mockResolvedValue({
        success: true,
        scheduledPost: mockScheduledPost
      })

      const request = createRequest(requestBody)
      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockScheduledPost)
      expect(data.message).toContain('scheduled successfully')
      
      expect(mockSchedulingService.scheduleToNextSlot).toHaveBeenCalledWith({
        userId: mockUser.id,
        content: mockContent,
        platform: mockPlatform,
        startDate: undefined,
        excludeDates: undefined
      })
    })

    it('should handle startDate and excludeDates parameters', async () => {
      const requestBody: ScheduleNextSlotRequest = {
        content: mockContent,
        platform: mockPlatform,
        startDate: '2024-01-08T00:00:00Z',
        excludeDates: ['2024-01-08T09:00:00Z', '2024-01-08T15:00:00Z']
      }

      mockSchedulingService.scheduleToNextSlot.mockResolvedValue({
        success: true,
        scheduledPost: {}
      })

      const request = createRequest(requestBody)
      await nextSlotPOST(request)

      expect(mockSchedulingService.scheduleToNextSlot).toHaveBeenCalledWith({
        userId: mockUser.id,
        content: mockContent,
        platform: mockPlatform,
        startDate: new Date('2024-01-08T00:00:00Z'),
        excludeDates: [
          new Date('2024-01-08T09:00:00Z'),
          new Date('2024-01-08T15:00:00Z')
        ]
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = createRequest({ content: mockContent, platform: mockPlatform })
      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/schedule/next-slot', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Invalid JSON')
    })

    it('should return 400 for missing required fields', async () => {
      const request = createRequest({ content: mockContent }) // Missing platform

      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Missing required fields')
    })

    it('should return 400 for invalid platform', async () => {
      const request = createRequest({
        content: mockContent,
        platform: 'invalid-platform'
      })

      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Invalid platform')
    })

    it('should return 400 for empty content text', async () => {
      const request = createRequest({
        content: { ...mockContent, text: '' },
        platform: mockPlatform
      })

      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Content text is required')
    })

    it('should return 409 when no available slots found', async () => {
      mockSchedulingService.scheduleToNextSlot.mockResolvedValue({
        success: false,
        error: 'No available time slots found in the next 14 days'
      })

      const request = createRequest({ content: mockContent, platform: mockPlatform })
      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('No available time slots')
    })

    it('should return 400 for content validation errors', async () => {
      mockSchedulingService.scheduleToNextSlot.mockResolvedValue({
        success: false,
        error: 'Content validation failed: Post content cannot be empty'
      })

      const request = createRequest({ content: mockContent, platform: mockPlatform })
      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('validation failed')
    })

    it('should return 500 for unexpected errors', async () => {
      mockSchedulingService.scheduleToNextSlot.mockRejectedValue(new Error('Database error'))

      const request = createRequest({ content: mockContent, platform: mockPlatform })
      const response = await nextSlotPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })

  describe('POST /api/schedule/custom', () => {
    const createRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/schedule/custom', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    it('should schedule post to custom time successfully', async () => {
      const scheduledTime = '2024-01-10T14:00:00Z'
      const requestBody: ScheduleCustomTimeRequest = {
        content: mockContent,
        platform: mockPlatform,
        scheduledTime
      }

      const mockScheduledPost = {
        id: 'post-123',
        userId: mockUser.id,
        platform: mockPlatform,
        content: mockContent,
        scheduledTime: new Date(scheduledTime),
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockSchedulingService.scheduleToCustomTime.mockResolvedValue({
        success: true,
        scheduledPost: mockScheduledPost
      })

      const request = createRequest(requestBody)
      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockScheduledPost)
      expect(data.message).toContain('scheduled successfully')
      
      expect(mockSchedulingService.scheduleToCustomTime).toHaveBeenCalledWith({
        userId: mockUser.id,
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: new Date(scheduledTime),
        allowConflicts: false
      })
    })

    it('should handle allowConflicts parameter', async () => {
      const requestBody: ScheduleCustomTimeRequest = {
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: '2024-01-10T14:00:00Z',
        allowConflicts: true
      }

      mockSchedulingService.scheduleToCustomTime.mockResolvedValue({
        success: true,
        scheduledPost: {},
        conflicts: [{ id: 'conflict-post' }]
      })

      const request = createRequest(requestBody)
      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('conflicts detected but allowed')
      expect(data.warnings).toContain('1 conflicting post(s) detected')
      
      expect(mockSchedulingService.scheduleToCustomTime).toHaveBeenCalledWith(
        expect.objectContaining({
          allowConflicts: true
        })
      )
    })

    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = createRequest({
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: '2024-01-10T14:00:00Z'
      })
      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should return 400 for missing required fields', async () => {
      const request = createRequest({
        content: mockContent,
        platform: mockPlatform
        // Missing scheduledTime
      })

      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Missing required fields')
    })

    it('should return 400 for invalid date format', async () => {
      const request = createRequest({
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: 'invalid-date'
      })

      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Invalid scheduledTime format')
    })

    it('should return 400 for past dates', async () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1) // 1 hour ago

      const request = createRequest({
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: pastDate.toISOString()
      })

      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('cannot be in the past')
    })

    it('should return 409 for scheduling conflicts with suggestions', async () => {
      const conflictingPost = {
        id: 'conflict-post',
        scheduledTime: new Date('2024-01-10T14:05:00Z')
      }
      const suggestedTime = new Date('2024-01-10T15:00:00Z')

      mockSchedulingService.scheduleToCustomTime.mockResolvedValue({
        success: false,
        error: 'Time slot conflict detected',
        conflicts: [conflictingPost],
        suggestedTime
      })

      const request = createRequest({
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: '2024-01-10T14:00:00Z'
      })
      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('SCHEDULING_CONFLICT')
      expect(data.error.details.conflicts).toEqual([conflictingPost])
      expect(data.error.details.suggestedTime).toEqual(suggestedTime)
    })

    it('should return 500 for unexpected errors', async () => {
      mockSchedulingService.scheduleToCustomTime.mockRejectedValue(new Error('Database error'))

      const request = createRequest({
        content: mockContent,
        platform: mockPlatform,
        scheduledTime: '2024-01-10T14:00:00Z'
      })
      const response = await customTimePOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })

  describe('Method validation', () => {
    it('should return 405 for GET requests to next-slot endpoint', async () => {
      const { GET } = require('../app/api/schedule/next-slot/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(405)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Method not allowed')
    })

    it('should return 405 for GET requests to custom endpoint', async () => {
      const { GET } = require('../app/api/schedule/custom/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(405)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Method not allowed')
    })
  })
})