-- ============================================================================
-- COMPLETE CRON JOB REBUILD - Clean slate approach
-- ============================================================================
-- This migration completely rebuilds the cron job system from scratch
-- Previous migrations (022-027) had conflicts - this supersedes all of them
-- ============================================================================

-- Step 1: Remove the old cron job completely
DO $$
BEGIN
  -- Unschedule the existing job if it exists
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts') THEN
    PERFORM cron.unschedule('process-scheduled-posts');
    RAISE NOTICE '✅ Removed old cron job';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ No existing cron job to remove or error: %', SQLERRM;
END;
$$;

-- Step 2: Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  RAISE NOTICE '✅ Extensions verified: pg_net and pg_cron';
END;
$$;

-- Step 3: Drop and recreate the function with pg_net (cleanest approach)
DROP FUNCTION IF EXISTS process_scheduled_posts() CASCADE;

CREATE FUNCTION process_scheduled_posts()
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

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts by calling edge function via pg_net - Rebuilt 2025-10-17';

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;

DO $$
BEGIN
  RAISE NOTICE '✅ Function permissions granted';
END;
$$;

-- Step 5: Create the cron job fresh
DO $$
DECLARE
  new_job_id BIGINT;
BEGIN
  -- Schedule the new cron job to run every minute
  SELECT cron.schedule(
    'process-scheduled-posts',
    '* * * * *',  -- Every minute
    'SELECT process_scheduled_posts();'
  ) INTO new_job_id;

  RAISE NOTICE '✅ Cron job created successfully with ID: %', new_job_id;
  RAISE NOTICE '✅ Schedule: Every minute (* * * * *)';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Failed to create cron job: %', SQLERRM;
  RAISE NOTICE 'You may need to manually create the cron job in the Supabase dashboard';
END;
$$;

-- Step 6: Verify everything is set up correctly
DO $$
DECLARE
  job_count INTEGER;
  function_exists BOOLEAN;
  pg_net_exists BOOLEAN;
BEGIN
  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'process_scheduled_posts'
  ) INTO function_exists;

  -- Check if pg_net is available
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO pg_net_exists;

  -- Check if cron job exists
  SELECT COUNT(*) INTO job_count FROM cron.job WHERE jobname = 'process-scheduled-posts';

  RAISE NOTICE '=== REBUILD VERIFICATION ===';
  RAISE NOTICE 'Function exists: %', CASE WHEN function_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'pg_net extension: %', CASE WHEN pg_net_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'Cron job exists: %', CASE WHEN job_count > 0 THEN '✅ YES' ELSE '❌ NO' END;

  IF function_exists AND pg_net_exists AND job_count > 0 THEN
    RAISE NOTICE '=== ✅ REBUILD SUCCESSFUL ===';
  ELSE
    RAISE WARNING '=== ⚠️ REBUILD INCOMPLETE - Check logs above ===';
  END IF;
END;
$$;

-- Note: After running this migration, you can monitor pg_net requests with:
-- SELECT * FROM extensions.net._http_response ORDER BY created DESC LIMIT 10;
