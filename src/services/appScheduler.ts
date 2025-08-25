/**
 * Application-level scheduler for processing scheduled posts
 * This runs in the browser as a fallback when Supabase cron jobs aren't available
 */

import { createClient } from './supabase'
import { PlatformManager } from './platformManager'
import type { ScheduledPost, PlatformCredentials, PostContent } from '../types'

export class AppScheduler {
  private static instance: AppScheduler
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private platformManager: PlatformManager

  private constructor() {
    this.platformManager = PlatformManager.getInstance()
  }

  public static getInstance(): AppScheduler {
    if (!AppScheduler.instance) {
      AppScheduler.instance = new AppScheduler()
    }
    return AppScheduler.instance
  }

  /**
   * Start the scheduler - runs every minute
   */
  public start(): void {
    if (this.isRunning) {
      console.log('App scheduler is already running')
      return
    }

    console.log('Starting app scheduler...')
    this.isRunning = true
    
    // Run immediately, then every minute
    this.processScheduledPosts()
    this.intervalId = setInterval(() => {
      this.processScheduledPosts()
    }, 60000) // 60 seconds
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('App scheduler stopped')
  }

  /**
   * Process scheduled posts that are due
   */
  private async processScheduledPosts(): Promise<void> {
    try {
      const supabase = createClient()
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - 60000)

      // Get posts scheduled for publishing
      const { data: posts, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_time', now.toISOString())
        .gte('scheduled_time', oneMinuteAgo.toISOString())

      if (error) {
        console.error('Error fetching scheduled posts:', error)
        return
      }

      if (!posts || posts.length === 0) {
        return
      }

      console.log(`Processing ${posts.length} scheduled posts`)

      for (const post of posts) {
        await this.processPost(post)
      }
    } catch (error) {
      console.error('Error in processScheduledPosts:', error)
    }
  }

  /**
   * Process a single post
   */
  private async processPost(dbPost: any): Promise<void> {
    const supabase = createClient()
    
    try {
      // Convert database format to application format
      const post: ScheduledPost = {
        id: dbPost.id,
        userId: dbPost.user_id,
        platform: dbPost.platform,
        content: dbPost.content,
        scheduledTime: new Date(dbPost.scheduled_time),
        status: dbPost.status,
        publishedAt: dbPost.published_at ? new Date(dbPost.published_at) : undefined,
        errorMessage: dbPost.error_message,
        createdAt: new Date(dbPost.created_at),
        updatedAt: new Date(dbPost.updated_at),
      }

      console.log(`Publishing post ${post.id} to ${post.platform}`)

      // Get user credentials for the platform
      const { data: credentials, error: credError } = await supabase
        .from('platform_credentials')
        .select('*')
        .eq('user_id', post.userId)
        .eq('platform', post.platform)
        .eq('is_active', true)
        .single()

      if (credError || !credentials) {
        throw new Error(`No active credentials found for ${post.platform}: ${credError?.message || 'Not found'}`)
      }

      // Prepare content for publishing
      const postContent: PostContent = {
        type: 'single' as const,
        text: typeof post.content === 'string' ? post.content : post.content.text || '',
        mediaUrls: dbPost.media_urls || undefined,
        metadata: {
          allowReplies: true,
          replySettings: 'everyone'
        }
      }

      // Prepare platform credentials - credentials are stored as JSONB
      const platformCredentials: PlatformCredentials = {
        id: credentials.id,
        userId: credentials.user_id,
        platform: post.platform,
        credentials: credentials.credentials, // This is already a JSON object
        isActive: credentials.is_active,
        expiresAt: credentials.expires_at ? new Date(credentials.expires_at) : undefined,
        createdAt: new Date(credentials.created_at),
        updatedAt: new Date(credentials.updated_at || credentials.created_at)
      }

      // Actually publish the post using the platform manager
      const publishResult = await this.platformManager.publishPost(
        post.platform,
        postContent,
        platformCredentials
      )

      // Check if credentials were updated during publishing (e.g., user ID correction)
      if (publishResult.updatedCredentials) {
        console.log('Updating corrected credentials in database...')
        await this.updateCredentialsInDatabase(publishResult.updatedCredentials)
      }

      if (publishResult.success) {
        // Update post status to published
        // Note: platform_post_id column may not exist yet
        const updateData: any = {
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Try to add platform_post_id if the column exists
        try {
          updateData.platform_post_id = publishResult.postId
        } catch (e) {
          // Column doesn't exist yet, that's ok
        }
        
        const { error: updateError } = await supabase
          .from('scheduled_posts')
          .update(updateData)
          .eq('id', post.id)

        if (updateError) {
          console.error(`Error updating post ${post.id}:`, updateError)
          throw new Error(`Database update failed: ${updateError.message}`)
        } else {
          console.log(`Successfully published post ${post.id} to ${post.platform} (ID: ${publishResult.postId})`)
        }
      } else {
        throw new Error(`Publishing failed: ${publishResult.error}`)
      }

    } catch (error) {
      console.error(`Error processing post ${dbPost.id}:`, error)
      
      // Mark as failed
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', dbPost.id)
    }
  }

  /**
   * Manually trigger processing (for testing)
   */
  public async triggerProcessing(): Promise<void> {
    await this.processScheduledPosts()
  }

  /**
   * Update credentials in database (for auto-corrections)
   */
  private async updateCredentialsInDatabase(updatedCredentials: PlatformCredentials): Promise<void> {
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('platform_credentials')
        .update({
          credentials: updatedCredentials.credentials,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedCredentials.id)

      if (error) {
        console.error('Failed to update credentials in database:', error)
      } else {
        console.log('Successfully updated credentials in database')
      }
    } catch (error) {
      console.error('Error updating credentials:', error)
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning }
  }
}

// Export singleton instance
export const appScheduler = AppScheduler.getInstance()