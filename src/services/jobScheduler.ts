import cron from 'node-cron';
import { createAdminSupabaseClient } from './supabase';
import { PlatformManager } from './platformManager';
import { ScheduledPost, PostStatus } from '../types';

export interface JobResult {
  success: boolean;
  error?: string;
  publishedAt?: Date;
}

export interface JobQueue {
  id: string;
  postId: string;
  scheduledTime: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastError?: string;
}

export class JobScheduler {
  private static instance: JobScheduler;
  private platformManager: PlatformManager;
  private isRunning: boolean = false;
  private jobQueue: Map<string, JobQueue> = new Map();
  private cronJob?: cron.ScheduledTask;

  private constructor() {
    this.platformManager = PlatformManager.getInstance();
  }

  public static getInstance(): JobScheduler {
    if (!JobScheduler.instance) {
      JobScheduler.instance = new JobScheduler();
    }
    return JobScheduler.instance;
  }

  /**
   * Start the job scheduler with cron job that runs every minute
   */
  public start(): void {
    if (this.isRunning) {
      console.log('Job scheduler is already running');
      return;
    }

    // Run every minute to check for posts to publish
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processScheduledPosts();
    });

    this.cronJob.start();
    this.isRunning = true;
    console.log('Job scheduler started');
  }

  /**
   * Stop the job scheduler
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }
    this.isRunning = false;
    console.log('Job scheduler stopped');
  }

  /**
   * Process all scheduled posts that are due for publishing
   */
  private async processScheduledPosts(): Promise<void> {
    try {
      const now = new Date();
      const supabase = createAdminSupabaseClient();
      
      // Get posts scheduled for publishing (within the last minute to current time)
      const { data: posts, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_time', now.toISOString())
        .gte('scheduled_time', new Date(now.getTime() - 60000).toISOString()); // Last minute

      if (error) {
        console.error('Error fetching scheduled posts:', error);
        return;
      }

      if (!posts || posts.length === 0) {
        return;
      }

      console.log(`Processing ${posts.length} scheduled posts`);

      // Process each post
      for (const post of posts) {
        // Convert database format to application format
        const scheduledPost: ScheduledPost = {
          id: post.id,
          userId: post.user_id,
          platform: post.platform,
          content: post.content,
          scheduledTime: new Date(post.scheduled_time),
          status: post.status,
          publishedAt: post.published_at ? new Date(post.published_at) : undefined,
          errorMessage: post.error_message,
          createdAt: new Date(post.created_at),
          updatedAt: new Date(post.updated_at),
        };
        await this.processPost(scheduledPost);
      }
    } catch (error) {
      console.error('Error in processScheduledPosts:', error);
    }
  }

  /**
   * Process a single scheduled post
   */
  private async processPost(post: ScheduledPost): Promise<void> {
    const jobId = `job_${post.id}`;
    
    try {
      // Check if job is already in queue
      const existingJob = this.jobQueue.get(jobId);
      if (existingJob && existingJob.status === 'processing') {
        return; // Already being processed
      }

      // Create or update job queue entry
      const job: JobQueue = existingJob || {
        id: jobId,
        postId: post.id,
        scheduledTime: post.scheduledTime,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending'
      };

      job.status = 'processing';
      this.jobQueue.set(jobId, job);

      // Update post status to publishing
      await this.updatePostStatus(post.id, 'publishing');

      // Publish the post
      const result = await this.publishPost(post);

      if (result.success) {
        // Mark as completed
        job.status = 'completed';
        await this.updatePostStatus(post.id, 'published', result.publishedAt);
        console.log(`Successfully published post ${post.id}`);
      } else {
        // Handle failure
        await this.handleJobFailure(job, result.error || 'Unknown error');
      }

    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error);
      const job = this.jobQueue.get(jobId);
      if (job) {
        await this.handleJobFailure(job, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Publish a post using the appropriate platform plugin
   */
  private async publishPost(post: ScheduledPost): Promise<JobResult> {
    try {
      const supabase = createAdminSupabaseClient();
      
      // Get user credentials for the platform
      const { data: credentials, error: credError } = await supabase
        .from('platform_credentials')
        .select('credentials')
        .eq('user_id', post.userId)
        .eq('platform', post.platform)
        .eq('is_active', true)
        .single();

      if (credError || !credentials) {
        return {
          success: false,
          error: `No active credentials found for platform ${post.platform}`
        };
      }

      // Get platform plugin
      const plugin = this.platformManager.getPlugin(post.platform);
      if (!plugin) {
        return {
          success: false,
          error: `No plugin found for platform ${post.platform}`
        };
      }

      // Validate content before publishing
      const validation = plugin.validateContent(post.content);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Content validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Publish the post
      const publishResult = await plugin.publishPost(post.content, credentials.credentials);
      
      if (publishResult.success) {
        return {
          success: true,
          publishedAt: new Date()
        };
      } else {
        return {
          success: false,
          error: publishResult.error || 'Publishing failed'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown publishing error'
      };
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: JobQueue, error: string): Promise<void> {
    job.retryCount++;
    job.lastError = error;

    if (job.retryCount < job.maxRetries) {
      // Schedule retry (exponential backoff)
      const retryDelay = Math.pow(2, job.retryCount) * 1000; // 2s, 4s, 8s
      job.status = 'pending';
      
      console.log(`Scheduling retry ${job.retryCount}/${job.maxRetries} for post ${job.postId} in ${retryDelay}ms`);
      
      setTimeout(async () => {
        await this.processPost(await this.getPost(job.postId));
      }, retryDelay);

    } else {
      // Max retries exceeded, mark as failed
      job.status = 'failed';
      await this.updatePostStatus(job.postId, 'failed', undefined, error);
      console.error(`Post ${job.postId} failed after ${job.maxRetries} retries: ${error}`);
    }
  }

  /**
   * Update post status in database
   */
  private async updatePostStatus(
    postId: string, 
    status: PostStatus, 
    publishedAt?: Date, 
    errorMessage?: string
  ): Promise<void> {
    const supabase = createAdminSupabaseClient();
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (publishedAt) {
      updateData.published_at = publishedAt.toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', postId);

    if (error) {
      console.error(`Error updating post status for ${postId}:`, error);
    }
  }

  /**
   * Get a post by ID
   */
  private async getPost(postId: string): Promise<ScheduledPost> {
    const supabase = createAdminSupabaseClient();
    
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error || !data) {
      throw new Error(`Post not found: ${postId}`);
    }

    // Convert database format to application format
    return {
      id: data.id,
      userId: data.user_id,
      platform: data.platform,
      content: data.content,
      scheduledTime: new Date(data.scheduled_time),
      status: data.status,
      publishedAt: data.published_at ? new Date(data.published_at) : undefined,
      errorMessage: data.error_message,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get job queue status for monitoring
   */
  public getQueueStatus(): JobQueue[] {
    return Array.from(this.jobQueue.values());
  }

  /**
   * Clear completed jobs from queue (cleanup)
   */
  public cleanupQueue(): void {
    const entries = Array.from(this.jobQueue.entries());
    for (const [jobId, job] of entries) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobQueue.delete(jobId);
      }
    }
  }

  /**
   * Manually trigger processing of a specific post (for testing)
   */
  public async processPostManually(postId: string): Promise<JobResult> {
    try {
      const post = await this.getPost(postId);
      await this.processPost(post);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const jobScheduler = JobScheduler.getInstance();