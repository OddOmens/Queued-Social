/**
 * Database service tests for scheduled posts operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DatabaseService } from '../services/database'
import type { 
  ScheduledPost, 
  PostContent, 
  Platform, 
  PostStatus,
  DbScheduledPost 
} from '../types'

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  insert: vi.fn(() => mockSupabaseClient),
  update: vi.fn(() => mockSupabaseClient),
  delete: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  gte: vi.fn(() => mockSupabaseClient),
  lte: vi.fn(() => mockSupabaseClient),
  in: vi.fn(() => mockSupabaseClient),
  order: vi.fn(() => mockSupabaseClient),
  limit: vi.fn(() => mockSupabaseClient),
  range: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => mockSupabaseClient)
}

// Mock the supabase module
vi.mock('../services/supabase', () => ({
  createClient: () => mockSupabaseClient
}))

vi.mock('../services/supabase-server', () => ({
  createServerSupabaseClient: () => mockSupabaseClient
}))

describe('DatabaseService - Scheduled Posts Operations', () => {
  let db: DatabaseService
  const mockUserId = 'user-123'
  const mockPostId = 'post-456'

  const mockPostContent: PostContent = {
    type: 'single',
    text: 'Test post content',
    metadata: {}
  }

  const mockDbPost: DbScheduledPost = {
    id: mockPostId,
    user_id: mockUserId,
    platform: 'threads',
    content: mockPostContent,
    scheduled_time: '2024-01-15T10:00:00Z',
    status: 'scheduled',
    published_at: null,
    error_message: null,
    created_at: '2024-01-14T10:00:00Z',
    updated_at: '2024-01-14T10:00:00Z'
  }

  const mockScheduledPost: ScheduledPost = {
    id: mockPostId,
    userId: mockUserId,
    platform: 'threads' as Platform,
    content: mockPostContent,
    scheduledTime: new Date('2024-01-15T10:00:00Z'),
    status: 'scheduled' as PostStatus,
    publishedAt: undefined,
    errorMessage: undefined,
    createdAt: new Date('2024-01-14T10:00:00Z'),
    updatedAt: new Date('2024-01-14T10:00:00Z')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    db = new DatabaseService()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getScheduledPosts', () => {
    it('should get all scheduled posts for a user', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })

      const result = await db.getScheduledPosts(mockUserId)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', mockUserId)
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('scheduled_time', { ascending: true })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: mockPostId,
        userId: mockUserId,
        platform: 'threads',
        status: 'scheduled'
      })
    })

    it('should filter posts by status', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })

      await db.getScheduledPosts(mockUserId, { status: 'published' })

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status', 'published')
    })

    it('should filter posts by platform', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })

      await db.getScheduledPosts(mockUserId, { platform: 'threads' })

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('platform', 'threads')
    })

    it('should filter posts by date range', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      await db.getScheduledPosts(mockUserId, { startDate, endDate })

      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('scheduled_time', startDate.toISOString())
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('scheduled_time', endDate.toISOString())
    })

    it('should apply pagination', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })

      await db.getScheduledPosts(mockUserId, { limit: 10, offset: 20 })

      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(10)
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(20, 29)
    })

    it('should throw error on database failure', async () => {
      mockSupabaseClient.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      })

      await expect(db.getScheduledPosts(mockUserId)).rejects.toThrow('Failed to get scheduled posts: Database error')
    })
  })

  describe('getScheduledPostsCount', () => {
    it('should get count of scheduled posts', async () => {
      mockSupabaseClient.single.mockResolvedValue({ count: 5, error: null })

      const result = await db.getScheduledPostsCount(mockUserId)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
      expect(result).toBe(5)
    })

    it('should return 0 when count is null', async () => {
      mockSupabaseClient.single.mockResolvedValue({ count: null, error: null })

      const result = await db.getScheduledPostsCount(mockUserId)

      expect(result).toBe(0)
    })

    it('should apply filters when counting', async () => {
      mockSupabaseClient.single.mockResolvedValue({ count: 3, error: null })

      await db.getScheduledPostsCount(mockUserId, { 
        status: 'scheduled',
        platform: 'threads'
      })

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status', 'scheduled')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('platform', 'threads')
    })
  })

  describe('getScheduledPostById', () => {
    it('should get a specific post by id', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: mockDbPost, error: null })

      const result = await db.getScheduledPostById(mockPostId, mockUserId)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockPostId)
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', mockUserId)
      expect(mockSupabaseClient.single).toHaveBeenCalled()
      expect(result).toMatchObject({
        id: mockPostId,
        userId: mockUserId
      })
    })

    it('should return null when post not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      })

      const result = await db.getScheduledPostById(mockPostId, mockUserId)

      expect(result).toBeNull()
    })

    it('should throw error on database failure', async () => {
      mockSupabaseClient.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      })

      await expect(db.getScheduledPostById(mockPostId, mockUserId)).rejects.toThrow('Failed to get scheduled post: Database error')
    })
  })

  describe('getCalendarData', () => {
    it('should get posts for calendar view', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await db.getCalendarData(mockUserId, startDate, endDate)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('scheduled_time', startDate.toISOString())
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('scheduled_time', endDate.toISOString())
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('scheduled_time', { ascending: true })
      expect(result).toHaveLength(1)
    })

    it('should filter by platforms when provided', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      const platforms: Platform[] = ['threads', 'twitter']

      await db.getCalendarData(mockUserId, startDate, endDate, platforms)

      expect(mockSupabaseClient.in).toHaveBeenCalledWith('platform', platforms)
    })
  })

  describe('getPostsByTimeSlot', () => {
    it('should get posts within a time slot', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })
      const scheduledTime = new Date('2024-01-15T10:00:00Z')

      const result = await db.getPostsByTimeSlot(mockUserId, scheduledTime, 5)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', mockUserId)
      expect(mockSupabaseClient.gte).toHaveBeenCalled()
      expect(mockSupabaseClient.lte).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })

    it('should use default tolerance when not provided', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })
      const scheduledTime = new Date('2024-01-15T10:00:00Z')

      await db.getPostsByTimeSlot(mockUserId, scheduledTime)

      // Should use 0 minutes tolerance by default
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith('scheduled_time', scheduledTime.toISOString())
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('scheduled_time', scheduledTime.toISOString())
    })
  })

  describe('createScheduledPost', () => {
    it('should create a new scheduled post', async () => {
      const newPost = {
        userId: mockUserId,
        platform: 'threads' as Platform,
        content: mockPostContent,
        scheduledTime: new Date('2024-01-15T10:00:00Z'),
        status: 'scheduled' as PostStatus
      }

      mockSupabaseClient.single.mockResolvedValue({ data: mockDbPost, error: null })

      const result = await db.createScheduledPost(newPost)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        user_id: newPost.userId,
        platform: newPost.platform,
        content: newPost.content,
        scheduled_time: newPost.scheduledTime.toISOString(),
        status: newPost.status,
        published_at: undefined,
        error_message: undefined
      })
      expect(result).toMatchObject({
        id: mockPostId,
        userId: mockUserId,
        platform: 'threads'
      })
    })

    it('should throw error on creation failure', async () => {
      const newPost = {
        userId: mockUserId,
        platform: 'threads' as Platform,
        content: mockPostContent,
        scheduledTime: new Date('2024-01-15T10:00:00Z'),
        status: 'scheduled' as PostStatus
      }

      mockSupabaseClient.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Creation failed' } 
      })

      await expect(db.createScheduledPost(newPost)).rejects.toThrow('Failed to create scheduled post: Creation failed')
    })
  })

  describe('updateScheduledPost', () => {
    it('should update a scheduled post', async () => {
      const updates = {
        content: { ...mockPostContent, text: 'Updated content' },
        status: 'published' as PostStatus
      }

      mockSupabaseClient.single.mockResolvedValue({ 
        data: { ...mockDbPost, ...updates }, 
        error: null 
      })

      const result = await db.updateScheduledPost(mockPostId, updates)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        content: updates.content,
        status: updates.status
      })
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockPostId)
      expect(result.status).toBe('published')
    })

    it('should handle scheduled time updates', async () => {
      const newTime = new Date('2024-01-16T10:00:00Z')
      const updates = { scheduledTime: newTime }

      mockSupabaseClient.single.mockResolvedValue({ 
        data: { ...mockDbPost, scheduled_time: newTime.toISOString() }, 
        error: null 
      })

      await db.updateScheduledPost(mockPostId, updates)

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        scheduled_time: newTime.toISOString()
      })
    })
  })

  describe('updatePostStatus', () => {
    it('should update post status', async () => {
      const publishedAt = new Date('2024-01-15T10:05:00Z')
      mockSupabaseClient.single.mockResolvedValue({ 
        data: { 
          ...mockDbPost, 
          status: 'published',
          published_at: publishedAt.toISOString()
        }, 
        error: null 
      })

      const result = await db.updatePostStatus(mockPostId, 'published', undefined, publishedAt)

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        status: 'published',
        published_at: publishedAt.toISOString(),
        updated_at: expect.any(String)
      })
      expect(result.status).toBe('published')
    })

    it('should update post status with error message', async () => {
      const errorMessage = 'Failed to publish'
      mockSupabaseClient.single.mockResolvedValue({ 
        data: { 
          ...mockDbPost, 
          status: 'failed',
          error_message: errorMessage
        }, 
        error: null 
      })

      await db.updatePostStatus(mockPostId, 'failed', errorMessage)

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: errorMessage,
        updated_at: expect.any(String)
      })
    })
  })

  describe('getPostsForPublishing', () => {
    it('should get posts ready for publishing', async () => {
      const beforeTime = new Date('2024-01-15T10:00:00Z')
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })

      const result = await db.getPostsForPublishing(beforeTime, 25)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status', 'scheduled')
      expect(mockSupabaseClient.lte).toHaveBeenCalledWith('scheduled_time', beforeTime.toISOString())
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(25)
      expect(result).toHaveLength(1)
    })

    it('should use default limit when not provided', async () => {
      const beforeTime = new Date('2024-01-15T10:00:00Z')
      mockSupabaseClient.single.mockResolvedValue({ data: [mockDbPost], error: null })

      await db.getPostsForPublishing(beforeTime)

      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(50)
    })
  })

  describe('bulkUpdatePostStatus', () => {
    it('should update status for multiple posts', async () => {
      const postIds = ['post-1', 'post-2', 'post-3']
      const errorMessage = 'Bulk update error'
      mockSupabaseClient.single.mockResolvedValue({ error: null })

      await db.bulkUpdatePostStatus(postIds, 'failed', errorMessage)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: errorMessage,
        updated_at: expect.any(String)
      })
      expect(mockSupabaseClient.in).toHaveBeenCalledWith('id', postIds)
    })

    it('should update status without error message', async () => {
      const postIds = ['post-1', 'post-2']
      mockSupabaseClient.single.mockResolvedValue({ error: null })

      await db.bulkUpdatePostStatus(postIds, 'published')

      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        status: 'published',
        updated_at: expect.any(String)
      })
    })

    it('should throw error on bulk update failure', async () => {
      const postIds = ['post-1', 'post-2']
      mockSupabaseClient.single.mockResolvedValue({ 
        error: { message: 'Bulk update failed' } 
      })

      await expect(db.bulkUpdatePostStatus(postIds, 'failed')).rejects.toThrow('Failed to bulk update post status: Bulk update failed')
    })
  })

  describe('deleteScheduledPost', () => {
    it('should delete a scheduled post', async () => {
      mockSupabaseClient.single.mockResolvedValue({ error: null })

      await db.deleteScheduledPost(mockPostId)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('scheduled_posts')
      expect(mockSupabaseClient.delete).toHaveBeenCalled()
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', mockPostId)
    })

    it('should throw error on deletion failure', async () => {
      mockSupabaseClient.single.mockResolvedValue({ 
        error: { message: 'Deletion failed' } 
      })

      await expect(db.deleteScheduledPost(mockPostId)).rejects.toThrow('Failed to delete scheduled post: Deletion failed')
    })
  })
})