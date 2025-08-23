// ============================================================================
// PLATFORM MANAGER TESTS
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  PlatformManager, 
  BasePlatformPlugin, 
  platformManager 
} from '../services/platformManager'
import {
  Platform,
  PostContent,
  ValidationResult,
  PublishResult,
  PlatformCredentials,
  ContentLimits,
  PostContentType,
  ErrorCode,
  PlatformError
} from '../types'

// Mock platform plugin for testing
class MockPlatformPlugin extends BasePlatformPlugin {
  name: Platform = 'threads'
  displayName = 'Test Threads'

  validateContent(content: PostContent): ValidationResult {
    const errors = this.validateTextContent(content.text, 500)
    return errors.length > 0 ? this.createValidationFailure(errors) : this.createValidationSuccess()
  }

  async publishPost(content: PostContent, credentials: PlatformCredentials): Promise<PublishResult> {
    if (content.text === 'fail') {
      return this.createPublishFailure('Mock publish failure')
    }
    return this.createPublishSuccess('mock-post-id', { mockResponse: true })
  }

  getContentLimits(): ContentLimits {
    return {
      maxTextLength: 500,
      maxMediaFiles: 10,
      supportedMediaTypes: ['image/jpeg', 'image/png'],
      maxThreadLength: 20
    }
  }

  getSupportedContentTypes(): PostContentType[] {
    return ['single', 'thread', 'media']
  }
}

// Invalid plugin for testing validation
class InvalidPlugin {
  name: Platform = 'twitter'
  displayName = 'Invalid Plugin'
  // Missing required methods
}

describe('BasePlatformPlugin', () => {
  let plugin: MockPlatformPlugin

  beforeEach(() => {
    plugin = new MockPlatformPlugin()
  })

  describe('validateTextContent', () => {
    it('should return error for empty text', () => {
      const errors = plugin['validateTextContent']('', 500)
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe(ErrorCode.REQUIRED_FIELD_MISSING)
      expect(errors[0].field).toBe('text')
    })

    it('should return error for text exceeding max length', () => {
      const longText = 'a'.repeat(501)
      const errors = plugin['validateTextContent'](longText, 500)
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe(ErrorCode.CONTENT_TOO_LONG)
      expect(errors[0].field).toBe('text')
    })

    it('should return no errors for valid text', () => {
      const errors = plugin['validateTextContent']('Valid text content', 500)
      expect(errors).toHaveLength(0)
    })
  })

  describe('validateMediaContent', () => {
    it('should return error for too many media files', () => {
      const mediaUrls = Array(11).fill('http://example.com/image.jpg')
      const limits: ContentLimits = {
        maxTextLength: 500,
        maxMediaFiles: 10,
        supportedMediaTypes: ['image/jpeg']
      }
      
      const errors = plugin['validateMediaContent'](mediaUrls, limits)
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe(ErrorCode.TOO_MANY_MEDIA_FILES)
    })

    it('should return no errors for valid media count', () => {
      const mediaUrls = ['http://example.com/image.jpg']
      const limits: ContentLimits = {
        maxTextLength: 500,
        maxMediaFiles: 10,
        supportedMediaTypes: ['image/jpeg']
      }
      
      const errors = plugin['validateMediaContent'](mediaUrls, limits)
      expect(errors).toHaveLength(0)
    })
  })

  describe('validateThreadContent', () => {
    it('should return error for empty thread', () => {
      const errors = plugin['validateThreadContent']([], 20)
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe(ErrorCode.EMPTY_THREAD)
    })

    it('should return error for thread exceeding max length', () => {
      const threadPosts = Array(21).fill('Thread post content')
      const errors = plugin['validateThreadContent'](threadPosts, 20)
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe(ErrorCode.THREAD_TOO_LONG)
    })

    it('should return no errors for valid thread', () => {
      const threadPosts = ['Post 1', 'Post 2', 'Post 3']
      const errors = plugin['validateThreadContent'](threadPosts, 20)
      expect(errors).toHaveLength(0)
    })
  })

  describe('helper methods', () => {
    it('should create successful validation result', () => {
      const result = plugin['createValidationSuccess']()
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should create failed validation result', () => {
      const errors = [{
        field: 'text',
        message: 'Test error',
        code: ErrorCode.VALIDATION_ERROR,
        value: 'test'
      }]
      const result = plugin['createValidationFailure'](errors)
      expect(result.isValid).toBe(false)
      expect(result.errors).toEqual(errors)
    })

    it('should create successful publish result', () => {
      const result = plugin['createPublishSuccess']('test-id', { test: true })
      expect(result.success).toBe(true)
      expect(result.postId).toBe('test-id')
      expect(result.platformResponse).toEqual({ test: true })
    })

    it('should create failed publish result', () => {
      const result = plugin['createPublishFailure']('Test error', { error: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Test error')
      expect(result.platformResponse).toEqual({ error: true })
    })
  })
})

describe('PlatformManager', () => {
  let manager: PlatformManager
  let mockPlugin: MockPlatformPlugin

  beforeEach(() => {
    manager = PlatformManager.getInstance()
    manager.clearPlugins() // Clear any existing plugins
    mockPlugin = new MockPlatformPlugin()
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PlatformManager.getInstance()
      const instance2 = PlatformManager.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('plugin registration', () => {
    it('should register a valid plugin', () => {
      expect(() => manager.registerPlugin(mockPlugin)).not.toThrow()
      expect(manager.isPlatformSupported('threads')).toBe(true)
    })

    it('should throw error for plugin without name', () => {
      const invalidPlugin = { ...mockPlugin, name: undefined } as any
      expect(() => manager.registerPlugin(invalidPlugin)).toThrow('Plugin must have a name')
    })

    it('should throw error for plugin without display name', () => {
      const invalidPlugin = { ...mockPlugin, displayName: undefined } as any
      expect(() => manager.registerPlugin(invalidPlugin)).toThrow('Plugin must have a display name')
    })

    it('should throw error for plugin missing required methods', () => {
      const invalidPlugin = new InvalidPlugin() as any
      expect(() => manager.registerPlugin(invalidPlugin)).toThrow('Plugin must implement validateContent method')
    })

    it('should unregister a plugin', () => {
      manager.registerPlugin(mockPlugin)
      expect(manager.isPlatformSupported('threads')).toBe(true)
      
      const result = manager.unregisterPlugin('threads')
      expect(result).toBe(true)
      expect(manager.isPlatformSupported('threads')).toBe(false)
    })

    it('should return false when unregistering non-existent plugin', () => {
      const result = manager.unregisterPlugin('twitter')
      expect(result).toBe(false)
    })
  })

  describe('plugin retrieval', () => {
    beforeEach(() => {
      manager.registerPlugin(mockPlugin)
    })

    it('should get registered plugin', () => {
      const plugin = manager.getPlugin('threads')
      expect(plugin).toBe(mockPlugin)
    })

    it('should return null for unregistered plugin', () => {
      const plugin = manager.getPlugin('twitter')
      expect(plugin).toBeNull()
    })

    it('should get all registered platforms', () => {
      const platforms = manager.getRegisteredPlatforms()
      expect(platforms).toEqual(['threads'])
    })

    it('should get all registered plugins', () => {
      const plugins = manager.getAllPlugins()
      expect(plugins).toEqual([mockPlugin])
    })
  })

  describe('content validation', () => {
    beforeEach(() => {
      manager.registerPlugin(mockPlugin)
    })

    it('should validate content for supported platform', () => {
      const content: PostContent = {
        type: 'single',
        text: 'Valid content',
        metadata: {}
      }

      const result = manager.validateContent('threads', content)
      expect(result.isValid).toBe(true)
    })

    it('should return error for unsupported platform', () => {
      const content: PostContent = {
        type: 'single',
        text: 'Valid content',
        metadata: {}
      }

      const result = manager.validateContent('twitter', content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.PLATFORM_API_ERROR)
    })

    it('should return validation errors for invalid content', () => {
      const content: PostContent = {
        type: 'single',
        text: '', // Empty text should fail validation
        metadata: {}
      }

      const result = manager.validateContent('threads', content)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe(ErrorCode.REQUIRED_FIELD_MISSING)
    })
  })

  describe('post publishing', () => {
    let mockCredentials: PlatformCredentials

    beforeEach(() => {
      manager.registerPlugin(mockPlugin)
      mockCredentials = {
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads',
        credentials: { accessToken: 'token' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    it('should publish content successfully', async () => {
      const content: PostContent = {
        type: 'single',
        text: 'Valid content',
        metadata: {}
      }

      const result = await manager.publishPost('threads', content, mockCredentials)
      expect(result.success).toBe(true)
      expect(result.postId).toBe('mock-post-id')
    })

    it('should throw error for unsupported platform', async () => {
      const content: PostContent = {
        type: 'single',
        text: 'Valid content',
        metadata: {}
      }

      await expect(manager.publishPost('twitter', content, mockCredentials))
        .rejects.toThrow(PlatformError)
    })

    it('should throw error for mismatched credentials', async () => {
      const content: PostContent = {
        type: 'single',
        text: 'Valid content',
        metadata: {}
      }

      const wrongCredentials = { ...mockCredentials, platform: 'twitter' as Platform }

      await expect(manager.publishPost('threads', content, wrongCredentials))
        .rejects.toThrow(PlatformError)
    })

    it('should return failure for invalid content', async () => {
      const content: PostContent = {
        type: 'single',
        text: '', // Empty text should fail validation
        metadata: {}
      }

      const result = await manager.publishPost('threads', content, mockCredentials)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Content validation failed')
    })

    it('should handle plugin publish failures', async () => {
      const content: PostContent = {
        type: 'single',
        text: 'fail', // This triggers mock failure
        metadata: {}
      }

      const result = await manager.publishPost('threads', content, mockCredentials)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Mock publish failure')
    })
  })

  describe('platform capabilities', () => {
    beforeEach(() => {
      manager.registerPlugin(mockPlugin)
    })

    it('should get content limits for platform', () => {
      const limits = manager.getContentLimits('threads')
      expect(limits).toEqual({
        maxTextLength: 500,
        maxMediaFiles: 10,
        supportedMediaTypes: ['image/jpeg', 'image/png'],
        maxThreadLength: 20
      })
    })

    it('should return null for unsupported platform', () => {
      const limits = manager.getContentLimits('twitter')
      expect(limits).toBeNull()
    })

    it('should get supported content types', () => {
      const types = manager.getSupportedContentTypes('threads')
      expect(types).toEqual(['single', 'thread', 'media'])
    })

    it('should get platform capabilities summary', () => {
      const capabilities = manager.getPlatformCapabilities('threads')
      expect(capabilities).toEqual({
        platform: 'threads',
        displayName: 'Test Threads',
        contentLimits: {
          maxTextLength: 500,
          maxMediaFiles: 10,
          supportedMediaTypes: ['image/jpeg', 'image/png'],
          maxThreadLength: 20
        },
        supportedContentTypes: ['single', 'thread', 'media']
      })
    })

    it('should return null for unsupported platform capabilities', () => {
      const capabilities = manager.getPlatformCapabilities('twitter')
      expect(capabilities).toBeNull()
    })
  })

  describe('plugin status', () => {
    it('should get plugin registration status', () => {
      manager.registerPlugin(mockPlugin)
      
      const status = manager.getPluginStatus()
      expect(status).toEqual({
        threads: true,
        twitter: false,
        instagram: false,
        linkedin: false
      })
    })
  })

  describe('utility methods', () => {
    it('should clear all plugins', () => {
      manager.registerPlugin(mockPlugin)
      expect(manager.getRegisteredPlatforms()).toHaveLength(1)
      
      manager.clearPlugins()
      expect(manager.getRegisteredPlatforms()).toHaveLength(0)
    })
  })
})

describe('platformManager singleton', () => {
  it('should export singleton instance', () => {
    expect(platformManager).toBeInstanceOf(PlatformManager)
  })

  it('should be the same instance as getInstance()', () => {
    expect(platformManager).toBe(PlatformManager.getInstance())
  })
})