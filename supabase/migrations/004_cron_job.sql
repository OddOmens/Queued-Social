-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add platform_post_id column to scheduled_posts table if it doesn't exist
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS platform_post_id VARCHAR(255);

-- Add index for platform post ID lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_post_id 
ON scheduled_posts(platform_post_id) 
WHERE platform_post_id IS NOT NULL;

-- Create a function to trigger the Edge Function
CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    http_response record;
    request_id int;
BEGIN
    -- Log that we're starting
    RAISE NOTICE 'Triggering Edge Function for scheduled posts processing at %', NOW();
    
    -- Call the Edge Function using Supabase internal networking
    BEGIN
        SELECT * INTO http_response FROM http((
            'POST',
            'http://supabase_edge_functions_process-scheduled-posts/process-scheduled-posts',
            ARRAY[http_header('Content-Type','application/json')],
            '{}',
            NULL
        )::http_request);
        
        RAISE NOTICE 'Edge Function response: status=%, content=%', http_response.status, http_response.content;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to call Edge Function: %', SQLERRM;
        
        -- Fallback: Just log what we would process
        RAISE NOTICE 'Fallback: Found % scheduled posts to process', (
            SELECT COUNT(*) FROM scheduled_posts 
            WHERE status = 'scheduled' 
            AND scheduled_time <= NOW()
            AND scheduled_time >= NOW() - INTERVAL '1 hour'
        );
        
        -- Also log current time and any scheduled posts
        RAISE NOTICE 'Current time: %, Scheduled posts: %', NOW(), (
            SELECT string_agg(id::text || ' at ' || scheduled_time::text, ', ')
            FROM (
                SELECT id, scheduled_time 
                FROM scheduled_posts 
                WHERE status = 'scheduled'
                ORDER BY scheduled_time DESC
                LIMIT 5
            ) subq
        );
    END;
END;
$$;

-- Schedule the function to run every minute
-- Note: This will only work if pg_cron is properly configured
-- If it fails, we'll use application-level scheduling instead
DO $$
BEGIN
    -- Try to schedule the cron job
    BEGIN
        PERFORM cron.schedule('process-scheduled-posts', '* * * * *', 'SELECT process_scheduled_posts();');
        RAISE NOTICE 'Cron job scheduled successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule cron job: %. Will use application-level scheduling instead.', SQLERRM;
    END;
END;
$$;

-- Create a manual trigger function for testing
CREATE OR REPLACE FUNCTION trigger_post_processing()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    processed_count int := 0;
    failed_count int := 0;
    post_record record;
BEGIN
    -- Get posts that should be published now
    FOR post_record IN 
        SELECT * FROM scheduled_posts 
        WHERE status = 'scheduled' 
        AND scheduled_time <= NOW()
        AND scheduled_time >= NOW() - INTERVAL '1 minute'
    LOOP
        BEGIN
            -- Update post to published status
            -- Note: This is just a simulation - real publishing happens in the app
            UPDATE scheduled_posts 
            SET 
                status = 'published',
                published_at = NOW(),
                updated_at = NOW()
            WHERE id = post_record.id;
            
            processed_count := processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Mark as failed
            UPDATE scheduled_posts 
            SET 
                status = 'failed',
                error_message = SQLERRM,
                updated_at = NOW()
            WHERE id = post_record.id;
            
            failed_count := failed_count + 1;
        END;
    END LOOP;
    
    result := json_build_object(
        'processed', processed_count,
        'failed', failed_count,
        'message', format('Processed %s posts, %s failed', processed_count, failed_count)
    );
    
    RETURN result;
END;
$$;