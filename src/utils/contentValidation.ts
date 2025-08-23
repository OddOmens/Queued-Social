// ============================================================================
// CONTENT VALIDATION UTILITIES
// ============================================================================

import {
  PostContent,
  SinglePostContent,
  ThreadPostContent,
  MediaPostContent,
  Platform,
  ValidationResult,
  ValidationError,
  ErrorCode,
  isSinglePostContent,
  isThreadPostContent,
  isMediaPostContent
} from '../types'
import { PLATFORM_CONFIGS } from '../types/platform'

// ============================================================================
// MEDIA FILE VALIDATION
// ============================================================================

export interface MediaFile {
  file: File
  url?: string
  type: 'image' | 'video'
}

export interface MediaValidationOptions {
  maxFileSize: number // bytes
  allowedMimeTypes: string[]
  maxDimensions?: { width: number; height: number }
  minDimensions?: { width: number; height: number }
  maxDuration?: number // seconds for video
}

export const validateMediaFile = async (
  file: File,
  options: MediaValidationOptions
): Promise<ValidationResult> => {
  const errors: ValidationError[] = []

  // File size validation
  if (file.size > options.maxFileSize) {
    errors.push({
      field: 'mediaFile',
      message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(options.maxFileSize / 1024 / 1024).toFixed(2)}MB`,
      code: ErrorCode.MEDIA_TOO_LARGE,
      value: file.size
    })
  }

  // MIME type validation
  if (!options.allowedMimeTypes.includes(file.type)) {
    errors.push({
      field: 'mediaFile',
      message: `File type ${file.type} is not supported. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
      code: ErrorCode.INVALID_MEDIA_FORMAT,
      value: file.type
    })
  }

  // Image dimension validation
  if (file.type.startsWith('image/') && (options.maxDimensions || options.minDimensions)) {
    try {
      const dimensions = await getImageDimensions(file)
      
      if (options.maxDimensions) {
        if (dimensions.width > options.maxDimensions.width || dimensions.height > options.maxDimensions.height) {
          errors.push({
            field: 'mediaFile',
            message: `Image dimensions ${dimensions.width}x${dimensions.height} exceed maximum ${options.maxDimensions.width}x${options.maxDimensions.height}`,
            code: ErrorCode.INVALID_MEDIA_FORMAT,
            value: dimensions
          })
        }
      }

      if (options.minDimensions) {
        if (dimensions.width < options.minDimensions.width || dimensions.height < options.minDimensions.height) {
          errors.push({
            field: 'mediaFile',
            message: `Image dimensions ${dimensions.width}x${dimensions.height} below minimum ${options.minDimensions.width}x${options.minDimensions.height}`,
            code: ErrorCode.INVALID_MEDIA_FORMAT,
            value: dimensions
          })
        }
      }
    } catch (error) {
      errors.push({
        field: 'mediaFile',
        message: 'Unable to read image dimensions',
        code: ErrorCode.INVALID_MEDIA_FORMAT
      })
    }
  }

  // Video duration validation (would need additional implementation for actual video processing)
  if (file.type.startsWith('video/') && options.maxDuration) {
    // Note: This would require video processing library in a real implementation
    // For now, we'll skip this validation
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })
}

// ============================================================================
// CONTENT VALIDATION FUNCTIONS
// ============================================================================

export const validateSinglePostContent = (
  content: SinglePostContent,
  platform: Platform
): ValidationResult => {
  const errors: ValidationError[] = []
  const config = PLATFORM_CONFIGS[platform]

  // Text validation
  if (!content.text || content.text.trim().length === 0) {
    errors.push({
      field: 'text',
      message: 'Post text is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING
    })
  } else if (content.text.length > config.contentLimits.maxTextLength) {
    errors.push({
      field: 'text',
      message: `Text exceeds ${config.contentLimits.maxTextLength} character limit for ${config.displayName}`,
      code: ErrorCode.CONTENT_TOO_LONG,
      value: content.text.length
    })
  }

  // Media validation
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    if (content.mediaUrls.length > config.contentLimits.maxMediaFiles) {
      errors.push({
        field: 'mediaUrls',
        message: `Maximum ${config.contentLimits.maxMediaFiles} media files allowed for ${config.displayName}`,
        code: ErrorCode.TOO_MANY_MEDIA_FILES,
        value: content.mediaUrls.length
      })
    }

    // Validate each media URL format
    content.mediaUrls.forEach((url, index) => {
      if (!isValidUrl(url)) {
        errors.push({
          field: `mediaUrls[${index}]`,
          message: `Invalid media URL format`,
          code: ErrorCode.INVALID_MEDIA_FORMAT,
          value: url
        })
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validateThreadPostContent = (
  content: ThreadPostContent,
  platform: Platform
): ValidationResult => {
  const errors: ValidationError[] = []
  const config = PLATFORM_CONFIGS[platform]

  // Check if platform supports threads
  if (!config.features.threads) {
    errors.push({
      field: 'type',
      message: `${config.displayName} does not support thread posts`,
      code: ErrorCode.INVALID_CONTENT
    })
    return { isValid: false, errors }
  }

  // Main text validation
  if (!content.text || content.text.trim().length === 0) {
    errors.push({
      field: 'text',
      message: 'Thread starter text is required',
      code: ErrorCode.REQUIRED_FIELD_MISSING
    })
  } else if (content.text.length > config.contentLimits.maxTextLength) {
    errors.push({
      field: 'text',
      message: `Thread starter text exceeds ${config.contentLimits.maxTextLength} character limit`,
      code: ErrorCode.CONTENT_TOO_LONG,
      value: content.text.length
    })
  }

  // Thread posts validation
  if (!content.threadPosts || content.threadPosts.length === 0) {
    errors.push({
      field: 'threadPosts',
      message: 'Thread must contain at least one additional post',
      code: ErrorCode.EMPTY_THREAD
    })
  } else {
    const maxThreadLength = config.contentLimits.maxThreadLength || 10
    const totalPosts = content.threadPosts.length + 1 // +1 for main post

    if (totalPosts > maxThreadLength) {
      errors.push({
        field: 'threadPosts',
        message: `Thread cannot exceed ${maxThreadLength} total posts (including starter)`,
        code: ErrorCode.THREAD_TOO_LONG,
        value: totalPosts
      })
    }

    // Validate each thread post
    content.threadPosts.forEach((post, index) => {
      if (!post || post.trim().length === 0) {
        errors.push({
          field: `threadPosts[${index}]`,
          message: `Thread post ${index + 2} cannot be empty`,
          code: ErrorCode.REQUIRED_FIELD_MISSING
        })
      } else if (post.length > config.contentLimits.maxTextLength) {
        errors.push({
          field: `threadPosts[${index}]`,
          message: `Thread post ${index + 2} exceeds ${config.contentLimits.maxTextLength} character limit`,
          code: ErrorCode.THREAD_POST_TOO_LONG,
          value: post.length
        })
      }
    })
  }

  // Main post media validation
  if (content.mediaUrls && content.mediaUrls.length > 0) {
    if (content.mediaUrls.length > config.contentLimits.maxMediaFiles) {
      errors.push({
        field: 'mediaUrls',
        message: `Maximum ${config.contentLimits.maxMediaFiles} media files allowed for main post`,
        code: ErrorCode.TOO_MANY_MEDIA_FILES,
        value: content.mediaUrls.length
      })
    }
  }

  // Thread media validation (if supported)
  if (content.metadata.threadMediaUrls) {
    content.metadata.threadMediaUrls.forEach((mediaUrls, index) => {
      if (mediaUrls && mediaUrls.length > config.contentLimits.maxMediaFiles) {
        errors.push({
          field: `threadMediaUrls[${index}]`,
          message: `Thread post ${index + 2} exceeds ${config.contentLimits.maxMediaFiles} media file limit`,
          code: ErrorCode.TOO_MANY_MEDIA_FILES,
          value: mediaUrls.length
        })
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validateMediaPostContent = (
  content: MediaPostContent,
  platform: Platform
): ValidationResult => {
  const errors: ValidationError[] = []
  const config = PLATFORM_CONFIGS[platform]

  // Check if platform supports media posts
  if (!config.features.media) {
    errors.push({
      field: 'type',
      message: `${config.displayName} does not support media posts`,
      code: ErrorCode.INVALID_CONTENT
    })
    return { isValid: false, errors }
  }

  // Media is required for media posts
  if (!content.mediaUrls || content.mediaUrls.length === 0) {
    errors.push({
      field: 'mediaUrls',
      message: 'Media files are required for media posts',
      code: ErrorCode.REQUIRED_FIELD_MISSING
    })
  } else {
    if (content.mediaUrls.length > config.contentLimits.maxMediaFiles) {
      errors.push({
        field: 'mediaUrls',
        message: `Maximum ${config.contentLimits.maxMediaFiles} media files allowed for ${config.displayName}`,
        code: ErrorCode.TOO_MANY_MEDIA_FILES,
        value: content.mediaUrls.length
      })
    }

    // Validate each media URL
    content.mediaUrls.forEach((url, index) => {
      if (!isValidUrl(url)) {
        errors.push({
          field: `mediaUrls[${index}]`,
          message: `Invalid media URL format`,
          code: ErrorCode.INVALID_MEDIA_FORMAT,
          value: url
        })
      }
    })
  }

  // Text validation (optional for media posts but has limits if provided)
  if (content.text && content.text.length > config.contentLimits.maxTextLength) {
    errors.push({
      field: 'text',
      message: `Caption exceeds ${config.contentLimits.maxTextLength} character limit for ${config.displayName}`,
      code: ErrorCode.CONTENT_TOO_LONG,
      value: content.text.length
    })
  }

  // Alt text validation
  if (content.metadata.altText) {
    if (content.metadata.altText.length !== content.mediaUrls.length) {
      errors.push({
        field: 'altText',
        message: 'Alt text array must match media files count',
        code: ErrorCode.VALIDATION_ERROR
      })
    }

    content.metadata.altText.forEach((alt, index) => {
      if (alt && alt.length > 1000) { // Common alt text limit
        errors.push({
          field: `altText[${index}]`,
          message: 'Alt text cannot exceed 1000 characters',
          code: ErrorCode.CONTENT_TOO_LONG,
          value: alt.length
        })
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export const validatePostContent = (
  content: PostContent,
  platform: Platform
): ValidationResult => {
  // Type-specific validation
  if (isSinglePostContent(content)) {
    return validateSinglePostContent(content, platform)
  } else if (isThreadPostContent(content)) {
    return validateThreadPostContent(content, platform)
  } else if (isMediaPostContent(content)) {
    return validateMediaPostContent(content, platform)
  }

  // Fallback for unknown content type
  return {
    isValid: false,
    errors: [{
      field: 'type',
      message: `Unknown post content type: ${(content as any).type}`,
      code: ErrorCode.INVALID_CONTENT
    }]
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export const getMediaValidationOptions = (platform: Platform): MediaValidationOptions => {
  const config = PLATFORM_CONFIGS[platform]
  
  return {
    maxFileSize: 50 * 1024 * 1024, // 50MB default
    allowedMimeTypes: config.contentLimits.supportedMediaTypes,
    maxDimensions: { width: 4096, height: 4096 }, // Default max dimensions
    minDimensions: { width: 100, height: 100 } // Default min dimensions
  }
}

export function createPostContentFactory(
  type: 'single',
  text: string,
  options?: { mediaUrls?: string[]; metadata?: Record<string, any> }
): SinglePostContent
export function createPostContentFactory(
  type: 'thread',
  text: string,
  options?: { threadPosts?: string[]; mediaUrls?: string[]; metadata?: Record<string, any> }
): ThreadPostContent
export function createPostContentFactory(
  type: 'media',
  text: string,
  options?: { mediaUrls: string[]; metadata?: Record<string, any> }
): MediaPostContent
export function createPostContentFactory(
  type: 'single' | 'thread' | 'media',
  text: string,
  options: any = {}
): PostContent {
  const baseContent = {
    text,
    metadata: options.metadata || {}
  }

  switch (type) {
    case 'single':
      return {
        type: 'single',
        ...baseContent,
        mediaUrls: options.mediaUrls
      }
    case 'thread':
      return {
        type: 'thread',
        ...baseContent,
        threadPosts: options.threadPosts || [],
        mediaUrls: options.mediaUrls
      }
    case 'media':
      return {
        type: 'media',
        ...baseContent,
        mediaUrls: options.mediaUrls || []
      }
    default:
      throw new Error(`Unknown post content type: ${type}`)
  }
}

// Alias for backward compatibility
export const validateContentForPlatform = validatePostContent