-- ============================================================================
-- FIX: Add Authentication to Edge Function Calls (401 Error Fix)
-- ============================================================================
-- The edge function is returning 401 because we're not sending auth headers
-- We need to send either the anon key or service role key
-- ============================================================================

-- Drop and recreate the function with proper authentication
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

  -- Try to get the anon key from vault
  -- This is the safest way to authenticate edge function calls
  BEGIN
    SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'anon_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- If vault doesn't work, try to get from pgsodium (alternative)
    BEGIN
      SELECT current_setting('app.settings.jwt_secret', true) INTO v_anon_key;
    EXCEPTION WHEN OTHERS THEN
      v_anon_key := NULL;
    END;
  END;

  RAISE NOTICE '[CRON] Calling edge function at: %', v_edge_function_url;
  RAISE NOTICE '[CRON] Auth available: %', CASE WHEN v_anon_key IS NOT NULL THEN 'YES' ELSE 'NO' END;

  -- Use pg_net to make async HTTP request to Edge Function with authentication
  BEGIN
    IF v_anon_key IS NOT NULL THEN
      -- Send with Authorization header
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
    ELSE
      -- Try without auth (edge function should use internal service role)
      -- This is a fallback but likely won't work
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'source', 'cron',
          'timestamp', NOW()::text,
          'posts_count', v_posts_count,
          'log_id', v_log_id
        ),
        timeout_milliseconds := 60000
      ) INTO v_request_id;

      RAISE WARNING '[CRON] No auth key available - request may fail with 401';
    END IF;

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
    RAISE NOTICE '[CRON] ============================================';
  END;
END;
$$;

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts with authentication - Fixed 401 error';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO postgres;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Instructions for adding the anon key to vault
DO $$
BEGIN
  RAISE NOTICE '=== SETUP INSTRUCTIONS ===';
  RAISE NOTICE 'To complete the setup, you need to add your anon key to Supabase Vault:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Go to Project Settings > API in Supabase Dashboard';
  RAISE NOTICE '2. Copy your "anon" / "public" key';
  RAISE NOTICE '3. Run this SQL (replace YOUR_ANON_KEY with the actual key):';
  RAISE NOTICE '';
  RAISE NOTICE 'INSERT INTO vault.secrets (name, secret)';
  RAISE NOTICE 'VALUES (''anon_key'', ''YOUR_ANON_KEY_HERE'')';
  RAISE NOTICE 'ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;';
  RAISE NOTICE '';
  RAISE NOTICE '=== OR USE THIS ALTERNATIVE ===';
  RAISE NOTICE 'If vault doesn''t work, we can use the internal kong:8000 URL instead';
END;
$$;

-- Test the function
DO $$
BEGIN
  RAISE NOTICE '=== TESTING FUNCTION ===';
  PERFORM process_scheduled_posts();
  RAISE NOTICE 'Check cron_execution_log and edge function logs';
END;
$$;
