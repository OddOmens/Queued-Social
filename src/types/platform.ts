// ============================================================================
// PLATFORM-SPECIFIC TYPES
// ============================================================================

import { PostContent, PlatformCredentials, ValidationResult, PublishResult, ContentLimits, PostContentType, Platform } from './index'

// ============================================================================
// THREADS PLATFORM TYPES
// ============================================================================

export interface ThreadsCredentials extends PlatformCredentials {
  platform: 'threads'
  credentials: {
    accessToken: string
    refreshToken?: string
    userId: string
    username: string
  }
}

export interface ThreadsPostContent {
  type: 'single' | 'thread'
  text: string
  mediaUrls?: string[]
  threadPosts?: string[] // For thread sequences
  metadata: {
    replySettings?: 'everyone' | 'accounts_you_follow' | 'mentioned_only'
    allowReplies?: boolean
  }
}

export interface ThreadsApiResponse {
  id: string
  permalink?: string
  error?: {
    message: string
    type: string
    code: number
  }
}

export interface ThreadsMediaUploadResponse {
  id: string
  status: 'IN_PROGRESS' | 'FINISHED' | 'ERROR'
  error?: {
    message: string
    type: string
  }
}

// ============================================================================
// FUTURE PLATFORM TYPES (for extensibility)
// ============================================================================

// Other platform types can be added here when needed

// ============================================================================
// PLATFORM CONFIGURATION TYPES
// ============================================================================

export interface PlatformConfig {
  platform: Platform
  displayName: string
  icon: string
  color: string
  authUrl: string
  contentLimits: ContentLimits
  supportedContentTypes: PostContentType[]
  features: {
    threads: boolean
    media: boolean
    scheduling: boolean
    analytics: boolean
  }
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  threads: {
    platform: 'threads',
    displayName: 'Threads',
    icon: 'threads',
    color: '#000000',
    authUrl: '/auth/threads',
    contentLimits: {
      maxTextLength: 500,
      maxMediaFiles: 10,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      maxThreadLength: 20
    },
    supportedContentTypes: ['single', 'thread', 'media'],
    features: {
      threads: true,
      media: true,
      scheduling: true,
      analytics: false
    }
  }
}

// ============================================================================
// PLATFORM PLUGIN FACTORY TYPES
// ============================================================================

export interface PlatformPluginFactory {
  createPlugin(platform: Platform): Promise<any> // Returns platform-specific plugin
  validatePlatform(platform: Platform): boolean
  getSupportedPlatforms(): Platform[]
}

export interface PlatformAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
}