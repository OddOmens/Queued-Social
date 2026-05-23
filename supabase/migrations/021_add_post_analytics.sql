-- Migration: Add analytics support to scheduled_posts table
-- Description: Adds columns for storing platform post IDs and analytics data

-- Add platform_post_id column to store the post ID from the platform
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS platform_post_id TEXT;

-- Add analytics column to store JSON analytics data
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS analytics JSONB;

-- Add index for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_analytics
ON scheduled_posts USING gin (analytics)
WHERE analytics IS NOT NULL;

-- Add index for platform_post_id lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_post_id
ON scheduled_posts (platform_post_id)
WHERE platform_post_id IS NOT NULL;

-- Add index for fetching published posts with analytics (for top posts)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_published_with_analytics
ON scheduled_posts (user_id, status, published_at DESC)
WHERE status = 'published' AND analytics IS NOT NULL;

-- Add comment to document the analytics structure
COMMENT ON COLUMN scheduled_posts.analytics IS 'JSON object containing post analytics: {views, likes, replies, reposts, quotes, shares, engagementRate, lastFetchedAt}';
COMMENT ON COLUMN scheduled_posts.platform_post_id IS 'Post ID from the social media platform, used for fetching analytics';
