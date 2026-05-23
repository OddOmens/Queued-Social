-- ============================================================================
-- FIX DUPLICATE POSTS - Add Atomic Post Claiming
-- ============================================================================
-- This migration adds a function to atomically claim scheduled posts
-- for processing, preventing race conditions between multiple schedulers
-- ============================================================================

-- Create function to atomically claim posts for processing
CREATE OR REPLACE FUNCTION claim_scheduled_posts_for_processing(
  p_current_time TIMESTAMPTZ,
  lookback_minutes INTEGER DEFAULT 2,
  batch_size INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  platform VARCHAR(50),
  content JSONB,
  scheduled_time TIMESTAMPTZ,
  status VARCHAR(20),
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  platform_post_id VARCHAR(255),
  platform_account_id VARCHAR(100),
  account_name VARCHAR(255),
  analytics JSONB,
  recurring_post_id UUID,
  media_urls TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lookback_time TIMESTAMPTZ;
BEGIN
  -- Calculate lookback time
  lookback_time := p_current_time - (lookback_minutes || ' minutes')::INTERVAL;

  -- Atomically update posts from 'scheduled' to 'publishing' and return them
  -- This prevents other schedulers from grabbing the same posts
  RETURN QUERY
  UPDATE scheduled_posts
  SET
    status = 'publishing',
    updated_at = p_current_time
  WHERE scheduled_posts.id IN (
    SELECT scheduled_posts.id
    FROM scheduled_posts
    WHERE scheduled_posts.status = 'scheduled'
      AND scheduled_posts.scheduled_time <= p_current_time
      AND scheduled_posts.scheduled_time >= lookback_time
    ORDER BY scheduled_posts.scheduled_time ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED  -- Skip posts already locked by other transactions
  )
  RETURNING
    scheduled_posts.id,
    scheduled_posts.user_id,
    scheduled_posts.platform,
    scheduled_posts.content,
    scheduled_posts.scheduled_time,
    scheduled_posts.status,
    scheduled_posts.published_at,
    scheduled_posts.error_message,
    scheduled_posts.created_at,
    scheduled_posts.updated_at,
    scheduled_posts.platform_post_id,
    scheduled_posts.platform_account_id,
    scheduled_posts.account_name,
    scheduled_posts.analytics,
    scheduled_posts.recurring_post_id,
    scheduled_posts.media_urls;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION claim_scheduled_posts_for_processing TO service_role;
GRANT EXECUTE ON FUNCTION claim_scheduled_posts_for_processing TO anon;
GRANT EXECUTE ON FUNCTION claim_scheduled_posts_for_processing TO authenticated;

COMMENT ON FUNCTION claim_scheduled_posts_for_processing IS 
  'Atomically claims scheduled posts for processing to prevent duplicate publishing';

-- Add index to improve performance of the claim query
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_claim_lookup 
  ON scheduled_posts(status, scheduled_time) 
  WHERE status = 'scheduled';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE '✅ Created claim_scheduled_posts_for_processing function';
  RAISE NOTICE '✅ This prevents duplicate posts by atomically claiming posts';
  RAISE NOTICE '✅ Posts are marked as "publishing" before being processed';
END;
$$;
