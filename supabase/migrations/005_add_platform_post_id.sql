-- Add platform_post_id column to scheduled_posts table
-- This will store the ID returned by the platform after successful publishing

ALTER TABLE scheduled_posts 
ADD COLUMN platform_post_id VARCHAR(255);

-- Add index for platform post ID lookups
CREATE INDEX idx_scheduled_posts_platform_post_id ON scheduled_posts(platform_post_id) WHERE platform_post_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN scheduled_posts.platform_post_id IS 'The ID returned by the platform (e.g., Threads, Twitter) after successful publishing';