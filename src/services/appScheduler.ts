/**
 * Application-level scheduler for processing scheduled posts
 * This runs in the browser as a fallback when Supabase cron jobs aren't available
 */

import { createClient } from './supabase'
import { PlatformManager } from './platformManager'
import type { ScheduledPost, PostStatus, PlatformCredentials } from '../types'

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

      // For now, simulate publishing by marking as published
      // In a real implementation, you'd call the platform APIs here
      console.log(`Simulating publish for post ${post.id} on ${post.platform}`)

      // Update post status to published
      const { error: updateError } = await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)

      if (updateError) {
        console.error(`Error updating post ${post.id}:`, updateError)
        
        // Mark as failed
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error_message: updateError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)
      } else {
        console.log(`Successfully processed post ${post.id}`)
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
   * Get scheduler status
   */
  public getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning }
  }
}

// Export singleton instance
export const appScheduler = AppScheduler.getInstance()