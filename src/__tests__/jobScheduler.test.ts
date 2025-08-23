import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JobScheduler, JobResult } from '../services/jobScheduler';
import { PlatformManager } from '../services/platformManager';
import { createAdminSupabaseClient } from '../services/supabase';
import { ScheduledPost, PostContent, Platform } from '../types';

// Mock dependencies
vi.mock('../services/supabase', () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            gte: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  })),
}));

vi.mock('../services/platformManager', () => ({
  PlatformManager: {
    getInstance: vi.fn(() => ({
      getPlugin: vi.fn(),
    })),
  },
}));

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
    })),
  },
}));

describe('JobScheduler', () => {
  let jobScheduler: JobScheduler;
  let mockPlatformManager: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance
    (JobScheduler as any).instance = undefined;
    jobScheduler = JobScheduler.getInstance();
    
    mockPlatformManager = {
      getPlugin: vi.fn(),
    };
    (PlatformManager.getInstance as any).mockReturnValue(mockPlatformManager);
    
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              gte: vi.fn(() => ({
                single: vi.fn(),
              })),
            })),
            single: vi.fn(),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    };
    (createAdminSupabaseClient as any).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jobScheduler.stop();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = JobScheduler.getInstance();
      const instance2 = JobScheduler.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Scheduler Management', () => {
    it('should start the scheduler', () => {
      jobScheduler.start();
      // Verify cron job was scheduled
      expect(require('node-cron').default.schedule).toHaveBeenCalledWith(
        '* * * * *',
        expect.any(Function),
        { scheduled: false }
      );
    });

    it('should stop the scheduler', () => {
      jobScheduler.start();
      const mockCronJob = {
        start: vi.fn(),
        stop: vi.fn(),
      };
      (require('node-cron').default.schedule as any).mockReturnValue(mockCronJob);
      
      jobScheduler.stop();
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should not start if already running', () => {
      jobScheduler.start();
      const scheduleCallCount = (require('node-cron').default.schedule as any).mock.calls.length;
      
      jobScheduler.start(); // Try to start again
      expect((require('node-cron').default.schedule as any).mock.calls.length).toBe(scheduleCallCount);
    });
  });

  describe('Post Processing', () => {
    const mockPost: ScheduledPost = {
      id: 'post-1',
      userId: 'user-1',
      platform: 'threads' as Platform,
      content: {
        type: 'single',
        text: 'Test post',
        metadata: {},
      } as PostContent,
      scheduledTime: new Date(),
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should process scheduled posts successfully', async () => {
      // Mock database response for scheduled posts
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            gte: vi.fn(() => Promise.resolve({
              data: [mockPost],
              error: null,
            })),
          })),
        })),
      }));
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      // Mock platform plugin
      const mockPlugin = {
        validateContent: vi.fn(() => ({ isValid: true, errors: [] })),
        publishPost: vi.fn(() => Promise.resolve({ success: true })),
      };
      mockPlatformManager.getPlugin.mockReturnValue(mockPlugin);

      // Mock credentials
      const mockCredentialsSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { credentials: { token: 'test-token' } },
                error: null,
              })),
            })),
          })),
        })),
      }));
      
      // Mock update operation
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return { 
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === 'platform_credentials') {
          return { select: mockCredentialsSelect };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      // Process posts manually
      const result = await jobScheduler.processPostManually(mockPost.id);
      
      expect(result.success).toBe(true);
      expect(mockPlugin.validateContent).toHaveBeenCalledWith(mockPost.content);
      expect(mockPlugin.publishPost).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      // Mock database response
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockPost,
            error: null,
          })),
        })),
      }));
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      // Mock platform plugin with validation error
      const mockPlugin = {
        validateContent: vi.fn(() => ({ 
          isValid: false, 
          errors: ['Content too long'] 
        })),
        publishPost: vi.fn(),
      };
      mockPlatformManager.getPlugin.mockReturnValue(mockPlugin);

      // Mock credentials
      const mockCredentialsSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { credentials: { token: 'test-token' } },
                error: null,
              })),
            })),
          })),
        })),
      }));

      // Mock update operation
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return { 
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === 'platform_credentials') {
          return { select: mockCredentialsSelect };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      const result = await jobScheduler.processPostManually(mockPost.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Content validation failed');
      expect(mockPlugin.publishPost).not.toHaveBeenCalled();
    });

    it('should handle missing credentials', async () => {
      // Mock database response
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockPost,
            error: null,
          })),
        })),
      }));

      // Mock credentials not found
      const mockCredentialsSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Not found' },
              })),
            })),
          })),
        })),
      }));

      // Mock update operation
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return { 
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === 'platform_credentials') {
          return { select: mockCredentialsSelect };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      const result = await jobScheduler.processPostManually(mockPost.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active credentials found');
    });

    it('should handle platform publishing errors', async () => {
      // Mock database response
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockPost,
            error: null,
          })),
        })),
      }));

      // Mock platform plugin with publishing error
      const mockPlugin = {
        validateContent: vi.fn(() => ({ isValid: true, errors: [] })),
        publishPost: vi.fn(() => Promise.resolve({ 
          success: false, 
          error: 'Platform API error' 
        })),
      };
      mockPlatformManager.getPlugin.mockReturnValue(mockPlugin);

      // Mock credentials
      const mockCredentialsSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { credentials: { token: 'test-token' } },
                error: null,
              })),
            })),
          })),
        })),
      }));

      // Mock update operation
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return { 
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === 'platform_credentials') {
          return { select: mockCredentialsSelect };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      const result = await jobScheduler.processPostManually(mockPost.id);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Platform API error');
    });
  });

  describe('Queue Management', () => {
    it('should return queue status', () => {
      const status = jobScheduler.getQueueStatus();
      expect(Array.isArray(status)).toBe(true);
    });

    it('should cleanup completed jobs', () => {
      // Add some mock jobs to the queue
      const queue = (jobScheduler as any).jobQueue;
      queue.set('job1', { status: 'completed' });
      queue.set('job2', { status: 'pending' });
      queue.set('job3', { status: 'failed' });

      expect(queue.size).toBe(3);
      
      jobScheduler.cleanupQueue();
      
      expect(queue.size).toBe(1); // Only pending job should remain
      expect(queue.has('job2')).toBe(true);
    });
  });

  describe('Error Handling and Retry Logic', () => {
    const mockPost: ScheduledPost = {
      id: 'post-retry',
      userId: 'user-1',
      platform: 'threads' as Platform,
      content: {
        type: 'single',
        text: 'Test post',
        metadata: {},
      } as PostContent,
      scheduledTime: new Date(),
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should retry failed jobs with exponential backoff', async () => {
      vi.useFakeTimers();
      
      // Mock database response
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockPost,
            error: null,
          })),
        })),
      }));

      // Mock platform plugin that fails initially
      let callCount = 0;
      const mockPlugin = {
        validateContent: vi.fn(() => ({ isValid: true, errors: [] })),
        publishPost: vi.fn(() => {
          callCount++;
          if (callCount < 3) {
            return Promise.resolve({ success: false, error: 'Temporary error' });
          }
          return Promise.resolve({ success: true });
        }),
      };
      mockPlatformManager.getPlugin.mockReturnValue(mockPlugin);

      // Mock credentials
      const mockCredentialsSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { credentials: { token: 'test-token' } },
                error: null,
              })),
            })),
          })),
        })),
      }));

      // Mock update operation
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return { 
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === 'platform_credentials') {
          return { select: mockCredentialsSelect };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      // Start processing
      await jobScheduler.processPostManually(mockPost.id);
      
      // Should have been called once initially
      expect(mockPlugin.publishPost).toHaveBeenCalledTimes(1);
      
      // Fast-forward time to trigger retries
      vi.advanceTimersByTime(2000); // First retry after 2s
      await vi.runAllTimersAsync();
      
      vi.advanceTimersByTime(4000); // Second retry after 4s
      await vi.runAllTimersAsync();
      
      // Should eventually succeed after retries
      expect(mockPlugin.publishPost).toHaveBeenCalledTimes(3);
      
      vi.useRealTimers();
    });

    it('should mark job as failed after max retries', async () => {
      vi.useFakeTimers();
      
      // Mock database response
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockPost,
            error: null,
          })),
        })),
      }));

      // Mock platform plugin that always fails
      const mockPlugin = {
        validateContent: vi.fn(() => ({ isValid: true, errors: [] })),
        publishPost: vi.fn(() => Promise.resolve({ 
          success: false, 
          error: 'Persistent error' 
        })),
      };
      mockPlatformManager.getPlugin.mockReturnValue(mockPlugin);

      // Mock credentials
      const mockCredentialsSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: { credentials: { token: 'test-token' } },
                error: null,
              })),
            })),
          })),
        })),
      }));

      // Mock update operation
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return { 
            select: mockSelect,
            update: mockUpdate,
          };
        }
        if (table === 'platform_credentials') {
          return { select: mockCredentialsSelect };
        }
        return { select: vi.fn(), update: vi.fn() };
      });

      // Start processing
      await jobScheduler.processPostManually(mockPost.id);
      
      // Fast-forward through all retries
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      vi.advanceTimersByTime(4000);
      await vi.runAllTimersAsync();
      vi.advanceTimersByTime(8000);
      await vi.runAllTimersAsync();
      
      // Should have been called 4 times (initial + 3 retries)
      expect(mockPlugin.publishPost).toHaveBeenCalledTimes(4);
      
      // Should have updated status to failed
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Persistent error'
        })
      );
      
      vi.useRealTimers();
    });
  });
});