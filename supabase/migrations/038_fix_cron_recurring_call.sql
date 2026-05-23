-- ============================================================================
-- FIX CRON JOB TO CALL RECURRING POSTS PROCESSING
-- ============================================================================
-- The previous cron job rebuild (028) missed calling process_recurring_posts()
-- This ensures recurring posts are processed before scheduled posts
-- ============================================================================

-- Drop the function first to avoid return type conflict errors
DROP FUNCTION IF EXISTS process_scheduled_posts();

CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  service_enabled BOOLEAN;
  request_id BIGINT;
  posts_count INTEGER;
  edge_function_url TEXT;
BEGIN
  -- 1. Process recurring posts first
  -- This will create new scheduled_posts if any are due
  -- This was missing in the previous version
  -- WRAPPED IN EXCEPTION BLOCK TO PREVENT BREAKING SCHEDULED POSTS
  BEGIN
    PERFORM process_recurring_posts();
    RAISE NOTICE '[CRON] ✅ Recurring posts processed successfully';
  EXCEPTION WHEN OTHERS THEN
    -- Log error but CONTINUE so we don't break existing scheduled posts
    RAISE WARNING '[CRON] ⚠️ Failed to process recurring posts: %', SQLERRM;
  END;

  -- Check if the posting service is enabled
  SELECT is_service_enabled('posting_service') INTO service_enabled;

  IF NOT service_enabled THEN
    RAISE NOTICE '[CRON] Posting service is disabled. Skipping post processing.';
    RETURN;
  END IF;

  -- Count posts that need processing
  SELECT COUNT(*) INTO posts_count
  FROM scheduled_posts
  WHERE status = 'scheduled'
  AND scheduled_time <= NOW();

  RAISE NOTICE '[CRON] Found % scheduled posts ready for processing at %', posts_count, NOW();

  -- If no posts to process, exit early
  IF posts_count = 0 THEN
    RAISE NOTICE '[CRON] No posts to process, exiting';
    RETURN;
  END IF;

  -- Use Supabase internal networking for edge functions
  edge_function_url := 'http://kong:8000/functions/v1/process-scheduled-posts';

  -- Use pg_net to make async HTTP request to Edge Function
  -- pg_net is available on ALL Supabase plans and handles retries
  BEGIN
    SELECT extensions.net.http_post(
      url := edge_function_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) INTO request_id;

    RAISE NOTICE '[CRON] ✅ Edge function request queued successfully via pg_net';
    RAISE NOTICE '[CRON] Request ID: %, URL: %', request_id, edge_function_url;
    RAISE NOTICE '[CRON] Processing % posts...', posts_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[CRON] ❌ Failed to queue edge function request: %', SQLERRM;

    -- Log what we would process for debugging
    RAISE NOTICE '[CRON] Posts waiting to be processed: %', (
      SELECT string_agg(id::text || ' (scheduled: ' || scheduled_time::text || ')', ', ')
      FROM (
        SELECT id, scheduled_time
        FROM scheduled_posts
        WHERE status = 'scheduled'
        AND scheduled_time <= NOW()
        ORDER BY scheduled_time ASC
        LIMIT 5
      ) subq
    );
  END;
END;
$$;

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes recurring posts AND scheduled posts - Fixed 2025-11-26';

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed cron job to call process_recurring_posts()';
END;
$$;
