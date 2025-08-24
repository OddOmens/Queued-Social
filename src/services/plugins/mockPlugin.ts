/**
 * Mock Platform Plugin for Development/Testing
 * This plugin simulates platform publishing without actual API calls
 */

import { BasePlatformPlugin } from '../platformManager'
import { 
  Platform, 
  PostContent, 
  ValidationResult, 
  PublishResult, 
  PlatformCredentials,
  ContentLimits,
  PostContentType 
} from '../../types'

export class MockPlatformPlugin extends BasePlatformPlugin {
  name: Platform
  displayName: string

  constructor(platform: Platform, displayName: string) {
    super()
    this.name = platform
    this.displayName = displayName
  }

  validateContent(content: PostContent): ValidationResult {
    const errors = this.validateTextContent(content.text, 500) // 500 char limit for mock
    
    if (errors.length > 0) {
      return this.createValidationFailure(errors)
    }
    
    return this.createValidationSuccess()
  }

  async publishPost(content: PostContent, credentials: PlatformCredentials): Promise<PublishResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock successful publish with fake post ID
    const mockPostId = `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log(`[MOCK] Published to ${this.displayName}: "${content.text.substring(0, 50)}..."`)
    
    return this.createPublishSuccess(mockPostId, {
      platform: this.name,
      postId: mockPostId,
      publishedAt: new Date().toISOString(),
      url: `https://${this.name}.com/post/${mockPostId}`
    })
  }

  getContentLimits(): ContentLimits {
    return {
      maxTextLength: 500,
      maxMediaFiles: 4,
      maxThreadLength: 10,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif'],
      maxMediaSize: 5 * 1024 * 1024 // 5MB
    }
  }

  getSupportedContentTypes(): PostContentType[] {
    return ['single', 'media', 'thread']
  }
}