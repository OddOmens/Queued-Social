-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add platform_post_id column to scheduled_posts table if it doesn't exist
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS platform_post_id VARCHAR(255);

-- Add index for platform post ID lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_post_id 
ON scheduled_posts(platform_post_id) 
WHERE platform_post_id IS NOT NULL;

-- Create a function to call our Edge Function
CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    function_url text;
    response text;
BEGIN
    -- Get the Supabase URL from environment or use a default
    -- In production, you'll need to set this to your actual Supabase URL
    function_url := current_setting('app.supabase_url', true) || '/functions/v1/process-scheduled-posts';
    
    -- If the setting doesn't exist, we'll handle this in the application layer instead
    IF function_url IS NULL OR function_url = '/functions/v1/process-scheduled-posts' THEN
        -- Log that we're skipping the HTTP call
        RAISE NOTICE 'Supabase URL not configured, skipping Edge Function call';
        RETURN;
    END IF;
    
    -- Make HTTP request to our Edge Function
    -- Note: This requires the http extension which may not be available in all Supabase instances
    -- If this fails, we'll handle scheduling in the application layer instead
    BEGIN
        SELECT content INTO response FROM http_post(
            function_url,
            '{}',
            'application/json'
        );
        RAISE NOTICE 'Cron job executed successfully: %', response;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Cron job failed: %', SQLERRM;
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