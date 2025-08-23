/**
 * API tests for scheduled posts endpoints
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createPost, GET as getPosts } from '../app/api/posts/route'
import { GET as getPost, PUT as updatePost, DELETE as deletePost } from '../app/api/posts/[id]/route'
import type { 
  CreatePostRequest, 
  UpdatePostRequest,
  ScheduledPost, 
  PostContent,
  ApiResponse,
  PaginatedResponse
} from '../types'

// Mock Supabase
const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn()
  }
}

vi.mock('../services/supabase', () => ({
  createServerSupabaseClient: () => mockSupabaseClient
}))

// Mock Database Service
const mockDb = {
  createScheduledPost: vi.fn(),
  getScheduledPosts: vi.fn(),
  getScheduledPostsCount: vi.fn(),
  getScheduledPostById: vi.fn(),
  updateScheduledPost: vi.fn(),
  deleteScheduledPost: vi.fn()
}

vi.mock('../services/database', () => ({
  db: mockDb
}))

// Mock API validation utilities
vi.mock('../utils/apiValidation', () => ({
  validateRequestBody: vi.fn(() => ({ isValid: true, errors: [] })),
  validatePostContent: vi.fn(() => ({ isValid: true, errors: [] })),
  validatePlatform: vi.fn(() => ({ isValid: true, errors: [] })),
  validateAndParseDate: vi.fn(() => ({ isValid: true, date: new Date('2024-01-15T10:00:00Z'), errors: [] })),
  validateFutureDate: vi.fn(() => ({ isValid: true, errors: [] })),
  createErrorResponse: vi.fn((code, message, statusCode, details) => ({
    success: false,
    error: { code, message, timestamp: new Date(), ...(details && { details }) }
  })),
  createSuccessResponse: vi.fn((data, message, warnings) => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    ...(warnings && { warnings })
  })),
  combineValidationResults: vi.fn(() => ({ isValid: true, errors: [] }))
}))

describe('Posts API Endpoints', () => {
  const mockPostContent: PostContent = {
    type: 'single',
    text: 'Test post content',
    metadata: {}
  }

  const mockScheduledPost: ScheduledPost = {
    id: 'post-123',
    userId: 'user-123',
    platform: 'threads',
    content: mockPostContent,
    scheduledTime: new Date('2024-01-15T10:00:00Z'),
    status: 'scheduled',
    createdAt: new Date('2024-01-14T10:00:00Z'),
    updatedAt: new Date('2024-01-14T10:00:00Z')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/posts', () => {
    it('should create a new scheduled post', async () => {
      const requestBody: CreatePostRequest = {
        content: mockPostContent,
        platform: 'threads',
        schedulingType: 'custom',
        customTime: new Date('2024-01-15T10:00:00Z')
      }

      mockDb.createScheduledPost.mockResolvedValue(mockScheduledPost)

      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await createPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(mockScheduledPost)
      expect(mockDb.createScheduledPost).toHaveBeenCalledWith({
        userId: mockUser.id,
        platform: requestBody.platform,
        content: requestBody.content,
        scheduledTime: requestBody.customTime,
        status: 'scheduled'
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await createPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.success).toBe(false)
      expect(responseData.error.code).toBe('UNAUTHORIZED')
    })

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await createPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })

    it('should handle database errors', async () => {
      const requestBody: CreatePostRequest = {
        content: mockPostContent,
        platform: 'threads',
        schedulingType: 'custom',
        customTime: new Date('2024-01-15T10:00:00Z')
      }

      mockDb.createScheduledPost.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/posts', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await createPost(request)
      const responseData = await response.json()

      expect(response.status).toBe(500)
      expect(responseData.success).toBe(false)
    })
  })

  describe('GET /api/posts', () => {
    it('should get posts with pagination', async () => {
      const mockPosts = [mockScheduledPost]
      mockDb.getScheduledPosts.mockResolvedValue(mockPosts)
      mockDb.getScheduledPostsCount.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/posts?page=1&limit=20')

      const response = await getPosts(request)
      const responseData: PaginatedResponse<ScheduledPost> = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(mockPosts)
      expect(responseData.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      })
    })

    it('should apply filters correctly', async () => {
      mockDb.getScheduledPosts.mockResolvedValue([])
      mockDb.getScheduledPostsCount.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/posts?platform=threads&status=scheduled&startDate=2024-01-01&endDate=2024-01-31')

      const response = await getPosts(request)

      expect(mockDb.getScheduledPosts).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          platform: 'threads',
          status: 'scheduled',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          limit: 20,
          offset: 0
        })
      )
    })

    it('should validate pagination parameters', async () => {
      const request = new NextRequest('http://localhost/api/posts?page=0&limit=-1')

      const response = await getPosts(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })

    it('should validate platform parameter', async () => {
      const request = new NextRequest('http://localhost/api/posts?platform=invalid')

      const response = await getPosts(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })

    it('should validate date range', async () => {
      const request = new NextRequest('http://localhost/api/posts?startDate=2024-01-31&endDate=2024-01-01')

      const response = await getPosts(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })
  })

  describe('GET /api/posts/[id]', () => {
    it('should get a specific post', async () => {
      mockDb.getScheduledPostById.mockResolvedValue(mockScheduledPost)

      const request = new NextRequest('http://localhost/api/posts/post-123')

      const response = await getPost(request, { params: { id: 'post-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(mockScheduledPost)
      expect(mockDb.getScheduledPostById).toHaveBeenCalledWith('post-123', mockUser.id)
    })

    it('should return 404 when post not found', async () => {
      mockDb.getScheduledPostById.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/posts/nonexistent')

      const response = await getPost(request, { params: { id: 'nonexistent' } })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
    })

    it('should validate post ID format', async () => {
      const request = new NextRequest('http://localhost/api/posts/invalid')

      const response = await getPost(request, { params: { id: 'abc' } })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })
  })

  describe('PUT /api/posts/[id]', () => {
    it('should update a post', async () => {
      const updateData: UpdatePostRequest = {
        content: { ...mockPostContent, text: 'Updated content' },
        status: 'cancelled'
      }

      const updatedPost = { ...mockScheduledPost, ...updateData }

      mockDb.getScheduledPostById.mockResolvedValue(mockScheduledPost)
      mockDb.updateScheduledPost.mockResolvedValue(updatedPost)

      const request = new NextRequest('http://localhost/api/posts/post-123', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const response = await updatePost(request, { params: { id: 'post-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data).toEqual(updatedPost)
      expect(mockDb.updateScheduledPost).toHaveBeenCalledWith('post-123', updateData)
    })

    it('should prevent updating published posts', async () => {
      const publishedPost = { ...mockScheduledPost, status: 'published' as const }
      mockDb.getScheduledPostById.mockResolvedValue(publishedPost)

      const request = new NextRequest('http://localhost/api/posts/post-123', {
        method: 'PUT',
        body: JSON.stringify({ content: mockPostContent })
      })

      const response = await updatePost(request, { params: { id: 'post-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })

    it('should require at least one field for update', async () => {
      mockDb.getScheduledPostById.mockResolvedValue(mockScheduledPost)

      const request = new NextRequest('http://localhost/api/posts/post-123', {
        method: 'PUT',
        body: JSON.stringify({})
      })

      const response = await updatePost(request, { params: { id: 'post-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })

    it('should return 404 for nonexistent post', async () => {
      mockDb.getScheduledPostById.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/posts/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ content: mockPostContent })
      })

      const response = await updatePost(request, { params: { id: 'nonexistent' } })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
    })
  })

  describe('DELETE /api/posts/[id]', () => {
    it('should delete a post with confirmation', async () => {
      mockDb.getScheduledPostById.mockResolvedValue(mockScheduledPost)
      mockDb.deleteScheduledPost.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost/api/posts/post-123?confirm=true')

      const response = await deletePost(request, { params: { id: 'post-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.data.id).toBe('post-123')
      expect(mockDb.deleteScheduledPost).toHaveBeenCalledWith('post-123')
    })

    it('should require confirmation for deletion', async () => {
      mockDb.getScheduledPostById.mockResolvedValue(mockScheduledPost)

      const request = new NextRequest('http://localhost/api/posts/post-123')

      const response = await deletePost(request, { params: { id: 'post-123' } })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(mockDb.deleteScheduledPost).not.toHaveBeenCalled()
    })

    it('should return 404 for nonexistent post', async () => {
      mockDb.getScheduledPostById.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/posts/nonexistent?confirm=true')

      const response = await deletePost(request, { params: { id: 'nonexistent' } })
      const responseData = await response.json()

      expect(response.status).toBe(404)
      expect(responseData.success).toBe(false)
    })

    it('should validate post ID format', async () => {
      const request = new NextRequest('http://localhost/api/posts/abc?confirm=true')

      const response = await deletePost(request, { params: { id: 'abc' } })
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
    })
  })
})