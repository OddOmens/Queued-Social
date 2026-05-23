-- ============================================================================
-- THREADS PROFILE SNAPSHOTS
-- Replaces threads_follower_snapshots with a richer profile snapshot table
-- that stores full profile data from the Threads profile_lookup endpoint.
-- ============================================================================

-- Drop old table (CASCADE removes dependent policies, indexes, etc.)
DROP TABLE IF EXISTS threads_follower_snapshots CASCADE;

-- Drop and recreate the cron trigger function to keep it pointing at the
-- same edge function URL (sync-threads-followers). The cron job itself
-- already exists from migration 051 — we do NOT recreate it here.
DROP FUNCTION IF EXISTS trigger_followers_sync();

CREATE OR REPLACE FUNCTION trigger_followers_sync()
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
  function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-threads-followers';
  v_anon_key   := 'YOUR_ANON_KEY_HERE';

  RAISE NOTICE '[PROFILE SYNC CRON] Triggering daily Threads profile sync at %', NOW();

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

    RAISE NOTICE '[PROFILE SYNC CRON] Request queued (id=%)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[PROFILE SYNC CRON] Failed to queue request: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_followers_sync() TO service_role;

-- ─── New profile snapshots table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS threads_profile_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id        UUID REFERENCES platform_credentials(id) ON DELETE SET NULL,
  platform_account_id  TEXT NOT NULL,
  account_name         TEXT,
  username             TEXT,
  display_name         TEXT,
  profile_picture_url  TEXT,
  biography            TEXT,
  is_verified          BOOLEAN DEFAULT false,
  follower_count       INTEGER NOT NULL DEFAULT 0,
  follower_net_change  INTEGER NOT NULL DEFAULT 0,
  likes_count          INTEGER NOT NULL DEFAULT 0,
  quotes_count         INTEGER NOT NULL DEFAULT 0,
  replies_count        INTEGER NOT NULL DEFAULT 0,
  reposts_count        INTEGER NOT NULL DEFAULT 0,
  views_count          INTEGER NOT NULL DEFAULT 0,
  snapshot_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform_account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_threads_profile_user_account
  ON threads_profile_snapshots(user_id, platform_account_id, snapshot_date DESC);

-- RLS
ALTER TABLE threads_profile_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'threads_profile_snapshots'
      AND policyname = 'Users can read their own profile snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read their own profile snapshots" ON threads_profile_snapshots FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'threads_profile_snapshots'
      AND policyname = 'Users can write their own profile snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can write their own profile snapshots" ON threads_profile_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'threads_profile_snapshots'
      AND policyname = 'Service role can manage profile snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role can manage profile snapshots" ON threads_profile_snapshots FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Verify
DO $$
DECLARE
  tbl_exists BOOLEAN;
  fn_exists  BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'threads_profile_snapshots'
  ) INTO tbl_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trigger_followers_sync'
  ) INTO fn_exists;

  RAISE NOTICE '=== THREADS PROFILE SNAPSHOTS SETUP VERIFICATION ===';
  RAISE NOTICE 'Table threads_profile_snapshots: %', CASE WHEN tbl_exists THEN 'OK' ELSE 'MISSING' END;
  RAISE NOTICE 'Function trigger_followers_sync:  %', CASE WHEN fn_exists  THEN 'OK' ELSE 'MISSING' END;

  IF tbl_exists AND fn_exists THEN
    RAISE NOTICE '=== THREADS PROFILE SNAPSHOTS SETUP COMPLETE ===';
  ELSE
    RAISE WARNING '=== SETUP INCOMPLETE - check errors above ===';
  END IF;
END;
$$;
