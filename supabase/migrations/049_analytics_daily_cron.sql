-- ============================================================================
-- ANALYTICS DAILY CRON JOB
-- Schedules a daily analytics sync at 7:00 AM EST (12:00 UTC).
-- Calls the refresh-analytics edge function with the scheduler secret
-- so it processes ALL users with active Threads credentials.
-- ============================================================================

-- Step 1: Remove any existing analytics cron job to avoid duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-threads-analytics') THEN
    PERFORM cron.unschedule('sync-threads-analytics');
    RAISE NOTICE '✅ Removed existing sync-threads-analytics cron job';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Could not remove existing job (may not exist): %', SQLERRM;
END;
$$;

-- Step 2: Ensure pg_net is available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Step 3: Create the trigger function
--   Uses pg_net for async HTTP (same pattern as process_scheduled_posts).
--   7 AM EST = 12:00 UTC (UTC-5).  During EDT (UTC-4) this fires at 8 AM EDT,
--   which is acceptable since Supabase cron doesn't support DST offsets.
DROP FUNCTION IF EXISTS trigger_analytics_sync();

CREATE OR REPLACE FUNCTION trigger_analytics_sync()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, net
LANGUAGE plpgsql
AS $$
DECLARE
  request_id    BIGINT;
  function_url  TEXT;
  v_anon_key    TEXT;
BEGIN
  function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-analytics';
  v_anon_key   := 'YOUR_ANON_KEY_HERE';

  RAISE NOTICE '[ANALYTICS CRON] Triggering daily Threads analytics sync at %', NOW();

  BEGIN
    SELECT net.http_post(
      url     := function_url,
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'Authorization',      'Bearer ' || v_anon_key,
        'apikey',             v_anon_key,
        'x-scheduler-secret', 'YOUR_SCHEDULER_SECRET_HERE'
      ),
      body              := jsonb_build_object('source', 'daily-cron', 'timestamp', NOW()::text),
      timeout_milliseconds := 120000
    ) INTO request_id;

    RAISE NOTICE '[ANALYTICS CRON] ✅ Request queued (id=%)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[ANALYTICS CRON] ❌ Failed to queue request: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_analytics_sync() TO service_role;

-- Step 4: Schedule the cron job — 12:00 UTC = 7:00 AM EST
DO $$
DECLARE
  new_job_id BIGINT;
BEGIN
  SELECT cron.schedule(
    'sync-threads-analytics',
    '0 12 * * *',   -- 12:00 UTC = 07:00 EST / 08:00 EDT every day
    'SELECT trigger_analytics_sync();'
  ) INTO new_job_id;

  RAISE NOTICE '✅ Daily analytics cron created (id=%, schedule=0 12 * * *)', new_job_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Failed to create analytics cron job: %', SQLERRM;
END;
$$;

-- Step 5: Verify
DO $$
DECLARE
  job_exists BOOLEAN;
  fn_exists  BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-threads-analytics') INTO job_exists;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_analytics_sync')  INTO fn_exists;

  RAISE NOTICE '=== ANALYTICS CRON VERIFICATION ===';
  RAISE NOTICE 'Function trigger_analytics_sync: %', CASE WHEN fn_exists  THEN '✅ OK' ELSE '❌ MISSING' END;
  RAISE NOTICE 'Cron job sync-threads-analytics:  %', CASE WHEN job_exists THEN '✅ OK' ELSE '❌ MISSING' END;

  IF fn_exists AND job_exists THEN
    RAISE NOTICE '=== ✅ ANALYTICS CRON SETUP COMPLETE ===';
    RAISE NOTICE 'Schedule: 0 12 * * * (7:00 AM EST / 12:00 UTC daily)';
  ELSE
    RAISE WARNING '=== ⚠️  SETUP INCOMPLETE — check errors above ===';
  END IF;
END;
$$;

-- To verify the job after deploying:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'sync-threads-analytics';
--
-- To manually trigger the sync from SQL:
--   SELECT trigger_analytics_sync();
--
-- To monitor pg_net request outcomes:
--   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
