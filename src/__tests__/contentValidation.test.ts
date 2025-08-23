// ============================================================================
// CONTENT VALIDATION TESTS
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validatePostContent,
  validateSinglePostContent,
  validateThreadPostContent,
  validateMediaPostContent,
  validateMediaFile,
  getMediaValidationOptions,
  createPostContentFactory
} from '../utils/contentValidation'
import {
  SinglePostContent,
  ThreadPostContent,
  MediaPostContent,
  Platform,
  ErrorCode
} from '../types'

// ============================================================================
// MOCK DATA
// ============================================================================

const mockSinglePost: SinglePostContent = {
  type: 'single',
  text: 'This is a test post',
  mediaUrls: ['https://example.com/image.jpg'],
  metadata: {
    replySettings: 'everyone',
    allowReplies: true
  }
}

const mockThreadPost: ThreadPostContent = {
  type: 'thread',
  text: 'This is the main thread post',
  threadPosts: [
    'This is the second post in the thread',
    'This is the third post in the thread'
  ],
  mediaUrls: ['https://example.com/image.jpg'],
  metadata: {
    replySettings: 'everyone',
    allowReplies: true
  }
}

const mockMediaPost: MediaPostContent = {
  type: 'media',
  text: 'Check out this amazing photo!',
  mediaUrls: [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg'
  ],
  metadata: {
    altText: ['Beautiful sunset', 'Mountain landscape'],
    mediaTypes: ['image', 'image']
  }
}

// ============================================================================
// SINGLE POST VALIDATION TESTS
// ============================================================================

describe('validateSinglePostContent', () => {
  it('should validate a valid single post', () => {
    const result = validateSinglePostContent(mockSinglePost, 'threads')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject empty text', () => {
    const invalidPost: SinglePostContent = {
      ...mockSinglePost,
      text: ''
    }
    
    const result = validateSinglePostContent(invalidPost, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.REQUIRED_FIELD_MISSING)
    expect(result.errors[0].field).toBe('text')
  })

  it('should reject text that exceeds platform limits', () => {
    const longText = 'a'.repeat(501) // Threads limit is 500
    const invalidPost: SinglePostContent = {
      ...mockSinglePost,
      text: longText
    }
    
    const result = validateSinglePostContent(invalidPost, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.CONTENT_TOO_LONG)
    expect(result.errors[0].field).toBe('text')
    expect(result.errors[0].value).toBe(501)
  })

  it('should reject too many media files', () => {
    const tooManyMedia = Array(11).fill('https://example.com/image.jpg') // Threads limit is 10
    const invalidPost: SinglePostContent = {
      ...mockSinglePost,
      mediaUrls: tooManyMedia
    }
    
    const result = validateSinglePostContent(invalidPost, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.TOO_MANY_MEDIA_FILES)
    expect(result.errors[0].field).toBe('mediaUrls')
    expect(result.errors[0].value).toBe(11)
  })

  it('should reject invalid media URLs', () => {
    const invalidPost: SinglePostContent = {
      ...mockSinglePost,
      mediaUrls: ['not-a-valid-url', 'https://example.com/valid.jpg']
    }
    
    const result = validateSinglePostContent(invalidPost, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.INVALID_MEDIA_FORMAT)
    expect(result.errors[0].field).toBe('mediaUrls[0]')
  })

  it('should handle different platform limits', () => {
    const twitterPost: SinglePostContent = {
      ...mockSinglePost,
      text: 'a'.repeat(281) // Twitter limit is 280
    }
    
    const result = validateSinglePostContent(twitterPost, 'twitter')
    expect(result.isValid).toBe(false)
    expect(result.errors[0].code).toBe(ErrorCode.CONTENT_TOO_LONG)
  })
})

// ============================================================================
// THREAD POST VALIDATION TESTS
// ============================================================================

describe('validateThreadPostContent', () => {
  it('should validate a valid thread post', () => {
    const result = validateThreadPostContent(mockThreadPost, 'threads')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject platforms that do not support threads', () => {
    const result = validateThreadPostContent(mockThreadPost, 'instagram')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.INVALID_CONTENT)
    expect(result.errors[0].field).toBe('type')
  })

  it('should reject empty main text', () => {
    const invalidThread: ThreadPostContent = {
      ...mockThreadPost,
      text: ''
    }
    
    const result = validateThreadPostContent(invalidThread, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.REQUIRED_FIELD_MISSING)
    expect(result.errors[0].field).toBe('text')
  })

  it('should reject empty thread posts array', () => {
    const invalidThread: ThreadPostContent = {
      ...mockThreadPost,
      threadPosts: []
    }
    
    const result = validateThreadPostContent(invalidThread, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.EMPTY_THREAD)
    expect(result.errors[0].field).toBe('threadPosts')
  })

  it('should reject threads that exceed platform limits', () => {
    const tooManyPosts = Array(21).fill('Thread post') // Threads limit is 20 + 1 main = 21 total
    const invalidThread: ThreadPostContent = {
      ...mockThreadPost,
      threadPosts: tooManyPosts
    }
    
    const result = validateThreadPostContent(invalidThread, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.THREAD_TOO_LONG)
    expect(result.errors[0].field).toBe('threadPosts')
    expect(result.errors[0].value).toBe(22) // 21 thread posts + 1 main post
  })

  it('should reject empty individual thread posts', () => {
    const invalidThread: ThreadPostContent = {
      ...mockThreadPost,
      threadPosts: ['Valid post', '', 'Another valid post']
    }
    
    const result = validateThreadPostContent(invalidThread, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.REQUIRED_FIELD_MISSING)
    expect(result.errors[0].field).toBe('threadPosts[1]')
  })

  it('should reject thread posts that exceed character limits', () => {
    const longPost = 'a'.repeat(501) // Threads limit is 500
    const invalidThread: ThreadPostContent = {
      ...mockThreadPost,
      threadPosts: ['Valid post', longPost]
    }
    
    const result = validateThreadPostContent(invalidThread, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.THREAD_POST_TOO_LONG)
    expect(result.errors[0].field).toBe('threadPosts[1]')
    expect(result.errors[0].value).toBe(501)
  })

  it('should validate thread media URLs', () => {
    const threadWithMedia: ThreadPostContent = {
      ...mockThreadPost,
      metadata: {
        ...mockThreadPost.metadata,
        threadMediaUrls: [
          ['https://example.com/image1.jpg'],
          Array(11).fill('https://example.com/image.jpg') // Too many for second post
        ]
      }
    }
    
    const result = validateThreadPostContent(threadWithMedia, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.TOO_MANY_MEDIA_FILES)
    expect(result.errors[0].field).toBe('threadMediaUrls[1]')
  })
})

// ============================================================================
// MEDIA POST VALIDATION TESTS
// ============================================================================

describe('validateMediaPostContent', () => {
  it('should validate a valid media post', () => {
    const result = validateMediaPostContent(mockMediaPost, 'threads')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject platforms that do not support media posts', () => {
    // Note: All current platforms support media, but we can test the logic
    const mockPlatform = 'threads' as Platform
    // We would need to mock PLATFORM_CONFIGS for this test
    // For now, we'll skip this specific test case
  })

  it('should reject media posts without media files', () => {
    const invalidMedia: MediaPostContent = {
      ...mockMediaPost,
      mediaUrls: []
    }
    
    const result = validateMediaPostContent(invalidMedia, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.REQUIRED_FIELD_MISSING)
    expect(result.errors[0].field).toBe('mediaUrls')
  })

  it('should reject too many media files', () => {
    const tooManyMedia = Array(11).fill('https://example.com/image.jpg')
    const invalidMedia: MediaPostContent = {
      ...mockMediaPost,
      mediaUrls: tooManyMedia
    }
    
    const result = validateMediaPostContent(invalidMedia, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.TOO_MANY_MEDIA_FILES)
    expect(result.errors[0].field).toBe('mediaUrls')
    expect(result.errors[0].value).toBe(11)
  })

  it('should reject invalid media URLs', () => {
    const invalidMedia: MediaPostContent = {
      ...mockMediaPost,
      mediaUrls: ['not-a-url', 'https://example.com/valid.jpg']
    }
    
    const result = validateMediaPostContent(invalidMedia, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.INVALID_MEDIA_FORMAT)
    expect(result.errors[0].field).toBe('mediaUrls[0]')
  })

  it('should validate caption length', () => {
    const longCaption = 'a'.repeat(501) // Threads limit is 500
    const invalidMedia: MediaPostContent = {
      ...mockMediaPost,
      text: longCaption
    }
    
    const result = validateMediaPostContent(invalidMedia, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.CONTENT_TOO_LONG)
    expect(result.errors[0].field).toBe('text')
  })

  it('should validate alt text array length matches media count', () => {
    const invalidMedia: MediaPostContent = {
      ...mockMediaPost,
      mediaUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
      metadata: {
        ...mockMediaPost.metadata,
        altText: ['Only one alt text'] // Should have two
      }
    }
    
    const result = validateMediaPostContent(invalidMedia, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(result.errors[0].field).toBe('altText')
  })

  it('should validate individual alt text length', () => {
    const longAltText = 'a'.repeat(1001) // Limit is 1000
    const invalidMedia: MediaPostContent = {
      ...mockMediaPost,
      metadata: {
        ...mockMediaPost.metadata,
        altText: [longAltText, 'Valid alt text']
      }
    }
    
    const result = validateMediaPostContent(invalidMedia, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.CONTENT_TOO_LONG)
    expect(result.errors[0].field).toBe('altText[0]')
  })
})

// ============================================================================
// MAIN VALIDATION FUNCTION TESTS
// ============================================================================

describe('validatePostContent', () => {
  it('should route to correct validation function for single posts', () => {
    const result = validatePostContent(mockSinglePost, 'threads')
    expect(result.isValid).toBe(true)
  })

  it('should route to correct validation function for thread posts', () => {
    const result = validatePostContent(mockThreadPost, 'threads')
    expect(result.isValid).toBe(true)
  })

  it('should route to correct validation function for media posts', () => {
    const result = validatePostContent(mockMediaPost, 'threads')
    expect(result.isValid).toBe(true)
  })

  it('should handle unknown content types', () => {
    const unknownContent = {
      type: 'unknown',
      text: 'Test'
    } as any
    
    const result = validatePostContent(unknownContent, 'threads')
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.INVALID_CONTENT)
    expect(result.errors[0].field).toBe('type')
  })
})

// ============================================================================
// MEDIA FILE VALIDATION TESTS
// ============================================================================

describe('validateMediaFile', () => {
  // Mock File object
  const createMockFile = (name: string, size: number, type: string): File => {
    const file = new File([''], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  it('should validate a valid image file', async () => {
    const file = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg') // 1MB
    const options = {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png']
    }
    
    const result = await validateMediaFile(file, options)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject files that are too large', async () => {
    const file = createMockFile('large.jpg', 10 * 1024 * 1024, 'image/jpeg') // 10MB
    const options = {
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
      allowedMimeTypes: ['image/jpeg']
    }
    
    const result = await validateMediaFile(file, options)
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.MEDIA_TOO_LARGE)
  })

  it('should reject unsupported file types', async () => {
    const file = createMockFile('test.bmp', 1024, 'image/bmp')
    const options = {
      maxFileSize: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png']
    }
    
    const result = await validateMediaFile(file, options)
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe(ErrorCode.INVALID_MEDIA_FORMAT)
  })
})

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('getMediaValidationOptions', () => {
  it('should return correct options for threads platform', () => {
    const options = getMediaValidationOptions('threads')
    expect(options.maxFileSize).toBe(50 * 1024 * 1024) // 50MB
    expect(options.allowedMimeTypes).toContain('image/jpeg')
    expect(options.allowedMimeTypes).toContain('video/mp4')
  })

  it('should return correct options for different platforms', () => {
    const threadsOptions = getMediaValidationOptions('threads')
    const twitterOptions = getMediaValidationOptions('twitter')
    
    expect(threadsOptions.allowedMimeTypes).toEqual(twitterOptions.allowedMimeTypes)
  })
})

describe('createPostContentFactory', () => {
  it('should create single post content', () => {
    const content = createPostContentFactory('single', 'Test post', {
      mediaUrls: ['https://example.com/image.jpg']
    })
    
    expect(content.type).toBe('single')
    expect(content.text).toBe('Test post')
    expect(content.mediaUrls).toEqual(['https://example.com/image.jpg'])
  })

  it('should create thread post content', () => {
    const content = createPostContentFactory('thread', 'Main post', {
      threadPosts: ['Second post', 'Third post']
    })
    
    expect(content.type).toBe('thread')
    expect(content.text).toBe('Main post')
    expect((content as ThreadPostContent).threadPosts).toEqual(['Second post', 'Third post'])
  })

  it('should create media post content', () => {
    const content = createPostContentFactory('media', 'Caption', {
      mediaUrls: ['https://example.com/image.jpg']
    })
    
    expect(content.type).toBe('media')
    expect(content.text).toBe('Caption')
    expect(content.mediaUrls).toEqual(['https://example.com/image.jpg'])
  })

  it('should throw error for unknown content type', () => {
    expect(() => {
      createPostContentFactory('unknown' as any, 'Test')
    }).toThrow('Unknown post content type: unknown')
  })
})