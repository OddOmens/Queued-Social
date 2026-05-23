-- ============================================================================
-- ADD RECURRING_POST_ID COLUMN TO SCHEDULED_POSTS
-- ============================================================================
-- This column links scheduled posts back to their recurring post source
-- ============================================================================

-- Add the recurring_post_id column
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS recurring_post_id UUID REFERENCES recurring_posts(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_recurring_post_id 
ON scheduled_posts(recurring_post_id) 
WHERE recurring_post_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN scheduled_posts.recurring_post_id IS 
  'Links scheduled posts created from recurring posts back to their source';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE '✅ Added recurring_post_id column to scheduled_posts';
  RAISE NOTICE '✅ Created index for recurring_post_id lookups';
END;
$$;
