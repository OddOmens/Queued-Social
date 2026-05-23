-- ============================================================================
-- THREADS FOLLOWER TRACKING
-- Stores daily follower count snapshots and computes daily change.
-- The Threads API does not expose individual follower identities, so we track
-- net follower count each day and derive gained/lost from the delta.
-- ============================================================================

-- Daily snapshot table
CREATE TABLE IF NOT EXISTS threads_follower_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id       UUID REFERENCES platform_credentials(id) ON DELETE SET NULL,
  platform_account_id TEXT NOT NULL,
  account_name        TEXT,
  follower_count      INTEGER NOT NULL,
  net_change          INTEGER NOT NULL DEFAULT 0,  -- vs previous day
  snapshot_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform_account_id, snapshot_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_followers_user_account
  ON threads_follower_snapshots(user_id, platform_account_id, snapshot_date DESC);

-- RLS
ALTER TABLE threads_follower_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'threads_follower_snapshots' AND policyname = 'Users can read their own follower snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read their own follower snapshots" ON threads_follower_snapshots FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'threads_follower_snapshots' AND policyname = 'Users can write their own follower snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can write their own follower snapshots" ON threads_follower_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'threads_follower_snapshots' AND policyname = 'Service role can manage follower snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role can manage follower snapshots" ON threads_follower_snapshots FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── Cron: sync follower count daily at 7:10 AM EST (12:10 UTC) ─────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-threads-followers') THEN
    PERFORM cron.unschedule('sync-threads-followers');
    RAISE NOTICE '✅ Removed existing sync-threads-followers cron job';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Could not remove existing job: %', SQLERRM;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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

  RAISE NOTICE '[FOLLOWERS CRON] Triggering daily Threads follower sync at %', NOW();

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

    RAISE NOTICE '[FOLLOWERS CRON] ✅ Request queued (id=%)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[FOLLOWERS CRON] ❌ Failed to queue request: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_followers_sync() TO service_role;

DO $$
DECLARE
  new_job_id BIGINT;
BEGIN
  SELECT cron.schedule(
    'sync-threads-followers',
    '10 12 * * *',   -- 12:10 UTC = 07:10 AM EST / 08:10 EDT every day
    'SELECT trigger_followers_sync();'
  ) INTO new_job_id;

  RAISE NOTICE '✅ Daily followers cron created (id=%, schedule=10 12 * * *)', new_job_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Failed to create followers cron job: %', SQLERRM;
END;
$$;

-- Verify
DO $$
DECLARE
  job_exists BOOLEAN;
  fn_exists  BOOLEAN;
  tbl_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-threads-followers')           INTO job_exists;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_followers_sync')            INTO fn_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'threads_follower_snapshots') INTO tbl_exists;

  RAISE NOTICE '=== THREADS FOLLOWERS SETUP VERIFICATION ===';
  RAISE NOTICE 'Table threads_follower_snapshots:  %', CASE WHEN tbl_exists THEN '✅ OK' ELSE '❌ MISSING' END;
  RAISE NOTICE 'Function trigger_followers_sync:   %', CASE WHEN fn_exists  THEN '✅ OK' ELSE '❌ MISSING' END;
  RAISE NOTICE 'Cron job sync-threads-followers:   %', CASE WHEN job_exists THEN '✅ OK' ELSE '❌ MISSING' END;

  IF tbl_exists AND fn_exists AND job_exists THEN
    RAISE NOTICE '=== ✅ THREADS FOLLOWERS SETUP COMPLETE ===';
    RAISE NOTICE 'Schedule: 10 12 * * * (7:10 AM EST / 12:10 UTC daily)';
  ELSE
    RAISE WARNING '=== ⚠️  SETUP INCOMPLETE — check errors above ===';
  END IF;
END;
$$;

-- To manually trigger:   SELECT trigger_followers_sync();
-- To query snapshots:    SELECT * FROM threads_follower_snapshots ORDER BY snapshot_date DESC LIMIT 30;
