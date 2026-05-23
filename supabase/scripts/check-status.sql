-- ============================================================================
-- CHECK SYSTEM STATUS
-- Run this in the Supabase SQL editor to verify everything is working.
-- ============================================================================

-- 1. Cron jobs
SELECT
  jobname,
  schedule,
  active,
  command
FROM cron.job
ORDER BY jobname;

-- 2. App settings (cron configuration)
SELECT
  current_setting('app.supabase_url', true)       AS supabase_url,
  CASE WHEN current_setting('app.supabase_anon_key', true) IS NOT NULL
    THEN 'SET ✅' ELSE 'NOT SET ❌' END            AS anon_key,
  CASE WHEN current_setting('app.scheduler_secret', true) IS NOT NULL
    THEN 'SET ✅' ELSE 'NOT SET ❌' END            AS scheduler_secret;

-- 3. Recent cron executions
SELECT
  jobname,
  status,
  start_time,
  end_time,
  return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- 4. Post counts by status
SELECT
  status,
  COUNT(*) AS count,
  MAX(updated_at) AS last_updated
FROM scheduled_posts
GROUP BY status
ORDER BY count DESC;

-- 5. Recent pg_net responses (edge function call results)
SELECT
  id,
  status_code,
  created,
  LEFT(content::text, 200) AS response_preview
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
