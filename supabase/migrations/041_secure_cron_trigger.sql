-- Secure Cron Trigger with Secret Header
-- Replaces previous function signatures to avoid return type conflicts

-- 1. Drop the existing function (needed because return type might have changed)
-- This is safe to run; the cron job will just pick up the new function on the next run.
DROP FUNCTION IF EXISTS process_scheduled_posts();

-- 2. Ensure http extension exists
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 3. Recreate the function with security headers
CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  http_response record;
  service_enabled BOOLEAN;
  function_url TEXT;
  -- Secret key must match what is checked in the Edge Function
  secret_key TEXT := 'YOUR_SCHEDULER_SECRET_HERE'; 
BEGIN
  -- Check if the posting service is enabled
  -- Uses helper if exists, otherwise defaults to true
  IF (SELECT to_regproc('is_service_enabled')) IS NOT NULL THEN
    SELECT is_service_enabled('posting_service') INTO service_enabled;
    IF NOT service_enabled THEN
      RAISE NOTICE 'Posting service is disabled. Skipping post processing.';
      RETURN;
    END IF;
  END IF;

  -- Use the internal URL for Edge Functions
  function_url := 'http://kong:8000/functions/v1/process-scheduled-posts';

  RAISE NOTICE 'Triggering Edge Function at % for scheduled posts processing', function_url;

  BEGIN
    SELECT * INTO http_response FROM extensions.http((
      'POST',
      function_url,
      ARRAY[
        extensions.http_header('Content-Type','application/json'),
        extensions.http_header('x-scheduler-secret', secret_key)
      ],
      '{}',
      NULL
    )::extensions.http_request);

    RAISE NOTICE 'Edge Function response: status=%, content=%', http_response.status, http_response.content;

    IF http_response.status >= 200 AND http_response.status < 300 THEN
      RAISE NOTICE '✅ Successfully triggered Edge Function';
    ELSE
      RAISE WARNING '⚠️ Edge Function returned non-success status: %', http_response.status;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Failed to call Edge Function: %', SQLERRM;
  END;
END;
$$;

-- 4. Re-grant permissions (Dropping the function removes them)
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;
