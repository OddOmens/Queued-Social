-- ============================================================================
-- FIX: Use Public Edge Function URL instead of internal kong URL
-- ============================================================================
-- The kong:8000 internal URL doesn't work with pg_net
-- We need to use the public Supabase edge function URL
-- ============================================================================

-- Drop and recreate with public URL
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
  project_ref TEXT;
  edge_function_url TEXT;
  service_role_key TEXT;
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

  -- Extract project reference from current database settings
  -- Supabase project URL format: https://[project-ref].supabase.co
  project_ref := 'YOUR_PROJECT_REF';  -- Your project ref
  edge_function_url := 'https://' || project_ref || '.supabase.co/functions/v1/process-scheduled-posts';

  -- Try to get service role key from vault (if available)
  -- Otherwise, the edge function should work without auth for internal calls
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  RAISE NOTICE '[CRON] Calling edge function at: %', edge_function_url;

  -- Use pg_net to make async HTTP request to Edge Function
  BEGIN
    IF service_role_key IS NOT NULL THEN
      -- Use service role key for authentication
      SELECT extensions.net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'source', 'cron',
          'timestamp', NOW()::text,
          'posts_count', posts_count
        ),
        timeout_milliseconds := 60000
      ) INTO request_id;
    ELSE
      -- Try without auth (edge function should validate internally)
      SELECT extensions.net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'source', 'cron',
          'timestamp', NOW()::text,
          'posts_count', posts_count
        ),
        timeout_milliseconds := 60000
      ) INTO request_id;
    END IF;

    RAISE NOTICE '[CRON] ✅ Edge function request queued successfully';
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

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts by calling public edge function URL via pg_net - Fixed 2025-10-17';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Verify the cron job exists (don't recreate, just verify)
DO $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts'
  ) INTO job_exists;

  IF job_exists THEN
    RAISE NOTICE '✅ Cron job exists and will use new function';
  ELSE
    RAISE WARNING '⚠️ Cron job not found - run migration 028 first';
  END IF;
END;
$$;

-- Test the function manually
DO $$
BEGIN
  RAISE NOTICE '=== TESTING NEW FUNCTION ===';
  RAISE NOTICE 'Manually triggering process_scheduled_posts()...';
  PERFORM process_scheduled_posts();
  RAISE NOTICE '✅ Test complete - Check Database Logs and Edge Function Logs';
  RAISE NOTICE 'Monitor pg_net requests with: SELECT * FROM extensions.net._http_response ORDER BY created DESC LIMIT 5;';
END;
$$;
