// ============================================================================
// THREADS PLATFORM PLUGIN
// ============================================================================

import { BasePlatformPlugin } from '../platformManager'
import {
  Platform,
  PostContent,
  ValidationResult,
  PublishResult,
  PlatformCredentials,
  ContentLimits,
  PostContentType,
  ErrorCode,
  ValidationError,
  ThreadsPlugin as IThreadsPlugin
} from '../../types'
import { ThreadsCredentials, ThreadsPostContent, ThreadsApiResponse, ThreadsMediaUploadResponse } from '../../types/platform'

/**
 * Threads Platform Plugin Implementation
 * Handles posting to Meta's Threads platform
 */
export class ThreadsPlugin extends BasePlatformPlugin implements IThreadsPlugin {
  name: Platform = 'threads'
  displayName = 'Threads'

  private readonly API_BASE_URL = 'https://graph.threads.net'
  private readonly API_VERSION = 'v1.0'

  /**
   * Validate content for Threads platform
   */
  validateContent(content: PostContent): ValidationResult {
    const errors: ValidationError[] = []
    const limits = this.getContentLimits()

    // Validate text content
    errors.push(...this.validateTextContent(content.text, limits.maxTextLength))

    // Validate media content
    if (content.mediaUrls) {
      errors.push(...this.validateMediaContent(content.mediaUrls, limits))
      
      // Validate media file types for Threads
      for (const mediaUrl of content.mediaUrls) {
        if (!this.isValidMediaType(mediaUrl)) {
          errors.push({
            field: 'mediaUrls',
            message: `Unsupported media type. Supported formats: ${limits.supportedMediaTypes.join(', ')}`,
            code: ErrorCode.INVALID_MEDIA_FORMAT,
            value: mediaUrl
          })
        }
      }
    }

    // Validate thread content
    if (content.type === 'thread' && content.threadPosts) {
      errors.push(...this.validateThreadContent(content.threadPosts, limits.maxThreadLength))
      
      // Validate each thread post length
      for (let i = 0; i < content.threadPosts.length; i++) {
        const threadPost = content.threadPosts[i]
        if (threadPost.length > limits.maxTextLength) {
          errors.push({
            field: 'threadPosts',
            message: `Thread post ${i + 1} exceeds maximum length of ${limits.maxTextLength} characters`,
            code: ErrorCode.THREAD_POST_TOO_LONG,
            value: threadPost.length
          })
        }
      }
    }

    // Validate content type is supported
    if (!this.getSupportedContentTypes().includes(content.type)) {
      errors.push({
        field: 'type',
        message: `Content type '${content.type}' is not supported by Threads`,
        code: ErrorCode.INVALID_CONTENT,
        value: content.type
      })
    }

    // Validate metadata for Threads-specific settings
    if (content.metadata) {
      const threadsMetadata = content.metadata as ThreadsPostContent['metadata']
      if (threadsMetadata.replySettings && 
          !['everyone', 'accounts_you_follow', 'mentioned_only'].includes(threadsMetadata.replySettings)) {
        errors.push({
          field: 'metadata.replySettings',
          message: 'Invalid reply settings. Must be one of: everyone, accounts_you_follow, mentioned_only',
          code: ErrorCode.INVALID_CONTENT,
          value: threadsMetadata.replySettings
        })
      }
    }

    return errors.length > 0 ? this.createValidationFailure(errors) : this.createValidationSuccess()
  }

  /**
   * Publish a post to Threads
   */
  async publishPost(content: PostContent, credentials: PlatformCredentials): Promise<PublishResult> {
    try {
      const threadsCredentials = credentials as ThreadsCredentials
      
      // Validate credentials
      if (!this.validateCredentials(threadsCredentials)) {
        return this.createPublishFailure('Invalid Threads credentials')
      }

      // Handle different content types
      switch (content.type) {
        case 'single':
          return await this.publishSinglePost(content, threadsCredentials)
        case 'thread':
          return await this.publishThread(content.threadPosts || [content.text], threadsCredentials)
        case 'media':
          return await this.publishMediaPost(content, threadsCredentials)
        default:
          return this.createPublishFailure(`Unsupported content type: ${(content as any).type}`)
      }
    } catch (error) {
      return this.createPublishFailure(
        `Failed to publish to Threads: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      )
    }
  }

  /**
   * Publish a thread (multiple connected posts)
   */
  async publishThread(posts: string[], credentials: PlatformCredentials): Promise<PublishResult> {
    try {
      const threadsCredentials = credentials as ThreadsCredentials
      const publishedPosts: string[] = []

      // Publish posts in sequence
      for (let i = 0; i < posts.length; i++) {
        const postText = posts[i]
        const isFirstPost = i === 0
        const replyToId = isFirstPost ? undefined : publishedPosts[i - 1]

        const result = await this.publishSingleThreadPost(postText, threadsCredentials, replyToId)
        
        if (!result.success) {
          // If any post fails, return failure with details of how many succeeded
          return this.createPublishFailure(
            `Thread publishing failed at post ${i + 1}/${posts.length}: ${result.error}`,
            { publishedPosts, failedAtIndex: i }
          )
        }

        publishedPosts.push(result.postId!)
      }

      return this.createPublishSuccess(publishedPosts[0], {
        threadPosts: publishedPosts,
        totalPosts: posts.length
      })
    } catch (error) {
      return this.createPublishFailure(
        `Failed to publish thread: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      )
    }
  }

  /**
   * Upload media file to Threads
   */
  async uploadMedia(file: File, credentials: PlatformCredentials): Promise<string> {
    const threadsCredentials = credentials as ThreadsCredentials
    
    try {
      // Create form data for media upload
      const formData = new FormData()
      formData.append('image_url', file) // For URL-based uploads
      formData.append('media_type', this.getMediaType(file))
      formData.append('access_token', threadsCredentials.credentials.accessToken)

      const response = await fetch(`${this.API_BASE_URL}/${this.API_VERSION}/${threadsCredentials.credentials.userId}/media`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Media upload failed: ${response.status} ${response.statusText}`)
      }

      const result: ThreadsMediaUploadResponse = await response.json()
      
      if (result.error) {
        throw new Error(`Media upload error: ${result.error.message}`)
      }

      // Wait for media processing if needed
      if (result.status === 'IN_PROGRESS') {
        await this.waitForMediaProcessing(result.id, threadsCredentials)
      }

      return result.id
    } catch (error) {
      throw new Error(`Failed to upload media: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get content limits for Threads
   */
  getContentLimits(): ContentLimits {
    return {
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
    }
  }

  /**
   * Get supported content types for Threads
   */
  getSupportedContentTypes(): PostContentType[] {
    return ['single', 'thread', 'media']
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Publish a single post to Threads
   */
  private async publishSinglePost(content: PostContent, credentials: ThreadsCredentials): Promise<PublishResult> {
    try {
      const mediaIds: string[] = []

      // Upload media if present
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        for (const mediaUrl of content.mediaUrls) {
          // For now, we'll assume mediaUrls are already uploaded media IDs
          // In a real implementation, you'd need to handle URL-to-file conversion
          mediaIds.push(mediaUrl)
        }
      }

      // Create the post
      const postData: any = {
        media_type: mediaIds.length > 0 ? 'IMAGE' : 'TEXT',
        text: content.text,
        ...(mediaIds.length > 0 && { media_ids: mediaIds }),
        access_token: credentials.credentials.accessToken
      }

      // Apply Threads-specific metadata
      if (content.metadata) {
        const threadsMetadata = content.metadata as ThreadsPostContent['metadata']
        if (threadsMetadata.replySettings) {
          postData['reply_control'] = threadsMetadata.replySettings
        }
      }

      const response = await fetch(`${this.API_BASE_URL}/${this.API_VERSION}/${credentials.credentials.userId}/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        throw new Error(`Post creation failed: ${response.status} ${response.statusText}`)
      }

      const result: ThreadsApiResponse = await response.json()
      
      if (result.error) {
        return this.createPublishFailure(`Threads API error: ${result.error.message}`, result)
      }

      // Publish the created post
      const publishResponse = await fetch(`${this.API_BASE_URL}/${this.API_VERSION}/${credentials.credentials.userId}/threads_publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          creation_id: result.id,
          access_token: credentials.credentials.accessToken
        })
      })

      if (!publishResponse.ok) {
        throw new Error(`Post publishing failed: ${publishResponse.status} ${publishResponse.statusText}`)
      }

      const publishResult: ThreadsApiResponse = await publishResponse.json()
      
      if (publishResult.error) {
        return this.createPublishFailure(`Threads publish error: ${publishResult.error.message}`, publishResult)
      }

      return this.createPublishSuccess(publishResult.id, {
        permalink: publishResult.permalink,
        threadsResponse: publishResult
      })
    } catch (error) {
      return this.createPublishFailure(
        `Failed to publish single post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      )
    }
  }

  /**
   * Publish a single post in a thread
   */
  private async publishSingleThreadPost(
    text: string, 
    credentials: ThreadsCredentials, 
    replyToId?: string
  ): Promise<PublishResult> {
    const content: PostContent = {
      type: 'single',
      text,
      metadata: replyToId ? { reply_to_id: replyToId } : {}
    }

    return await this.publishSinglePost(content, credentials)
  }

  /**
   * Publish a media post to Threads
   */
  private async publishMediaPost(content: PostContent, credentials: ThreadsCredentials): Promise<PublishResult> {
    // Media posts are handled the same as single posts with media
    return await this.publishSinglePost(content, credentials)
  }

  /**
   * Validate Threads credentials
   */
  private validateCredentials(credentials: ThreadsCredentials): boolean {
    return !!(
      credentials.credentials.accessToken &&
      credentials.credentials.userId &&
      credentials.platform === 'threads'
    )
  }

  /**
   * Check if media type is valid for Threads
   */
  private isValidMediaType(mediaUrl: string): boolean {
    const supportedTypes = this.getContentLimits().supportedMediaTypes
    
    // Extract file extension or content type from URL
    const extension = mediaUrl.split('.').pop()?.toLowerCase()
    const mimeType = this.getMimeTypeFromExtension(extension || '')
    
    return supportedTypes.includes(mimeType)
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mov': 'video/mov',
      'avi': 'video/avi'
    }
    
    return mimeTypes[extension] || ''
  }

  /**
   * Get media type for Threads API
   */
  private getMediaType(file: File): string {
    if (file.type.startsWith('image/')) {
      return 'IMAGE'
    } else if (file.type.startsWith('video/')) {
      return 'VIDEO'
    }
    return 'IMAGE' // Default fallback
  }

  /**
   * Wait for media processing to complete
   */
  private async waitForMediaProcessing(mediaId: string, credentials: ThreadsCredentials): Promise<void> {
    const maxAttempts = 10
    const delayMs = 2000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(
          `${this.API_BASE_URL}/${this.API_VERSION}/${mediaId}?fields=status&access_token=${credentials.credentials.accessToken}`
        )

        if (response.ok) {
          const result: ThreadsMediaUploadResponse = await response.json()
          
          if (result.status === 'FINISHED') {
            return
          } else if (result.status === 'ERROR') {
            throw new Error(`Media processing failed: ${result.error?.message || 'Unknown error'}`)
          }
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error
        }
      }
    }

    throw new Error('Media processing timeout')
  }
}