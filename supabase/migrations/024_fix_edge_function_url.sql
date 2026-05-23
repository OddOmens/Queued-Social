-- Fix Edge Function URL in process_scheduled_posts
-- The previous migration used an incorrect internal URL format
-- This uses the correct format for Supabase's internal networking

-- Ensure http extension is available
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Fix the process_scheduled_posts function with correct Edge Function URL
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
BEGIN
  -- Check if the posting service is enabled
  SELECT is_service_enabled('posting_service') INTO service_enabled;

  IF NOT service_enabled THEN
    RAISE NOTICE 'Posting service is disabled. Skipping post processing.';
    RETURN;
  END IF;

  -- Use the correct internal URL for Edge Functions
  -- Format: http://kong:8000/functions/v1/{function-name}
  function_url := 'http://kong:8000/functions/v1/process-scheduled-posts';

  RAISE NOTICE 'Triggering Edge Function at % for scheduled posts processing at %', function_url, NOW();
  
  -- Call the Edge Function using Supabase internal networking
  BEGIN
    SELECT * INTO http_response FROM extensions.http((
      'POST',
      function_url,
      ARRAY[
        extensions.http_header('Content-Type','application/json'),
        extensions.http_header('Authorization', 'Bearer ' || current_setting('request.jwt.claim.sub', true))
      ],
      '{}',
      NULL
    )::extensions.http_request);
    
    RAISE NOTICE 'Edge Function response: status=%, content=%', http_response.status, http_response.content;
    
    -- Check if the response was successful
    IF http_response.status >= 200 AND http_response.status < 300 THEN
      RAISE NOTICE '✅ Successfully triggered Edge Function';
    ELSE
      RAISE WARNING '⚠️ Edge Function returned non-success status: %', http_response.status;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Failed to call Edge Function: %', SQLERRM;
    
    -- Log what we would process for debugging
    RAISE NOTICE 'Fallback info: Found % scheduled posts to process', (
      SELECT COUNT(*) FROM scheduled_posts 
      WHERE status = 'scheduled' 
      AND scheduled_time <= NOW()
      AND scheduled_time >= NOW() - INTERVAL '1 hour'
    );
    
    -- Log current time and any scheduled posts for debugging
    RAISE NOTICE 'Current time: %, Next scheduled posts: %', NOW(), (
      SELECT string_agg(id::text || ' at ' || scheduled_time::text, ', ')
      FROM (
        SELECT id, scheduled_time 
        FROM scheduled_posts 
        WHERE status = 'scheduled'
        ORDER BY scheduled_time ASC
        LIMIT 5
      ) subq
    );
  END;
END;
$$;

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts by calling Edge Function via internal kong URL';

-- Grant execute permission to service role (for cron job)
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Verify the cron job is still scheduled
DO $$
BEGIN
  -- Check if pg_cron is available and job exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts') THEN
      -- Recreate the cron job if it doesn't exist
      PERFORM cron.schedule(
        'process-scheduled-posts',
        '* * * * *',
        'SELECT process_scheduled_posts();'
      );
      RAISE NOTICE '✅ Cron job created';
    ELSE
      RAISE NOTICE '✅ Cron job already exists';
    END IF;
  ELSE
    RAISE WARNING '⚠️ pg_cron extension not available';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Could not verify/create cron job: %', SQLERRM;
END;
$$;
