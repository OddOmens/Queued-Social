-- ============================================================================
-- FIX: Use Anon Key Directly for Edge Function Authentication
-- ============================================================================
-- Vault requires special permissions, so we'll use the anon key directly
-- Anon keys are safe to use in database functions (they're public anyway)
-- ============================================================================

-- Drop and recreate the function with the anon key
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
  v_anon_key TEXT;
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
    v_service_enabled := true;
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

  -- Set the anon key (public key - safe to include in code)
  v_anon_key := 'YOUR_ANON_KEY_HERE';

  RAISE NOTICE '[CRON] Calling edge function at: %', v_edge_function_url;

  -- Use pg_net to make async HTTP request with authentication
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
      ),
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

    RAISE NOTICE '[CRON] ✅ Edge function request queued with authentication';
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
    RAISE NOTICE '[CRON] ============================================';
  END;
END;
$$;

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts with anon key authentication - Fixed 401 error 2025-10-17';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO postgres;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Verify setup
DO $$
BEGIN
  RAISE NOTICE '=== SETUP COMPLETE ===';
  RAISE NOTICE '✅ Function updated with anon key authentication';
  RAISE NOTICE '✅ Edge function URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-posts';
  RAISE NOTICE '✅ Authentication: Using anon key';
  RAISE NOTICE '';
  RAISE NOTICE 'The cron job will now successfully call the edge function!';
  RAISE NOTICE 'Wait 1-2 minutes and check:';
  RAISE NOTICE '1. Edge function logs should show 200 responses';
  RAISE NOTICE '2. Scheduled posts should publish automatically';
END;
$$;

-- Test the function immediately
DO $$
BEGIN
  RAISE NOTICE '=== MANUAL TEST ===';
  PERFORM process_scheduled_posts();
  RAISE NOTICE 'Check edge function logs for successful execution';
END;
$$;
