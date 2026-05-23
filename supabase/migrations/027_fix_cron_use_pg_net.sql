-- DEFINITIVE FIX: Use pg_net for reliable edge function calls
-- This migration fixes the cron job to properly trigger the edge function
-- pg_net is available on all Supabase plans and works asynchronously

-- Ensure pg_net extension is available (it's built into Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create or replace the process_scheduled_posts function to use pg_net
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
  project_url TEXT;
  anon_key TEXT;
BEGIN
  -- Check if the posting service is enabled
  SELECT COALESCE(is_service_enabled('posting_service'), true) INTO service_enabled;

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
    RAISE NOTICE '[CRON] No posts to process, exiting.';
    RETURN;
  END IF;

  -- Get Supabase project URL from environment
  -- The edge function URL format: https://{project-ref}.supabase.co/functions/v1/process-scheduled-posts
  -- For internal calls, we use: http://kong:8000/functions/v1/process-scheduled-posts

  BEGIN
    -- Use pg_net to make async HTTP request to Edge Function
    -- pg_net queues the request and processes it asynchronously
    SELECT extensions.net.http_post(
      url := 'http://kong:8000/functions/v1/process-scheduled-posts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'source', 'cron',
        'timestamp', NOW()::text
      ),
      timeout_milliseconds := 60000  -- 60 second timeout
    ) INTO request_id;

    RAISE NOTICE '[CRON] ✅ Edge Function request queued via pg_net: request_id=%, posts_count=%', request_id, posts_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[CRON] ❌ Failed to queue Edge Function request: %', SQLERRM;

    -- Log what posts are waiting for debugging
    RAISE NOTICE '[CRON] Posts waiting: %', (
      SELECT string_agg(
        format('id=%s at %s platform=%s account=%s',
          id,
          to_char(scheduled_time, 'YYYY-MM-DD HH24:MI:SS'),
          platform,
          COALESCE(account_name, platform_account_id)
        ),
        ' | '
      )
      FROM (
        SELECT id, scheduled_time, platform, account_name, platform_account_id
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

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts by calling Edge Function via pg_net (async) - FIXED VERSION';

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO postgres;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT USAGE ON SCHEMA extensions TO postgres;

-- Remove old cron job if it exists and recreate it
SELECT cron.unschedule('process-scheduled-posts');

-- Create the cron job to run every minute
SELECT cron.schedule(
  'process-scheduled-posts',
  '* * * * *',  -- Every minute
  'SELECT process_scheduled_posts();'
);

-- Verify setup
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  -- Check if cron job was created
  SELECT COUNT(*) INTO job_count FROM cron.job WHERE jobname = 'process-scheduled-posts';

  IF job_count > 0 THEN
    RAISE NOTICE '✅ Cron job "process-scheduled-posts" is scheduled to run every minute';
    RAISE NOTICE '✅ Using pg_net for async edge function calls';
  ELSE
    RAISE WARNING '⚠️ Cron job was not created!';
  END IF;

  -- Log current scheduled posts count
  RAISE NOTICE 'Currently scheduled posts: %', (
    SELECT COUNT(*) FROM scheduled_posts WHERE status = 'scheduled' AND scheduled_time <= NOW()
  );
END;
$$;
