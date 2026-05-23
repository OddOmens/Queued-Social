-- ============================================================================
-- MIGRATION 053: Configure cron trigger functions using app settings
-- ============================================================================
--
-- This migration rewrites all cron trigger functions so they read credentials
-- from PostgreSQL app settings instead of hardcoded values.
--
-- HOW TO CONFIGURE:
-- =================
-- Before running migrations (or supabase db reset), you must set your project
-- credentials in one of these ways:
--
-- Option A — Run the seed file (local dev with `supabase db reset`):
--   Edit supabase/seed.sql with your values. supabase db reset runs it automatically.
--
-- Option B — Run manually in the Supabase SQL editor or psql:
--   ALTER DATABASE postgres SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';
--   ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY';
--   ALTER DATABASE postgres SET "app.scheduler_secret" = 'YOUR_SCHEDULER_SECRET';
--
-- The SCHEDULER_SECRET must also be set as an edge function secret:
--   supabase secrets set SCHEDULER_SECRET=YOUR_SCHEDULER_SECRET
--
-- ============================================================================

-- Helper function: read an app setting with a clear error if missing
CREATE OR REPLACE FUNCTION get_app_setting(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  v_value := current_setting('app.' || p_key, true);
  IF v_value IS NULL OR v_value = '' THEN
    RAISE WARNING '[CRON CONFIG] app.% is not set. Run the setup in docs/SUPABASE_SETUP.md', p_key;
  END IF;
  RETURN v_value;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[CRON CONFIG] Could not read app.%: %', p_key, SQLERRM;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_app_setting(TEXT) TO service_role;

-- ============================================================================
-- CRON FUNCTION 1: process_scheduled_posts (runs every minute)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, net
LANGUAGE plpgsql
AS $$
DECLARE
  service_enabled   BOOLEAN;
  request_id        BIGINT;
  posts_count       INTEGER;
  edge_function_url TEXT;
  v_anon_key        TEXT;
  v_scheduler_secret TEXT;
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

  edge_function_url  := get_app_setting('supabase_url') || '/functions/v1/process-scheduled-posts';
  v_anon_key         := get_app_setting('supabase_anon_key');
  v_scheduler_secret := get_app_setting('scheduler_secret');

  IF edge_function_url IS NULL OR v_anon_key IS NULL OR v_scheduler_secret IS NULL THEN
    RAISE WARNING '[CRON] Missing configuration — cron functions will not work until app settings are configured. See docs/SUPABASE_SETUP.md';
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url     := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'Authorization',      'Bearer ' || v_anon_key,
        'apikey',             v_anon_key,
        'x-scheduler-secret', v_scheduler_secret
      ),
      body    := jsonb_build_object('source', 'cron', 'timestamp', NOW()::text),
      timeout_milliseconds := 60000
    ) INTO request_id;

    RAISE NOTICE '[CRON] Request queued: %', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[CRON] Failed to call edge function: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION process_scheduled_posts() TO service_role;

-- Reschedule (every minute)
SELECT cron.schedule('process-scheduled-posts', '* * * * *', 'SELECT process_scheduled_posts();');

-- ============================================================================
-- CRON FUNCTION 2: trigger_analytics_sync (daily at 12:00 UTC / 7 AM EST)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_analytics_sync()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, net
LANGUAGE plpgsql
AS $$
DECLARE
  request_id         BIGINT;
  function_url       TEXT;
  v_anon_key         TEXT;
  v_scheduler_secret TEXT;
BEGIN
  function_url       := get_app_setting('supabase_url') || '/functions/v1/refresh-analytics';
  v_anon_key         := get_app_setting('supabase_anon_key');
  v_scheduler_secret := get_app_setting('scheduler_secret');

  IF function_url IS NULL OR v_anon_key IS NULL OR v_scheduler_secret IS NULL THEN
    RAISE WARNING '[ANALYTICS CRON] Missing configuration — skipping. See docs/SUPABASE_SETUP.md';
    RETURN;
  END IF;

  RAISE NOTICE '[ANALYTICS CRON] Triggering daily analytics sync at %', NOW();

  BEGIN
    SELECT net.http_post(
      url     := function_url,
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'Authorization',      'Bearer ' || v_anon_key,
        'apikey',             v_anon_key,
        'x-scheduler-secret', v_scheduler_secret
      ),
      body              := jsonb_build_object('source', 'daily-cron', 'timestamp', NOW()::text),
      timeout_milliseconds := 120000
    ) INTO request_id;

    RAISE NOTICE '[ANALYTICS CRON] Request queued (id=%)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[ANALYTICS CRON] Failed to queue request: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_analytics_sync() TO service_role;

-- ============================================================================
-- CRON FUNCTION 3: trigger_goal_progress_sync (daily at 12:05 UTC)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_goal_progress_sync()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, net
LANGUAGE plpgsql
AS $$
DECLARE
  request_id         BIGINT;
  function_url       TEXT;
  v_anon_key         TEXT;
  v_scheduler_secret TEXT;
BEGIN
  function_url       := get_app_setting('supabase_url') || '/functions/v1/sync-goal-progress';
  v_anon_key         := get_app_setting('supabase_anon_key');
  v_scheduler_secret := get_app_setting('scheduler_secret');

  IF function_url IS NULL OR v_anon_key IS NULL OR v_scheduler_secret IS NULL THEN
    RAISE WARNING '[GOAL SYNC CRON] Missing configuration — skipping. See docs/SUPABASE_SETUP.md';
    RETURN;
  END IF;

  RAISE NOTICE '[GOAL SYNC CRON] Triggering daily goal progress sync at %', NOW();

  BEGIN
    SELECT net.http_post(
      url     := function_url,
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'Authorization',      'Bearer ' || v_anon_key,
        'apikey',             v_anon_key,
        'x-scheduler-secret', v_scheduler_secret
      ),
      body              := jsonb_build_object('source', 'daily-cron', 'timestamp', NOW()::text),
      timeout_milliseconds := 120000
    ) INTO request_id;

    RAISE NOTICE '[GOAL SYNC CRON] Request queued (id=%)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[GOAL SYNC CRON] Failed to queue request: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_goal_progress_sync() TO service_role;

-- ============================================================================
-- CRON FUNCTION 4: trigger_followers_sync (daily at 12:10 UTC)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_followers_sync()
RETURNS void
SECURITY DEFINER
SET search_path = public, extensions, net
LANGUAGE plpgsql
AS $$
DECLARE
  request_id         BIGINT;
  function_url       TEXT;
  v_anon_key         TEXT;
  v_scheduler_secret TEXT;
BEGIN
  function_url       := get_app_setting('supabase_url') || '/functions/v1/sync-threads-followers';
  v_anon_key         := get_app_setting('supabase_anon_key');
  v_scheduler_secret := get_app_setting('scheduler_secret');

  IF function_url IS NULL OR v_anon_key IS NULL OR v_scheduler_secret IS NULL THEN
    RAISE WARNING '[PROFILE SYNC CRON] Missing configuration — skipping. See docs/SUPABASE_SETUP.md';
    RETURN;
  END IF;

  RAISE NOTICE '[PROFILE SYNC CRON] Triggering daily Threads profile sync at %', NOW();

  BEGIN
    SELECT net.http_post(
      url     := function_url,
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'Authorization',      'Bearer ' || v_anon_key,
        'apikey',             v_anon_key,
        'x-scheduler-secret', v_scheduler_secret
      ),
      body              := jsonb_build_object('source', 'daily-cron', 'timestamp', NOW()::text),
      timeout_milliseconds := 120000
    ) INTO request_id;

    RAISE NOTICE '[PROFILE SYNC CRON] Request queued (id=%)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[PROFILE SYNC CRON] Failed to queue request: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_followers_sync() TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  url_set    TEXT;
  key_set    TEXT;
  secret_set TEXT;
BEGIN
  url_set    := current_setting('app.supabase_url', true);
  key_set    := current_setting('app.supabase_anon_key', true);
  secret_set := current_setting('app.scheduler_secret', true);

  RAISE NOTICE '=== CRON CONFIGURATION STATUS ===';
  RAISE NOTICE 'app.supabase_url:     %', CASE WHEN url_set    IS NOT NULL AND url_set    != '' THEN '✅ Set' ELSE '❌ NOT SET — run setup in docs/SUPABASE_SETUP.md' END;
  RAISE NOTICE 'app.supabase_anon_key: %', CASE WHEN key_set    IS NOT NULL AND key_set    != '' THEN '✅ Set' ELSE '❌ NOT SET — run setup in docs/SUPABASE_SETUP.md' END;
  RAISE NOTICE 'app.scheduler_secret: %', CASE WHEN secret_set IS NOT NULL AND secret_set != '' THEN '✅ Set' ELSE '❌ NOT SET — run setup in docs/SUPABASE_SETUP.md' END;

  IF url_set IS NULL OR url_set = '' OR key_set IS NULL OR key_set = '' OR secret_set IS NULL OR secret_set = '' THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  SETUP REQUIRED: Cron jobs will not work until you configure app settings.';
    RAISE NOTICE '   See docs/SUPABASE_SETUP.md for instructions.';
  ELSE
    RAISE NOTICE '=== ✅ CRON CONFIGURATION COMPLETE ===';
  END IF;
END;
$$;
