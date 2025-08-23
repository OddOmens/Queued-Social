// ============================================================================
// THREADS PLUGIN TESTS
// ============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ThreadsPlugin } from '../services/platforms/threadsPlugin'
import {
  PostContent,
  PlatformCredentials,
  ErrorCode
} from '../types'
import { ThreadsCredentials } from '../types/platform'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock File constructor for Node.js environment
global.File = class MockFile {
  name: string
  type: string
  size: number
  
  constructor(bits: any[], filename: string, options: { type?: string } = {}) {
    this.name = filename
    this.type = options.type || ''
    this.size = bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : bit.byteLength || 0), 0)
  }
} as any

describe('ThreadsPlugin', () => {
  let plugin: ThreadsPlugin
  let mockCredentials: ThreadsCredentials

  beforeEach(() => {
    plugin = new ThreadsPlugin()
    mockCredentials = {
      id: 'cred-1',
      userId: 'user-1',
      platform: 'threads',
      credentials: {
        accessToken: 'mock-access-token',
        userId: 'threads-user-id',
        username: 'testuser'
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Reset fetch mock
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('plugin properties', () => {
    it('should have correct name and display name', () => {
      expect(plugin.name).toBe('threads')
      expect(plugin.displayName).toBe('Threads')
    })

    it('should return correct content limits', () => {
      const limits = plugin.getContentLimits()
      expect(limits).toEqual({
        maxTextLength: 500,
        maxMediaFiles: 10,
        supportedMediaTypes: [
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'image/gif',
          'video/mp4',
          'video/mov',
          'video/avi'
        ],
        maxThreadLength: 20
      })
    })

    it('should return correct supported content types', () => {
      const types = plugin.getSupportedContentTypes()
      expect(types).toEqual(['single', 'thread', 'media'])
    })
  })

  describe('content validation', () => {
    it('should validate valid single post content', () => {
      const content: PostContent = {
        type: 'single',
        text: 'Valid post content',
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty text content', () => {
      const content: PostContent = {
        type: 'single',
        text: '',
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.REQUIRED_FIELD_MISSING)
    })

    it('should reject text exceeding max length', () => {
      const content: PostContent = {
        type: 'single',
        text: 'a'.repeat(501), // Exceeds 500 character limit
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.CONTENT_TOO_LONG)
    })

    it('should reject too many media files', () => {
      const content: PostContent = {
        type: 'media',
        text: 'Post with too many media files',
        mediaUrls: Array(11).fill('https://example.com/image.jpg'), // Exceeds 10 file limit
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === ErrorCode.TOO_MANY_MEDIA_FILES)).toBe(true)
    })

    it('should validate thread content', () => {
      const content: PostContent = {
        type: 'thread',
        text: 'First post',
        threadPosts: ['First post', 'Second post', 'Third post'],
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(true)
    })

    it('should reject empty thread', () => {
      const content: PostContent = {
        type: 'thread',
        text: 'First post',
        threadPosts: [],
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.EMPTY_THREAD)
    })

    it('should reject thread exceeding max length', () => {
      const content: PostContent = {
        type: 'thread',
        text: 'First post',
        threadPosts: Array(21).fill('Thread post'), // Exceeds 20 post limit
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.THREAD_TOO_LONG)
    })

    it('should reject thread post exceeding max length', () => {
      const content: PostContent = {
        type: 'thread',
        text: 'First post',
        threadPosts: ['Valid post', 'a'.repeat(501)], // Second post exceeds limit
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.THREAD_POST_TOO_LONG)
    })

    it('should reject unsupported content type', () => {
      const content: PostContent = {
        type: 'poll' as any, // Unsupported type
        text: 'Poll content',
        metadata: {}
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.INVALID_CONTENT)
    })

    it('should validate Threads-specific metadata', () => {
      const content: PostContent = {
        type: 'single',
        text: 'Post with valid metadata',
        metadata: {
          replySettings: 'accounts_you_follow',
          allowReplies: true
        }
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(true)
    })

    it('should reject invalid reply settings', () => {
      const content: PostContent = {
        type: 'single',
        text: 'Post with invalid metadata',
        metadata: {
          replySettings: 'invalid_setting'
        }
      }

      const result = plugin.validateContent(content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].field).toBe('metadata.replySettings')
    })
  })

  describe('single post publishing', () => {
    it('should publish single post successfully', async () => {
      // Mock successful API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            id: 'post-id-123', 
            permalink: 'https://threads.net/post/123' 
          })
        })

      const content: PostContent = {
        type: 'single',
        text: 'Test post content',
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(true)
      expect(result.postId).toBe('post-id-123')
      expect(result.platformResponse).toEqual({
        permalink: 'https://threads.net/post/123',
        threadsResponse: { 
          id: 'post-id-123', 
          permalink: 'https://threads.net/post/123' 
        }
      })
    })

    it('should handle API creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      })

      const content: PostContent = {
        type: 'single',
        text: 'Test post content',
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Post creation failed: 400 Bad Request')
    })

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          error: { 
            message: 'Invalid access token',
            type: 'OAuthException',
            code: 190
          }
        })
      })

      const content: PostContent = {
        type: 'single',
        text: 'Test post content',
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Threads API error: Invalid access token')
    })

    it('should handle publish step failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-123' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden'
        })

      const content: PostContent = {
        type: 'single',
        text: 'Test post content',
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Post publishing failed: 403 Forbidden')
    })

    it('should handle invalid credentials', async () => {
      const invalidCredentials = {
        ...mockCredentials,
        credentials: {
          ...mockCredentials.credentials,
          accessToken: ''
        }
      }

      const content: PostContent = {
        type: 'single',
        text: 'Test post content',
        metadata: {}
      }

      const result = await plugin.publishPost(content, invalidCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid Threads credentials')
    })
  })

  describe('thread publishing', () => {
    it('should publish thread successfully', async () => {
      // Mock successful responses for each post in thread
      mockFetch
        // First post creation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-1' })
        })
        // First post publish
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'post-id-1' })
        })
        // Second post creation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-2' })
        })
        // Second post publish
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'post-id-2' })
        })

      const posts = ['First thread post', 'Second thread post']
      const result = await plugin.publishThread(posts, mockCredentials)
      
      expect(result.success).toBe(true)
      expect(result.postId).toBe('post-id-1') // First post ID
      expect(result.platformResponse).toEqual({
        threadPosts: ['post-id-1', 'post-id-2'],
        totalPosts: 2
      })
    })

    it('should handle thread publishing failure at second post', async () => {
      mockFetch
        // First post - success
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'post-id-1' })
        })
        // Second post - failure
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request'
        })

      const posts = ['First thread post', 'Second thread post']
      const result = await plugin.publishThread(posts, mockCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Thread publishing failed at post 2/2')
      expect(result.platformResponse).toEqual({
        publishedPosts: ['post-id-1'],
        failedAtIndex: 1
      })
    })

    it('should publish thread via publishPost method', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'post-id-1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-2' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'post-id-2' })
        })

      const content: PostContent = {
        type: 'thread',
        text: 'First post',
        threadPosts: ['First thread post', 'Second thread post'],
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(true)
      expect(result.postId).toBe('post-id-1')
    })
  })

  describe('media handling', () => {
    it('should publish media post successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'creation-id-123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            id: 'post-id-123',
            permalink: 'https://threads.net/post/123'
          })
        })

      const content: PostContent = {
        type: 'media',
        text: 'Post with media',
        mediaUrls: ['media-id-1', 'media-id-2'],
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(true)
      expect(result.postId).toBe('post-id-123')
    })

    it('should upload media file successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          id: 'media-id-123',
          status: 'FINISHED'
        })
      })

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const mediaId = await plugin.uploadMedia(mockFile, mockCredentials)
      
      expect(mediaId).toBe('media-id-123')
    })

    it('should handle media upload failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      })

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      await expect(plugin.uploadMedia(mockFile, mockCredentials))
        .rejects.toThrow('Failed to upload media: Media upload failed: 400 Bad Request')
    })

    it('should handle media processing wait', async () => {
      mockFetch
        // Initial upload response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            id: 'media-id-123',
            status: 'IN_PROGRESS'
          })
        })
        // Status check response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            id: 'media-id-123',
            status: 'FINISHED'
          })
        })

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const mediaId = await plugin.uploadMedia(mockFile, mockCredentials)
      
      expect(mediaId).toBe('media-id-123')
    })

    it('should handle media processing error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          id: 'media-id-123',
          status: 'ERROR',
          error: { message: 'Processing failed' }
        })
      })

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      await expect(plugin.uploadMedia(mockFile, mockCredentials))
        .rejects.toThrow('Failed to upload media: Media upload error: Processing failed')
    })
  })

  describe('unsupported content types', () => {
    it('should handle unsupported content type', async () => {
      const content: PostContent = {
        type: 'poll' as any,
        text: 'Unsupported content',
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported content type: poll')
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const content: PostContent = {
        type: 'single',
        text: 'Test post',
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to publish single post: Network error')
    })

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error')

      const content: PostContent = {
        type: 'single',
        text: 'Test post',
        metadata: {}
      }

      const result = await plugin.publishPost(content, mockCredentials)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to publish single post: Unknown error')
    })
  })

  describe('private helper methods', () => {
    it('should validate media types correctly', () => {
      // Access private method for testing
      const isValidMediaType = (plugin as any).isValidMediaType.bind(plugin)
      
      expect(isValidMediaType('https://example.com/image.jpg')).toBe(true)
      expect(isValidMediaType('https://example.com/image.png')).toBe(true)
      expect(isValidMediaType('https://example.com/video.mp4')).toBe(true)
      expect(isValidMediaType('https://example.com/document.pdf')).toBe(false)
    })

    it('should get correct MIME types from extensions', () => {
      const getMimeTypeFromExtension = (plugin as any).getMimeTypeFromExtension.bind(plugin)
      
      expect(getMimeTypeFromExtension('jpg')).toBe('image/jpeg')
      expect(getMimeTypeFromExtension('png')).toBe('image/png')
      expect(getMimeTypeFromExtension('mp4')).toBe('video/mp4')
      expect(getMimeTypeFromExtension('unknown')).toBe('')
    })

    it('should get correct media type for API', () => {
      const getMediaType = (plugin as any).getMediaType.bind(plugin)
      
      const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const videoFile = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      const unknownFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      expect(getMediaType(imageFile)).toBe('IMAGE')
      expect(getMediaType(videoFile)).toBe('VIDEO')
      expect(getMediaType(unknownFile)).toBe('IMAGE') // Default fallback
    })

    it('should validate credentials correctly', () => {
      const validateCredentials = (plugin as any).validateCredentials.bind(plugin)
      
      expect(validateCredentials(mockCredentials)).toBe(true)
      
      const invalidCredentials = {
        ...mockCredentials,
        credentials: {
          ...mockCredentials.credentials,
          accessToken: ''
        }
      }
      expect(validateCredentials(invalidCredentials)).toBe(false)
    })
  })
})