// ============================================================================
// PLATFORM MANAGER SERVICE
// ============================================================================

import { 
  Platform, 
  PlatformPlugin, 
  PostContent, 
  ValidationResult, 
  PublishResult, 
  PlatformCredentials,
  ContentLimits,
  PostContentType,
  ErrorCode,
  PlatformError,
  ValidationError
} from '../types'

/**
 * Base abstract class for platform plugins
 * Provides common functionality and enforces interface compliance
 */
export abstract class BasePlatformPlugin implements PlatformPlugin {
  abstract name: Platform
  abstract displayName: string

  abstract validateContent(content: PostContent): ValidationResult
  abstract publishPost(content: PostContent, credentials: PlatformCredentials): Promise<PublishResult>
  abstract getContentLimits(): ContentLimits
  abstract getSupportedContentTypes(): PostContentType[]

  /**
   * Common validation helper for text content
   */
  protected validateTextContent(text: string, maxLength: number): ValidationError[] {
    const errors: ValidationError[] = []

    if (!text || text.trim().length === 0) {
      errors.push({
        field: 'text',
        message: 'Text content is required',
        code: ErrorCode.REQUIRED_FIELD_MISSING,
        value: text
      })
    }

    if (text && text.length > maxLength) {
      errors.push({
        field: 'text',
        message: `Text content exceeds maximum length of ${maxLength} characters`,
        code: ErrorCode.CONTENT_TOO_LONG,
        value: text.length
      })
    }

    return errors
  }

  /**
   * Common validation helper for media content
   */
  protected validateMediaContent(
    mediaUrls: string[] | undefined, 
    limits: ContentLimits
  ): ValidationError[] {
    const errors: ValidationError[] = []

    if (mediaUrls && mediaUrls.length > limits.maxMediaFiles) {
      errors.push({
        field: 'mediaUrls',
        message: `Too many media files. Maximum allowed: ${limits.maxMediaFiles}`,
        code: ErrorCode.TOO_MANY_MEDIA_FILES,
        value: mediaUrls.length
      })
    }

    return errors
  }

  /**
   * Common validation helper for thread content
   */
  protected validateThreadContent(
    threadPosts: string[] | undefined,
    maxThreadLength?: number
  ): ValidationError[] {
    const errors: ValidationError[] = []

    if (threadPosts) {
      if (threadPosts.length === 0) {
        errors.push({
          field: 'threadPosts',
          message: 'Thread must contain at least one post',
          code: ErrorCode.EMPTY_THREAD,
          value: threadPosts.length
        })
      }

      if (maxThreadLength && threadPosts.length > maxThreadLength) {
        errors.push({
          field: 'threadPosts',
          message: `Thread exceeds maximum length of ${maxThreadLength} posts`,
          code: ErrorCode.THREAD_TOO_LONG,
          value: threadPosts.length
        })
      }
    }

    return errors
  }

  /**
   * Helper to create successful validation result
   */
  protected createValidationSuccess(): ValidationResult {
    return {
      isValid: true,
      errors: []
    }
  }

  /**
   * Helper to create failed validation result
   */
  protected createValidationFailure(errors: ValidationError[]): ValidationResult {
    return {
      isValid: false,
      errors
    }
  }

  /**
   * Helper to create successful publish result
   */
  protected createPublishSuccess(postId: string, platformResponse?: any): PublishResult {
    return {
      success: true,
      postId,
      platformResponse
    }
  }

  /**
   * Helper to create failed publish result
   */
  protected createPublishFailure(error: string, platformResponse?: any): PublishResult {
    return {
      success: false,
      error,
      platformResponse
    }
  }
}

/**
 * Platform Manager Service
 * Manages registration and access to platform plugins
 */
export class PlatformManager {
  private plugins: Map<Platform, PlatformPlugin> = new Map()
  private static instance: PlatformManager

  private constructor() {}

  /**
   * Get singleton instance of PlatformManager
   */
  static getInstance(): PlatformManager {
    if (!PlatformManager.instance) {
      PlatformManager.instance = new PlatformManager()
    }
    return PlatformManager.instance
  }

  /**
   * Register a platform plugin
   */
  registerPlugin(plugin: PlatformPlugin): void {
    if (!plugin.name) {
      throw new Error('Plugin must have a name')
    }

    if (!plugin.displayName) {
      throw new Error('Plugin must have a display name')
    }

    // Validate plugin implements required methods
    this.validatePluginInterface(plugin)

    this.plugins.set(plugin.name, plugin)
  }

  /**
   * Unregister a platform plugin
   */
  unregisterPlugin(platform: Platform): boolean {
    return this.plugins.delete(platform)
  }

  /**
   * Get a specific platform plugin
   */
  getPlugin(platform: Platform): PlatformPlugin | null {
    return this.plugins.get(platform) || null
  }

  /**
   * Get all registered platforms
   */
  getRegisteredPlatforms(): Platform[] {
    return Array.from(this.plugins.keys())
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): PlatformPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Check if a platform is supported
   */
  isPlatformSupported(platform: Platform): boolean {
    return this.plugins.has(platform)
  }

  /**
   * Validate content for a specific platform
   */
  validateContent(platform: Platform, content: PostContent): ValidationResult {
    const plugin = this.getPlugin(platform)
    if (!plugin) {
      return {
        isValid: false,
        errors: [{
          field: 'platform',
          message: `Platform ${platform} is not supported`,
          code: ErrorCode.PLATFORM_API_ERROR,
          value: platform
        }]
      }
    }

    return plugin.validateContent(content)
  }

  /**
   * Publish content to a specific platform
   */
  async publishPost(
    platform: Platform, 
    content: PostContent, 
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    const plugin = this.getPlugin(platform)
    if (!plugin) {
      throw new PlatformError(
        `Platform ${platform} is not supported`,
        platform,
        ErrorCode.PLATFORM_API_ERROR
      )
    }

    // Validate credentials match platform
    if (credentials.platform !== platform) {
      throw new PlatformError(
        `Credentials platform ${credentials.platform} does not match target platform ${platform}`,
        platform,
        ErrorCode.PLATFORM_AUTH_FAILED
      )
    }

    // Validate content before publishing
    const validation = plugin.validateContent(content)
    if (!validation.isValid) {
      return {
        success: false,
        error: `Content validation failed: ${validation.errors.map(e => e.message).join(', ')}`
      }
    }

    try {
      return await plugin.publishPost(content, credentials)
    } catch (error) {
      throw new PlatformError(
        `Failed to publish to ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        platform,
        ErrorCode.PLATFORM_API_ERROR,
        error
      )
    }
  }

  /**
   * Get content limits for a specific platform
   */
  getContentLimits(platform: Platform): ContentLimits | null {
    const plugin = this.getPlugin(platform)
    return plugin ? plugin.getContentLimits() : null
  }

  /**
   * Get supported content types for a specific platform
   */
  getSupportedContentTypes(platform: Platform): PostContentType[] | null {
    const plugin = this.getPlugin(platform)
    return plugin ? plugin.getSupportedContentTypes() : null
  }

  /**
   * Get platform capabilities summary
   */
  getPlatformCapabilities(platform: Platform): {
    platform: Platform
    displayName: string
    contentLimits: ContentLimits
    supportedContentTypes: PostContentType[]
  } | null {
    const plugin = this.getPlugin(platform)
    if (!plugin) return null

    return {
      platform: plugin.name,
      displayName: plugin.displayName,
      contentLimits: plugin.getContentLimits(),
      supportedContentTypes: plugin.getSupportedContentTypes()
    }
  }

  /**
   * Validate that a plugin implements the required interface
   */
  private validatePluginInterface(plugin: any): void {
    const requiredMethods = [
      'validateContent',
      'publishPost', 
      'getContentLimits',
      'getSupportedContentTypes'
    ]

    for (const method of requiredMethods) {
      if (typeof plugin[method] !== 'function') {
        throw new Error(`Plugin must implement ${method} method`)
      }
    }
  }

  /**
   * Clear all registered plugins (useful for testing)
   */
  clearPlugins(): void {
    this.plugins.clear()
  }

  /**
   * Get plugin registration status
   */
  getPluginStatus(): Record<Platform, boolean> {
    const allPlatforms: Platform[] = ['threads', 'twitter', 'instagram', 'linkedin']
    const status: Record<Platform, boolean> = {} as Record<Platform, boolean>

    for (const platform of allPlatforms) {
      status[platform] = this.plugins.has(platform)
    }

    return status
  }
}

// Export singleton instance
export const platformManager = PlatformManager.getInstance()

// Export types for external use
export type { PlatformPlugin } from '../types'