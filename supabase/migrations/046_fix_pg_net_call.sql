-- FIX: Use correct schema for pg_net function call + Add Authentication Secret
-- The previous migration fixed the function name but hit 401 Unauthorized
-- We need to add the internal secret header so the Edge Function accepts the request from cron

-- Ensure pg_net is available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Make sure 'net' schema is accessible
GRANT USAGE ON SCHEMA net TO service_role;
GRANT USAGE ON SCHEMA net TO postgres;

-- Recreate the function with correct call AND headers
CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, net
LANGUAGE plpgsql
AS $$
DECLARE
  service_enabled BOOLEAN;
  request_id BIGINT;
  posts_count INTEGER;
  edge_function_url TEXT;
  project_ref TEXT;
  service_role_key TEXT;
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

  -- Use public URL
  project_ref := 'YOUR_PROJECT_REF';
  edge_function_url := 'https://' || project_ref || '.supabase.co/functions/v1/process-scheduled-posts';

  -- Try to get service role key for proper auth (optional, but good practice)
  -- If not found, we rely on the x-scheduler-secret
  BEGIN
    SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  BEGIN
    -- Use net.http_post with the SECRET HEADER
    SELECT net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scheduler-secret', 'YOUR_SCHEDULER_SECRET_HERE' -- matches index.ts expectation
      ),
      body := jsonb_build_object(
        'source', 'cron',
        'timestamp', NOW()::text,
        'posts_count', posts_count
      ),
      timeout_milliseconds := 60000
    ) INTO request_id;

    RAISE NOTICE '[CRON] ✅ Edge Function request queued via net.http_post: request_id=%', request_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[CRON] ❌ Failed to queue Edge Function request: %', SQLERRM;
  END;
END;
$$;

-- Grant permissions on the function
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;

-- Force a schedule update
SELECT cron.schedule('process-scheduled-posts', '* * * * *', 'SELECT process_scheduled_posts();');
