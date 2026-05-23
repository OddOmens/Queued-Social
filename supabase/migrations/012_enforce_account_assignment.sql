-- Enforce platform account assignment for all posts
-- This prevents the cross-account posting issue by ensuring every post 
-- is explicitly assigned to a specific platform account

-- First, let's check for any existing posts without platform_account_id
-- and provide a way to identify them for manual reassignment

-- Add a NOT NULL constraint to platform_account_id for future posts
-- (We'll make this conditional to avoid breaking existing deployments)

DO $$
BEGIN
  -- Check if there are any scheduled posts without platform_account_id
  IF EXISTS (
    SELECT 1 FROM scheduled_posts 
    WHERE platform_account_id IS NULL 
    AND status IN ('scheduled', 'publishing')
  ) THEN
    -- Log a warning about orphaned posts that need reassignment
    RAISE WARNING 'Found scheduled posts without platform_account_id. These posts need to be reassigned to specific accounts to prevent cross-account posting.';
    
    -- Create a view to help identify orphaned posts for manual reassignment
    CREATE OR REPLACE VIEW orphaned_scheduled_posts AS
    SELECT 
      id,
      user_id,
      platform,
      account_name,
      status,
      scheduled_time,
      created_at,
      content->>'text' as post_text_preview
    FROM scheduled_posts 
    WHERE platform_account_id IS NULL 
    AND status IN ('scheduled', 'publishing')
    ORDER BY scheduled_time ASC;
    
    COMMENT ON VIEW orphaned_scheduled_posts IS 'Posts without platform_account_id that need manual reassignment to prevent cross-account posting';
  ELSE
    -- If no orphaned posts exist, we can safely add the constraint
    -- Add NOT NULL constraint to prevent future posts without account assignment
    ALTER TABLE scheduled_posts 
    ALTER COLUMN platform_account_id SET NOT NULL;
    
    RAISE NOTICE 'Added NOT NULL constraint to platform_account_id - all future posts must specify an account';
  END IF;
END $$;

-- Add a check constraint to ensure platform_account_id is not empty string
ALTER TABLE scheduled_posts 
ADD CONSTRAINT scheduled_posts_platform_account_id_not_empty 
CHECK (platform_account_id IS NOT NULL AND trim(platform_account_id) != '');

-- Add an index to improve performance of account-specific queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_account_status 
ON scheduled_posts(platform_account_id, status, scheduled_time);

-- Add a function to help with post reassignment
CREATE OR REPLACE FUNCTION reassign_post_to_account(
  post_id UUID,
  new_platform_account_id VARCHAR(100),
  new_account_name VARCHAR(255) DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  post_record scheduled_posts%ROWTYPE;
  credential_exists BOOLEAN;
BEGIN
  -- Get the post
  SELECT * INTO post_record FROM scheduled_posts WHERE id = post_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post with ID % not found', post_id;
  END IF;
  
  -- Verify the account exists and is active
  SELECT EXISTS(
    SELECT 1 FROM platform_credentials 
    WHERE user_id = post_record.user_id 
    AND platform = post_record.platform 
    AND platform_account_id = new_platform_account_id 
    AND is_active = true
  ) INTO credential_exists;
  
  IF NOT credential_exists THEN
    RAISE EXCEPTION 'No active credentials found for platform % account %', post_record.platform, new_platform_account_id;
  END IF;
  
  -- Update the post
  UPDATE scheduled_posts 
  SET 
    platform_account_id = new_platform_account_id,
    account_name = COALESCE(new_account_name, new_platform_account_id),
    updated_at = now()
  WHERE id = post_id;
  
  RAISE NOTICE 'Successfully reassigned post % to account %', post_id, new_platform_account_id;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION reassign_post_to_account IS 'Safely reassign a scheduled post to a specific platform account with validation';

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 012_enforce_account_assignment completed. This prevents cross-account posting by ensuring all posts are assigned to specific accounts.';
END $$;