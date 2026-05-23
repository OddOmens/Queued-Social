import { getPosts, updatePost } from './posts';
import { publishPostInstant } from './publish';
import { useAuthStore } from '@/stores/auth';
import { prepareMediaUrlsForPublishing } from './storage';

const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

class AppScheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private userId: string | null = null;

    init(userId: string) {
        this.userId = userId;
        this.start();
    }

    start() {
        // Client-side scheduler is disabled to prevent conflicts with server-side cron
        console.log('⏰ Client-side scheduler is DISABLED (using server-side cron)');
        return;

        /* 
        if (this.intervalId) return;

        console.log('⏰ Scheduler started');
        // Run immediately on start
        this.checkAndPublish();

        this.intervalId = setInterval(() => {
            this.checkAndPublish();
        }, CHECK_INTERVAL_MS);
        */
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏰ Scheduler stopped');
        }
    }

    async checkAndPublish() {
        if (this.isRunning || !this.userId) return;
        this.isRunning = true;

        try {
            console.log('⏰ Checking for due posts...');
            const posts = await getPosts('scheduled');
            const now = new Date();

            const duePosts = posts.filter(post =>
                post.scheduledTime &&
                post.scheduledTime <= now &&
                post.status === 'scheduled'
            );

            if (duePosts.length === 0) {
                console.log('⏰ No due posts found');
                return;
            }

            console.log(`⏰ Found ${duePosts.length} due posts. Publishing...`);

            for (const post of duePosts) {
                try {
                    // Update status to publishing to prevent double-send (optimistic lock)
                    await updatePost(post.id, { status: 'publishing' });

                    // We need to fetch credentials to get the account ID if it's missing on the post object
                    // But our getPosts returns everything we need hopefully.
                    // The publishPostInstant needs platformAccountId.
                    // Our post object from getPosts has platformAccountId.

                    if (!post.platformAccountId) {
                        throw new Error(`Post ${post.id} missing platformAccountId`);
                    }

                    // Prepare media URLs - refresh signed URLs and filter out missing files
                    let mediaUrls = post.content.mediaUrls || [];
                    if (mediaUrls.length > 0) {
                        console.log(`📷 Preparing ${mediaUrls.length} media URLs for post ${post.id}...`);
                        mediaUrls = await prepareMediaUrlsForPublishing(mediaUrls);
                        console.log(`✅ Prepared ${mediaUrls.length} valid media URLs`);

                        if (mediaUrls.length === 0 && post.content.mediaUrls.length > 0) {
                            console.warn(`⚠️ All media files were removed (not found or inaccessible)`);
                        }
                    }

                    await publishPostInstant({
                        postId: post.id,
                        platform: post.platform,
                        platformAccountId: post.platformAccountId,
                        content: {
                            text: post.content.text,
                            mediaUrls: mediaUrls,
                            type: post.content.type as any
                        }
                    });

                    console.log(`✅ Automatically published post ${post.id}`);
                } catch (error: any) {
                    console.error(`❌ Failed to auto-publish post ${post.id}`, error);
                    await updatePost(post.id, {
                        status: 'failed',
                        errorMessage: error.message || 'Auto-publish failed'
                    });
                }
            }

        } catch (error) {
            console.error('⏰ Scheduler error:', error);
        } finally {
            this.isRunning = false;
        }
    }
}

export const appScheduler = new AppScheduler();
