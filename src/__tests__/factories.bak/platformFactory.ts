import { PlatformCredentials, ContentLimits, ValidationResult, PublishResult } from '../../types'

export interface PlatformFactoryOptions {
  platform?: string
  isActive?: boolean
  expiresAt?: Date
}

export const createMockPlatformCredentials = (options: PlatformFactoryOptions = {}): PlatformCredentials => {
  const defaultCredentials: PlatformCredentials = {
    id: 'cred-123',
    userId: 'user-123',
    platform: 'threads',
    credentials: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      userId: 'platform-user-123',
    },
    isActive: true,
    expiresAt: new Date('2024-12-31T23:59:59Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
  }

  return {
    ...defaultCredentials,
    ...options,
  }
}

export const createMockContentLimits = (platform: string = 'threads'): ContentLimits => {
  const limits: Record<string, ContentLimits> = {
    threads: {
      maxTextLength: 500,
      maxMediaFiles: 10,
      maxThreadLength: 20,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
    },
    twitter: {
      maxTextLength: 280,
      maxMediaFiles: 4,
      maxThreadLength: 25,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
    },
    instagram: {
      maxTextLength: 2200,
      maxMediaFiles: 10,
      maxThreadLength: 1,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
      maxFileSize: 100 * 1024 * 1024, // 100MB
    },
  }

  return limits[platform] || limits.threads
}

export const createMockValidationResult = (isValid: boolean = true): ValidationResult => {
  if (isValid) {
    return {
      isValid: true,
      errors: [],
    }
  }

  return {
    isValid: false,
    errors: [
      {
        field: 'text',
        message: 'Text content exceeds maximum length',
        code: 'TEXT_TOO_LONG',
      },
      {
        field: 'media',
        message: 'Unsupported media type',
        code: 'INVALID_MEDIA_TYPE',
      },
    ],
  }
}

export const createMockPublishResult = (success: boolean = true): PublishResult => {
  if (success) {
    return {
      success: true,
      platformPostId: 'platform-post-123',
      publishedAt: new Date(),
    }
  }

  return {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'API rate limit exceeded. Please try again later.',
    },
  }
}

export const createMockPlatformPlugin = (platform: string = 'threads') => {
  return {
    name: platform,
    validateContent: vi.fn().mockReturnValue(createMockValidationResult(true)),
    publishPost: vi.fn().mockResolvedValue(createMockPublishResult(true)),
    getContentLimits: vi.fn().mockReturnValue(createMockContentLimits(platform)),
    getSupportedContentTypes: vi.fn().mockReturnValue(['single', 'thread', 'media']),
  }
}

export const createMockThreadsPlugin = () => {
  const basePlugin = createMockPlatformPlugin('threads')
  
  return {
    ...basePlugin,
    publishThread: vi.fn().mockResolvedValue(createMockPublishResult(true)),
    uploadMedia: vi.fn().mockResolvedValue('https://example.com/uploaded-media.jpg'),
  }
}

export const createMockPlatformError = (code: string, message: string) => {
  return {
    code,
    message,
    timestamp: new Date(),
    platform: 'threads',
  }
}

export const createMockOAuthResponse = (platform: string = 'threads') => {
  return {
    access_token: 'oauth-access-token',
    refresh_token: 'oauth-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    scope: 'read write',
    user_id: `${platform}-user-123`,
  }
}