-- Alternative implementation using pg_net instead of http extension
-- Use this migration ONLY if the http extension is not available on your plan
-- pg_net is available on all Supabase plans

-- DO NOT run this if migration 024 is working!
-- This is an alternative, not an addition

-- Ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Replace process_scheduled_posts to use pg_net
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
BEGIN
  -- Check if the posting service is enabled
  SELECT is_service_enabled('posting_service') INTO service_enabled;

  IF NOT service_enabled THEN
    RAISE NOTICE 'Posting service is disabled. Skipping post processing.';
    RETURN;
  END IF;

  -- Count posts that need processing
  SELECT COUNT(*) INTO posts_count
  FROM scheduled_posts 
  WHERE status = 'scheduled' 
  AND scheduled_time <= NOW();

  RAISE NOTICE 'Found % scheduled posts ready for processing at %', posts_count, NOW();
  
  -- Use pg_net to make async HTTP request to Edge Function
  -- pg_net queues the request and processes it asynchronously
  BEGIN
    SELECT extensions.net.http_post(
      url := 'http://kong:8000/functions/v1/process-scheduled-posts',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) INTO request_id;
    
    RAISE NOTICE '✅ Edge Function request queued via pg_net: request_id=%', request_id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Failed to queue Edge Function request: %', SQLERRM;
    
    -- Log what we would process for debugging
    RAISE NOTICE 'Posts waiting: %', (
      SELECT string_agg(id::text || ' at ' || scheduled_time::text, ', ')
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

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts by calling Edge Function via pg_net (async)';

-- Grant execute permission to service role (for cron job)
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- Verify the cron job is still scheduled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts') THEN
      PERFORM cron.schedule(
        'process-scheduled-posts',
        '* * * * *',
        'SELECT process_scheduled_posts();'
      );
      RAISE NOTICE '✅ Cron job created with pg_net';
    ELSE
      RAISE NOTICE '✅ Cron job already exists, now using pg_net';
    END IF;
  ELSE
    RAISE WARNING '⚠️ pg_cron extension not available';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Could not verify/create cron job: %', SQLERRM;
END;
$$;

-- Note: pg_net requests are asynchronous and queued
-- You can check the status of requests with:
-- SELECT * FROM extensions.net._http_response ORDER BY created DESC LIMIT 10;
