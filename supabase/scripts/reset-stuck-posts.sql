-- ============================================================================
-- RESET STUCK POSTS
-- Use this if posts are stuck in "scheduled" status but never published.
-- This resets them so the cron will try again on the next run.
--
-- REVIEW the output of the SELECT before running the UPDATE.
-- ============================================================================

-- First: see which posts are stuck
SELECT
  id,
  platform,
  account_name,
  scheduled_time,
  status,
  error_message,
  updated_at
FROM scheduled_posts
WHERE status = 'scheduled'
  AND scheduled_time < NOW() - INTERVAL '5 minutes'
ORDER BY scheduled_time;

-- Then: reset them (uncomment to run)
-- UPDATE scheduled_posts
-- SET
--   status = 'scheduled',
--   error_message = NULL,
--   updated_at = NOW()
-- WHERE status = 'scheduled'
--   AND scheduled_time < NOW() - INTERVAL '5 minutes';

-- Or reset a specific post by ID:
-- UPDATE scheduled_posts
-- SET status = 'scheduled', error_message = NULL, updated_at = NOW()
-- WHERE id = 'YOUR_POST_ID_HERE';
