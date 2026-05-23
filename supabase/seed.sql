-- ============================================================================
-- SEED FILE — Local development configuration
-- ============================================================================
--
-- This file is run automatically by `supabase db reset` after all migrations.
-- It configures the app settings needed by the cron trigger functions.
--
-- For PRODUCTION: run these statements manually in the Supabase SQL editor
-- after deploying your migrations. See docs/SUPABASE_SETUP.md for details.
--
-- WHERE TO FIND THESE VALUES:
--   - supabase_url:      Supabase Dashboard > Project Settings > API > Project URL
--   - supabase_anon_key: Supabase Dashboard > Project Settings > API > anon (public) key
--   - scheduler_secret:  Choose any secure random string — must also be set as an
--                        edge function secret via:
--                        supabase secrets set SCHEDULER_SECRET=your-secret-value
-- ============================================================================

-- Replace these placeholder values with your actual Supabase project credentials:
ALTER DATABASE postgres SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY_HERE';
ALTER DATABASE postgres SET "app.scheduler_secret" = 'YOUR_SCHEDULER_SECRET_HERE';

-- Apply the settings to the current session (so they take effect immediately
-- without needing a reconnect)
SELECT set_config('app.supabase_url',      current_setting('app.supabase_url', true),      false);
SELECT set_config('app.supabase_anon_key', current_setting('app.supabase_anon_key', true), false);
SELECT set_config('app.scheduler_secret',  current_setting('app.scheduler_secret', true),  false);
