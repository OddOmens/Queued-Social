-- ============================================================================
-- CONFIGURE CRON JOBS
-- Run this in the Supabase SQL editor after deploying migrations.
-- Replace the placeholder values with your actual credentials.
--
-- WHERE TO FIND THESE VALUES:
--   supabase_url:      Dashboard > Project Settings > API > Project URL
--   supabase_anon_key: Dashboard > Project Settings > API > anon (public) key
--   scheduler_secret:  The same value as your SCHEDULER_SECRET edge function secret
-- ============================================================================

ALTER DATABASE postgres SET "app.supabase_url"      = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY_HERE';
ALTER DATABASE postgres SET "app.scheduler_secret"  = 'YOUR_SCHEDULER_SECRET_HERE';

-- Apply to the current session immediately (no reconnect needed)
SELECT set_config('app.supabase_url',      current_setting('app.supabase_url',      true), false);
SELECT set_config('app.supabase_anon_key', current_setting('app.supabase_anon_key', true), false);
SELECT set_config('app.scheduler_secret',  current_setting('app.scheduler_secret',  true), false);

-- Verify
SELECT
  current_setting('app.supabase_url', true)      AS supabase_url,
  CASE WHEN current_setting('app.supabase_anon_key', true) != '' THEN '✅ Set' ELSE '❌ Missing' END AS anon_key,
  CASE WHEN current_setting('app.scheduler_secret',  true) != '' THEN '✅ Set' ELSE '❌ Missing' END AS scheduler_secret;
