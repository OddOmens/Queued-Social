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

      // Check if we need to refresh the token (auto-refresh if expires within 7 days)
      const { credentialManager } = await import('../credentialManager')
      const refreshedCredentials = await credentialManager.refreshTokensIfNeeded(
        threadsCredentials.userId, 
        'threads'
      )
      
      if (refreshedCredentials) {
        // Use refreshed credentials if available
        threadsCredentials.credentials = refreshedCredentials.credentials
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
   * Check publishing quota before attempting to post
   */
  private async checkPublishingQuota(credentials: ThreadsCredentials): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/${this.API_VERSION}/me/threads_publishing_limit?access_token=${credentials.credentials.accessToken}`)
      
      if (response.ok) {
        const quotaData = await response.json()
        console.log('📊 Threads Publishing Quota:', quotaData)
        
        if (quotaData.data && quotaData.data[0] && quotaData.data[0].quota_usage >= 250) {
          throw new Error('Threads publishing quota exceeded. Please wait before posting again.')
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not check publishing quota:', error)
      // Don't fail the post if quota check fails
    }
  }

  /**
   * Validate and correct user ID if needed
   */
  private async validateAndCorrectUserId(credentials: ThreadsCredentials): Promise<ThreadsCredentials> {
    try {
      // Get the actual user ID from the API
      const response = await fetch(`${this.API_BASE_URL}/${this.API_VERSION}/me?fields=id,username&access_token=${credentials.credentials.accessToken}`)
      
      if (!response.ok) {
        throw new Error(`Failed to validate user ID: ${response.status} ${response.statusText}`)
      }

      const userData = await response.json()
      const actualUserId = userData.id
      const storedUserId = credentials.credentials.userId

      // If user IDs match, return as-is
      if (actualUserId === storedUserId) {
        return credentials
      }

      console.warn(`User ID mismatch detected. Stored: ${storedUserId}, Actual: ${actualUserId}. Auto-correcting...`)

      // Return corrected credentials
      return {
        ...credentials,
        credentials: {
          ...credentials.credentials,
          userId: actualUserId,
          username: userData.username
        }
      }
    } catch (error) {
      console.error('Failed to validate user ID:', error)
      // Return original credentials if validation fails
      return credentials
    }
  }

  /**
   * Publish a single post to Threads
   */
  private async publishSinglePost(content: PostContent, credentials: ThreadsCredentials): Promise<PublishResult> {
    try {
      // Check publishing quota first
      await this.checkPublishingQuota(credentials)
      
      // Validate and correct user ID if needed
      const validatedCredentials = await this.validateAndCorrectUserId(credentials)
      
      const mediaIds: string[] = []

      // Upload media if present
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        for (const mediaUrl of content.mediaUrls) {
          // For now, we'll assume mediaUrls are already uploaded media IDs
          // In a real implementation, you'd need to handle URL-to-file conversion
          mediaIds.push(mediaUrl)
        }
      }

      // Create the post using URL-encoded format
      const postParams = new URLSearchParams({
        media_type: mediaIds.length > 0 ? 'IMAGE' : 'TEXT',
        text: content.text,
        access_token: validatedCredentials.credentials.accessToken
      })

      // Add media IDs if present
      if (mediaIds.length > 0) {
        postParams.append('media_ids', mediaIds.join(','))
      }

      // Apply Threads-specific metadata
      if (content.metadata) {
        const threadsMetadata = content.metadata as ThreadsPostContent['metadata']
        if (threadsMetadata.replySettings) {
          postParams.append('reply_control', threadsMetadata.replySettings)
        }
      }

      console.log('🔍 Threads API Request:', {
        url: `${this.API_BASE_URL}/${this.API_VERSION}/${validatedCredentials.credentials.userId}/threads`,
        params: Object.fromEntries(postParams.entries())
      })

      // Retry logic for 500 errors (server issues)
      let response: Response | null = null
      let lastError: string = ''
      const maxRetries = 3
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`📡 Attempt ${attempt}/${maxRetries}...`)
        
        response = await fetch(`${this.API_BASE_URL}/${this.API_VERSION}/${validatedCredentials.credentials.userId}/threads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: postParams
        })

        console.log('📡 Threads API Response:', {
          attempt,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        })

        if (response.ok) {
          break // Success, exit retry loop
        }

        // Get error details
        let errorBody = ''
        try {
          errorBody = await response.text()
          console.error(`❌ Attempt ${attempt} failed:`, errorBody)
          lastError = errorBody
        } catch (e) {
          console.error('❌ Could not read error response body')
          lastError = `${response.status} ${response.statusText}`
        }

        // If it's a 500 error and we have retries left, wait and try again
        if (response.status === 500 && attempt < maxRetries) {
          const delay = attempt * 2000 // 2s, 4s delays
          console.log(`⏳ Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          break // Don't retry for other errors or if out of retries
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Post creation failed after ${maxRetries} attempts: ${response?.status} ${response?.statusText}. Last response: ${lastError}`)
      }

      const createResult: ThreadsApiResponse = await response.json()
      
      if (createResult.error) {
        return this.createPublishFailure(`Threads API error: ${createResult.error.message}`, createResult)
      }

      // Publish the created post using URL-encoded format
      const publishParams = new URLSearchParams({
        creation_id: createResult.id,
        access_token: validatedCredentials.credentials.accessToken
      })

      const publishResponse = await fetch(`${this.API_BASE_URL}/${this.API_VERSION}/${validatedCredentials.credentials.userId}/threads_publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: publishParams
      })

      if (!publishResponse.ok) {
        throw new Error(`Post publishing failed: ${publishResponse.status} ${publishResponse.statusText}`)
      }

      const publishResult: ThreadsApiResponse = await publishResponse.json()
      
      if (publishResult.error) {
        return this.createPublishFailure(`Threads publish error: ${publishResult.error.message}`, publishResult)
      }

      const finalResult = this.createPublishSuccess(publishResult.id, {
        permalink: publishResult.permalink,
        threadsResponse: publishResult
      })

      // Include updated credentials if they were corrected
      if (validatedCredentials.credentials.userId !== credentials.credentials.userId) {
        finalResult.updatedCredentials = validatedCredentials
      }

      return finalResult
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