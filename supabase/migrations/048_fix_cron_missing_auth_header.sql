-- FIX: Cron function missing Authorization header causes 401 on every call
-- Migration 046 added x-scheduler-secret but dropped the anon key auth headers
-- that migration 032 had previously fixed. Supabase platform-level JWT check
-- runs before function code, so without Authorization header all calls get 401.

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
  v_anon_key TEXT;
BEGIN
  SELECT COALESCE(is_service_enabled('posting_service'), true) INTO service_enabled;

  IF NOT service_enabled THEN
    RAISE NOTICE '[CRON] Posting service is disabled. Skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO posts_count
  FROM scheduled_posts
  WHERE status = 'scheduled'
  AND scheduled_time <= NOW();

  IF posts_count = 0 THEN
    RAISE NOTICE '[CRON] No posts due, exiting.';
    RETURN;
  END IF;

  RAISE NOTICE '[CRON] Found % posts to process', posts_count;

  edge_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-posts';
  v_anon_key := 'YOUR_ANON_KEY_HERE';

  BEGIN
    SELECT net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key,
        'x-scheduler-secret', 'YOUR_SCHEDULER_SECRET_HERE'
      ),
      body := jsonb_build_object('source', 'cron', 'timestamp', NOW()::text),
      timeout_milliseconds := 60000
    ) INTO request_id;

    RAISE NOTICE '[CRON] Request queued: %', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[CRON] Failed to call edge function: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
