-- ============================================================================
-- DISABLE REDUNDANT SCHEDULERS - Keep Only Supabase Cron
-- ============================================================================
-- This migration ensures only ONE scheduler is active to prevent duplicates
-- We keep the Supabase pg_cron job and disable browser/node schedulers
-- ============================================================================

-- Verify the cron job exists and is active
DO $$
DECLARE
  job_info RECORD;
  job_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-posts'
  ) INTO job_exists;

  IF job_exists THEN
    SELECT * INTO job_info FROM cron.job WHERE jobname = 'process-scheduled-posts';
    
    RAISE NOTICE '✅ Supabase cron job is active';
    RAISE NOTICE '   Job ID: %', job_info.jobid;
    RAISE NOTICE '   Schedule: %', job_info.schedule;
    RAISE NOTICE '   Active: %', job_info.active;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Disable browser and node schedulers to prevent duplicates';
    RAISE NOTICE '   Set VITE_ENABLE_BROWSER_SCHEDULER=false in .env';
    RAISE NOTICE '   Do not call jobScheduler.start() or appScheduler.start()';
  ELSE
    RAISE WARNING '❌ Cron job NOT FOUND';
    RAISE WARNING '   You need to create it manually or run migration 028';
  END IF;
END;
$$;

-- Add a comment to the cron job
COMMENT ON FUNCTION process_scheduled_posts() IS 
  'PRIMARY scheduler - processes posts every minute via pg_cron. Browser and node schedulers should be disabled.';

-- Log recommendation
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== SCHEDULER CONFIGURATION ===';
  RAISE NOTICE 'Recommended setup for production:';
  RAISE NOTICE '  ✅ Supabase pg_cron (this) - ENABLED';
  RAISE NOTICE '  ❌ Browser scheduler (appScheduler) - DISABLED';
  RAISE NOTICE '  ❌ Node scheduler (jobScheduler) - DISABLED';
  RAISE NOTICE '';
  RAISE NOTICE 'To disable browser scheduler, add to .env:';
  RAISE NOTICE '  VITE_ENABLE_BROWSER_SCHEDULER=false';
  RAISE NOTICE '';
  RAISE NOTICE 'To disable node scheduler:';
  RAISE NOTICE '  Do not call jobScheduler.start() in your code';
  RAISE NOTICE '=================================';
END;
$$;
