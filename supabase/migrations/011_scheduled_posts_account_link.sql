-- Add platform account linking to scheduled posts
-- Links each scheduled post to a specific platform account

-- Add platform_account_id column to scheduled_posts table
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS platform_account_id VARCHAR(100);

-- Add account_name column to cache the account name for display
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);

-- Create index for better performance when querying by account
CREATE INDEX idx_scheduled_posts_user_platform_account 
ON scheduled_posts(user_id, platform, platform_account_id);

-- Add foreign key constraint to ensure account exists
-- Note: We can't add a strict foreign key because platform_credentials 
-- might be deactivated, so we'll handle this in the application
-- ALTER TABLE scheduled_posts 
-- ADD CONSTRAINT fk_scheduled_posts_platform_account 
-- FOREIGN KEY (user_id, platform, platform_account_id) 
-- REFERENCES platform_credentials(user_id, platform, platform_account_id);

-- Add comments to explain the new columns
COMMENT ON COLUMN scheduled_posts.platform_account_id IS 'Links the post to a specific platform account from platform_credentials';
COMMENT ON COLUMN scheduled_posts.account_name IS 'Cached account display name for performance (from platform_credentials.account_name)';