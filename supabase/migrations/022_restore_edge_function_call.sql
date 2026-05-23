-- Restore Edge Function call in process_scheduled_posts
-- Migration 013 accidentally removed the actual Edge Function call
-- This migration restores it while keeping the security improvements

-- First, ensure http extension is available
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Restore the process_scheduled_posts function with Edge Function call
CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  http_response record;
  service_enabled BOOLEAN;
BEGIN
  -- Check if the posting service is enabled
  SELECT is_service_enabled('posting_service') INTO service_enabled;

  IF NOT service_enabled THEN
    RAISE NOTICE 'Posting service is disabled. Skipping post processing.';
    RETURN;
  END IF;

  -- Log that we're starting
  RAISE NOTICE 'Triggering Edge Function for scheduled posts processing at %', NOW();
  
  -- Call the Edge Function using Supabase internal networking
  BEGIN
    SELECT * INTO http_response FROM extensions.http((
      'POST',
      'http://supabase_edge_functions_process-scheduled-posts/process-scheduled-posts',
      ARRAY[extensions.http_header('Content-Type','application/json')],
      '{}',
      NULL
    )::extensions.http_request);
    
    RAISE NOTICE 'Edge Function response: status=%, content=%', http_response.status, http_response.content;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to call Edge Function: %', SQLERRM;
    
    -- Fallback: Just log what we would process
    RAISE NOTICE 'Fallback: Found % scheduled posts to process', (
      SELECT COUNT(*) FROM scheduled_posts 
      WHERE status = 'scheduled' 
      AND scheduled_time <= NOW()
      AND scheduled_time >= NOW() - INTERVAL '1 hour'
    );
    
    -- Also log current time and any scheduled posts
    RAISE NOTICE 'Current time: %, Scheduled posts: %', NOW(), (
      SELECT string_agg(id::text || ' at ' || scheduled_time::text, ', ')
      FROM (
        SELECT id, scheduled_time 
        FROM scheduled_posts 
        WHERE status = 'scheduled'
        ORDER BY scheduled_time DESC
        LIMIT 5
      ) subq
    );
  END;
END;
$$;

COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts by calling Edge Function - SECURITY: Uses search_path protection, includes extensions schema for http';

-- Grant execute permission to service role (for cron job)
GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;
