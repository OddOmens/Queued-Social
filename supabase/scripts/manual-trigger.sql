-- ============================================================================
-- MANUAL TRIGGER — run the scheduler immediately
-- Use this to process scheduled posts right now without waiting for cron.
-- ============================================================================

-- Trigger the main post scheduler
SELECT process_scheduled_posts();

-- Then check if a pg_net request was queued
SELECT
  id,
  status_code,
  created,
  LEFT(content::text, 300) AS response
FROM net._http_response
ORDER BY created DESC
LIMIT 3;
