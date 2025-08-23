// ============================================================================
// PLATFORM INTEGRATION TESTS
// ============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PlatformManager } from '../services/platformManager'
import { ThreadsPlugin } from '../services/platforms/threadsPlugin'
import {
  PostContent,
  Platform
} from '../types'
import { ThreadsCredentials } from '../types/platform'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Platform Integration', () => {
  let platformManager: PlatformManager
  let threadsPlugin: ThreadsPlugin
  let mockCredentials: ThreadsCredentials

  beforeEach(() => {
    platformManager = PlatformManager.getInstance()
    platformManager.clearPlugins() // Start fresh
    
    threadsPlugin = new ThreadsPlugin()
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
    
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('plugin registration and usage', () => {
    it('should register Threads plugin and use it through platform manager', () => {
      // Register the plugin
      platformManager.registerPlugin(threadsPlugin)
      
      // Verify registration
      expect(platformManager.isPlatformSupported('threads')).toBe(true)
      expect(platformManager.getRegisteredPlatforms()).toContain('threads')
      
      // Get plugin through manager
      const retrievedPlugin = platformManager.getPlugin('threads')
      expect(retrievedPlugin).toBe(threadsPlugin)
    })

    it('should validate content through platform manager', () => {
      platformManager.registerPlugin(threadsPlugin)
      
      const validContent: PostContent = {
        type: 'single',
        text: 'Valid post content',
        metadata: {}
      }
      
      const result = platformManager.validateContent('threads', validContent)
      expect(result.isValid).toBe(true)
    })

    it('should publish content through platform manager', async () => {
      platformManager.registerPlugin(threadsPlugin)
      
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
        text: 'Test post through platform manager',
        metadata: {}
      }

      const result = await platformManager.publishPost('threads', content, mockCredentials)
      
      expect(result.success).toBe(true)
      expect(result.postId).toBe('post-id-123')
    })

    it('should get platform capabilities through manager', () => {
      platformManager.registerPlugin(threadsPlugin)
      
      const capabilities = platformManager.getPlatformCapabilities('threads')
      
      expect(capabilities).toEqual({
        platform: 'threads',
        displayName: 'Threads',
        contentLimits: {
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
        },
        supportedContentTypes: ['single', 'thread', 'media']
      })
    })

    it('should handle multiple platform registrations', () => {
      // Register Threads plugin
      platformManager.registerPlugin(threadsPlugin)
      
      // Create a mock Twitter plugin for testing
      const mockTwitterPlugin = {
        name: 'twitter' as Platform,
        displayName: 'Twitter/X',
        validateContent: vi.fn(() => ({ isValid: true, errors: [] })),
        publishPost: vi.fn(),
        getContentLimits: vi.fn(() => ({
          maxTextLength: 280,
          maxMediaFiles: 4,
          supportedMediaTypes: ['image/jpeg', 'image/png']
        })),
        getSupportedContentTypes: vi.fn(() => ['single', 'thread'])
      }
      
      platformManager.registerPlugin(mockTwitterPlugin as any)
      
      // Verify both platforms are registered
      const registeredPlatforms = platformManager.getRegisteredPlatforms()
      expect(registeredPlatforms).toContain('threads')
      expect(registeredPlatforms).toContain('twitter')
      expect(registeredPlatforms).toHaveLength(2)
      
      // Verify plugin status
      const status = platformManager.getPluginStatus()
      expect(status.threads).toBe(true)
      expect(status.twitter).toBe(true)
      expect(status.instagram).toBe(false)
      expect(status.linkedin).toBe(false)
    })

    it('should handle plugin unregistration', () => {
      platformManager.registerPlugin(threadsPlugin)
      expect(platformManager.isPlatformSupported('threads')).toBe(true)
      
      const unregistered = platformManager.unregisterPlugin('threads')
      expect(unregistered).toBe(true)
      expect(platformManager.isPlatformSupported('threads')).toBe(false)
    })
  })

  describe('error handling integration', () => {
    it('should handle validation errors through platform manager', () => {
      platformManager.registerPlugin(threadsPlugin)
      
      const invalidContent: PostContent = {
        type: 'single',
        text: '', // Empty text should fail
        metadata: {}
      }
      
      const result = platformManager.validateContent('threads', invalidContent)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
    })

    it('should handle unsupported platform through manager', () => {
      // Don't register any plugins
      
      const content: PostContent = {
        type: 'single',
        text: 'Test content',
        metadata: {}
      }
      
      const result = platformManager.validateContent('threads', content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('Platform threads is not supported')
    })

    it('should handle credential mismatch through manager', async () => {
      platformManager.registerPlugin(threadsPlugin)
      
      const content: PostContent = {
        type: 'single',
        text: 'Test content',
        metadata: {}
      }
      
      const wrongCredentials = {
        ...mockCredentials,
        platform: 'twitter' as Platform
      }
      
      await expect(platformManager.publishPost('threads', content, wrongCredentials))
        .rejects.toThrow('Credentials platform twitter does not match target platform threads')
    })
  })

  describe('real-world usage scenarios', () => {
    it('should handle complete posting workflow', async () => {
      // Setup
      platformManager.registerPlugin(threadsPlugin)
      
      // Mock API responses
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
      
      // 1. Check if platform is supported
      expect(platformManager.isPlatformSupported('threads')).toBe(true)
      
      // 2. Get platform capabilities
      const capabilities = platformManager.getPlatformCapabilities('threads')
      expect(capabilities).toBeTruthy()
      expect(capabilities!.contentLimits.maxTextLength).toBe(500)
      
      // 3. Create content within limits
      const content: PostContent = {
        type: 'single',
        text: 'A'.repeat(400), // Within 500 character limit
        metadata: {}
      }
      
      // 4. Validate content
      const validation = platformManager.validateContent('threads', content)
      expect(validation.isValid).toBe(true)
      
      // 5. Publish content
      const result = await platformManager.publishPost('threads', content, mockCredentials)
      expect(result.success).toBe(true)
      expect(result.postId).toBe('post-id-123')
    })

    it('should handle thread posting workflow', async () => {
      platformManager.registerPlugin(threadsPlugin)
      
      // Mock API responses for thread
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
      
      const threadContent: PostContent = {
        type: 'thread',
        text: 'First post in thread',
        threadPosts: [
          'First post in thread',
          'Second post in thread'
        ],
        metadata: {}
      }
      
      // Validate thread content
      const validation = platformManager.validateContent('threads', threadContent)
      expect(validation.isValid).toBe(true)
      
      // Publish thread
      const result = await platformManager.publishPost('threads', threadContent, mockCredentials)
      expect(result.success).toBe(true)
      expect(result.platformResponse.totalPosts).toBe(2)
    })
  })
})