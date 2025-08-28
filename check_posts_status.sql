-- Query to check scheduled posts status and identify issues
-- Run this in your Supabase SQL editor

-- 1. Check recent scheduled posts and their status
SELECT 
    id,
    content->>'text' as post_text,
    platform,
    status,
    scheduled_time,
    published_at,
    platform_post_id,
    error_message,
    created_at
FROM scheduled_posts 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check for posts that should have been published but weren't
SELECT 
    id,
    content->>'text' as post_text,
    platform,
    status,
    scheduled_time,
    (scheduled_time <= NOW()) as should_be_published
FROM scheduled_posts 
WHERE status = 'scheduled' 
AND scheduled_time <= NOW()
ORDER BY scheduled_time ASC;

-- 3. Check platform credentials are active
SELECT 
    user_id,
    platform,
    is_active,
    created_at,
    updated_at
FROM platform_credentials
WHERE platform = 'threads'
ORDER BY updated_at DESC;

-- 4. Check if there are any failed posts
SELECT 
    id,
    content->>'text' as post_text,
    platform,
    status,
    error_message,
    scheduled_time
FROM scheduled_posts 
WHERE status = 'failed'
ORDER BY scheduled_time DESC
LIMIT 5;

-- 5. Test the manual trigger function
SELECT trigger_post_processing();