-- ============================================================================
-- GOALS FEATURE
-- Stores user goal settings per platform and tracks daily comment progress.
-- Post counts are calculated on-the-fly from scheduled_posts.
-- Comment counts are synced from platform APIs via the sync-goal-progress fn.
-- ============================================================================

-- Goal settings (daily targets per platform)
CREATE TABLE IF NOT EXISTS goals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform            VARCHAR NOT NULL,
  daily_post_goal     INTEGER NOT NULL DEFAULT 1,
  daily_comment_goal  INTEGER NOT NULL DEFAULT 5,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Daily comment progress (synced from platform API)
CREATE TABLE IF NOT EXISTS goal_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        VARCHAR NOT NULL,
  date            DATE NOT NULL,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  synced_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_user_platform ON goals(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_goal_progress_user_platform_date ON goal_progress(user_id, platform, date);

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals"
  ON goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own goal progress"
  ON goal_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage goal progress"
  ON goal_progress FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── Cron: sync goal progress daily at 7AM EST (12:00 UTC) ──────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-goal-progress') THEN
    PERFORM cron.unschedule('sync-goal-progress');
    RAISE NOTICE '✅ Removed existing sync-goal-progress cron job';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Could not remove existing job: %', SQLERRM;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS trigger_goal_progress_sync();

CREATE OR REPLACE FUNCTION trigger_goal_progress_sync()
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
  function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-goal-progress';
  v_anon_key   := 'YOUR_ANON_KEY_HERE';

  RAISE NOTICE '[GOALS CRON] Triggering daily goal progress sync at %', NOW();

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

    RAISE NOTICE '[GOALS CRON] ✅ Request queued (id=%)', request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[GOALS CRON] ❌ Failed to queue request: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION trigger_goal_progress_sync() TO service_role;

DO $$
DECLARE
  new_job_id BIGINT;
BEGIN
  SELECT cron.schedule(
    'sync-goal-progress',
    '5 12 * * *',   -- 12:05 UTC = shortly after analytics sync
    'SELECT trigger_goal_progress_sync();'
  ) INTO new_job_id;

  RAISE NOTICE '✅ Daily goal progress cron created (id=%, schedule=5 12 * * *)', new_job_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Failed to create goal progress cron: %', SQLERRM;
END;
$$;
