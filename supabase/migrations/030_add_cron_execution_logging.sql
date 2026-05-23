-- ============================================================================
-- ADD EXECUTION LOGGING TO DEBUG CRON ISSUES
-- ============================================================================
-- Create a logging table to track every time the function is called
-- This will help us verify if cron is actually executing the function
-- ============================================================================

-- Create a log table to track function executions
CREATE TABLE IF NOT EXISTS cron_execution_log (
  id BIGSERIAL PRIMARY KEY,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  function_name TEXT,
  posts_found INTEGER,
  service_enabled BOOLEAN,
  execution_result TEXT,
  error_message TEXT,
  pg_net_request_id BIGINT
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_cron_execution_log_executed_at
  ON cron_execution_log(executed_at DESC);

-- Grant access
GRANT ALL ON cron_execution_log TO service_role;
GRANT ALL ON cron_execution_log TO postgres;
GRANT USAGE, SELECT ON SEQUENCE cron_execution_log_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cron_execution_log_id_seq TO postgres;

-- Recreate the function with detailed logging
DROP FUNCTION IF EXISTS process_scheduled_posts() CASCADE;

CREATE FUNCTION process_scheduled_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_service_enabled BOOLEAN;
  v_request_id BIGINT;
  v_posts_count INTEGER;
  v_edge_function_url TEXT;
  v_log_id BIGINT;
  v_execution_result TEXT;
  v_error_msg TEXT;
BEGIN
  -- ALWAYS log that function was called
  INSERT INTO cron_execution_log (function_name, executed_at)
  VALUES ('process_scheduled_posts', NOW())
  RETURNING id INTO v_log_id;

  RAISE NOTICE '[CRON] ============================================';
  RAISE NOTICE '[CRON] Function called at %, log_id=%', NOW(), v_log_id;

  -- Check if the posting service is enabled
  BEGIN
    SELECT is_service_enabled('posting_service') INTO v_service_enabled;
  EXCEPTION WHEN OTHERS THEN
    v_service_enabled := true; -- Default to enabled if function doesn't exist
    RAISE NOTICE '[CRON] Service check failed, defaulting to enabled';
  END;

  UPDATE cron_execution_log
  SET service_enabled = v_service_enabled
  WHERE id = v_log_id;

  IF NOT v_service_enabled THEN
    v_execution_result := 'SERVICE_DISABLED';
    UPDATE cron_execution_log
    SET execution_result = v_execution_result
    WHERE id = v_log_id;

    RAISE NOTICE '[CRON] Posting service is disabled. Skipping post processing.';
    RAISE NOTICE '[CRON] ============================================';
    RETURN;
  END IF;

  -- Count posts that need processing
  SELECT COUNT(*) INTO v_posts_count
  FROM scheduled_posts
  WHERE status = 'scheduled'
  AND scheduled_time <= NOW();

  UPDATE cron_execution_log
  SET posts_found = v_posts_count
  WHERE id = v_log_id;

  RAISE NOTICE '[CRON] Found % scheduled posts ready for processing', v_posts_count;

  -- If no posts to process, exit early
  IF v_posts_count = 0 THEN
    v_execution_result := 'NO_POSTS';
    UPDATE cron_execution_log
    SET execution_result = v_execution_result
    WHERE id = v_log_id;

    RAISE NOTICE '[CRON] No posts to process, exiting';
    RAISE NOTICE '[CRON] ============================================';
    RETURN;
  END IF;

  -- Use the PUBLIC edge function URL
  v_edge_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-posts';

  RAISE NOTICE '[CRON] Calling edge function at: %', v_edge_function_url;

  -- Use pg_net to make async HTTP request to Edge Function
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'source', 'cron',
        'timestamp', NOW()::text,
        'posts_count', v_posts_count,
        'log_id', v_log_id
      ),
      timeout_milliseconds := 60000
    ) INTO v_request_id;

    v_execution_result := 'REQUEST_QUEUED';

    UPDATE cron_execution_log
    SET
      execution_result = v_execution_result,
      pg_net_request_id = v_request_id
    WHERE id = v_log_id;

    RAISE NOTICE '[CRON] ✅ Edge function request queued successfully';
    RAISE NOTICE '[CRON] Request ID: %', v_request_id;
    RAISE NOTICE '[CRON] Log ID: %', v_log_id;
    RAISE NOTICE '[CRON] ============================================';

  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    v_execution_result := 'ERROR';

    UPDATE cron_execution_log
    SET
      execution_result = v_execution_result,
      error_message = v_error_msg
    WHERE id = v_log_id;

    RAISE WARNING '[CRON] ❌ Failed to queue edge function request: %', v_error_msg;

    -- Log what we would process for debugging
    RAISE NOTICE '[CRON] Posts waiting to be processed: %', (
      SELECT string_agg(id::text || ' @' || scheduled_time::text, ', ')
      FROM (
        SELECT id, scheduled_time
        FROM scheduled_posts
        WHERE status = 'scheduled'
        AND scheduled_time <= NOW()
        ORDER BY scheduled_time ASC
        LIMIT 5
      ) subq
    );
    RAISE NOTICE '[CRON] ============================================';
  END;
END;
$$;

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts with detailed execution logging - Debug version 2025-10-17';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO postgres;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Verify the cron job exists
DO $$
DECLARE
  job_exists BOOLEAN;
  job_info RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts'
  ) INTO job_exists;

  IF job_exists THEN
    SELECT * INTO job_info FROM cron.job WHERE jobname = 'process-scheduled-posts';
    RAISE NOTICE '✅ Cron job exists: ID=%, Schedule=%, Active=%',
      job_info.jobid, job_info.schedule, job_info.active;
  ELSE
    RAISE WARNING '⚠️ Cron job NOT FOUND - it needs to be created';
  END IF;
END;
$$;

-- Test the function immediately
DO $$
BEGIN
  RAISE NOTICE '=== TESTING NEW FUNCTION WITH LOGGING ===';
  PERFORM process_scheduled_posts();
  RAISE NOTICE '=== Test complete - Check cron_execution_log table ===';
END;
$$;
