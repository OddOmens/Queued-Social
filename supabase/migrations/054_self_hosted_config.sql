-- ============================================================================
-- MIGRATION 054: Configure app settings for self-hosted deployment
-- ============================================================================
-- Run this AFTER migrating to self-hosted Supabase.
-- Replace the placeholder values with your actual self-hosted URLs/keys.
--
-- Run via psql:
--   psql postgres://postgres:PASSWORD@localhost:5432/postgres -f supabase/migrations/054_self_hosted_config.sql
--
-- Or in Studio SQL editor (replace values first).
-- ============================================================================

-- Update these three values to match your self-hosted instance:
ALTER DATABASE postgres SET "app.supabase_url"      = 'https://supabase.yourdomain.com';
ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY';
ALTER DATABASE postgres SET "app.scheduler_secret"  = 'YOUR_SCHEDULER_SECRET';

-- Reload config so existing sessions pick up the new values
SELECT pg_reload_conf();

-- Verify
DO $$
DECLARE
  url TEXT := current_setting('app.supabase_url', true);
  key TEXT := current_setting('app.supabase_anon_key', true);
  sec TEXT := current_setting('app.scheduler_secret', true);
BEGIN
  RAISE NOTICE '=== Self-Hosted Config Verification ===';
  RAISE NOTICE 'app.supabase_url:      %', COALESCE(url, 'NOT SET');
  RAISE NOTICE 'app.supabase_anon_key: %', CASE WHEN key IS NOT NULL AND key != '' THEN 'SET (' || LEFT(key, 20) || '...)' ELSE 'NOT SET' END;
  RAISE NOTICE 'app.scheduler_secret:  %', CASE WHEN sec IS NOT NULL AND sec != '' THEN 'SET' ELSE 'NOT SET' END;
END;
$$;
