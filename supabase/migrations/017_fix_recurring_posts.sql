-- Fix Recurring Posts Processing
-- This migration fixes the process_recurring_posts function to include platform_account_id
-- and adds testing/monitoring functions

-- 1. Update process_recurring_posts function to include platform_account_id
CREATE OR REPLACE FUNCTION process_recurring_posts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    recurring_post_record RECORD;
    new_scheduled_post_id UUID;
    execution_time TIME;
    user_platform_account_id UUID;
    user_account_name VARCHAR;
BEGIN
    -- Find recurring posts that should be posted now
    FOR recurring_post_record IN 
        SELECT * FROM recurring_posts 
        WHERE is_active = true 
        AND next_post_date IS NOT NULL
        AND next_post_date <= NOW()
        ORDER BY next_post_date
    LOOP
        BEGIN
            -- Extract the time component for the execution record
            execution_time := (recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone)::TIME;
            
            -- Get the user's active platform account for this platform
            SELECT platform_account_id, account_name 
            INTO user_platform_account_id, user_account_name
            FROM platform_credentials
            WHERE user_id = recurring_post_record.user_id
            AND platform = recurring_post_record.platform
            AND is_active = true
            LIMIT 1;
            
            -- Skip if no active account found
            IF user_platform_account_id IS NULL THEN
                RAISE NOTICE 'No active % account found for user %, skipping recurring post %', 
                    recurring_post_record.platform, 
                    recurring_post_record.user_id, 
                    recurring_post_record.id;
                
                -- Record the skipped execution
                INSERT INTO recurring_post_executions (
                    recurring_post_id,
                    execution_date,
                    execution_time,
                    status,
                    error_message
                ) VALUES (
                    recurring_post_record.id,
                    DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                    execution_time,
                    'skipped',
                    'No active platform account found'
                );
                
                -- Update next_post_date
                UPDATE recurring_posts 
                SET next_post_date = calculate_next_post_date(
                    days_of_week,
                    time_range_start,
                    time_range_end,
                    timezone,
                    recurring_post_record.next_post_date
                )
                WHERE id = recurring_post_record.id;
                
                CONTINUE;
            END IF;
            
            -- Create a new scheduled post with platform_account_id
            INSERT INTO scheduled_posts (
                user_id,
                platform,
                content,
                scheduled_time,
                status,
                platform_account_id,
                account_name
            ) VALUES (
                recurring_post_record.user_id,
                recurring_post_record.platform,
                recurring_post_record.content,
                recurring_post_record.next_post_date,
                'scheduled',
                user_platform_account_id,
                user_account_name
            ) RETURNING id INTO new_scheduled_post_id;
            
            -- Record the execution
            INSERT INTO recurring_post_executions (
                recurring_post_id,
                scheduled_post_id,
                execution_date,
                execution_time,
                status
            ) VALUES (
                recurring_post_record.id,
                new_scheduled_post_id,
                DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                execution_time,
                'scheduled'
            );
            
            -- Update the recurring post with last_posted_at and calculate next_post_date
            UPDATE recurring_posts 
            SET 
                last_posted_at = recurring_post_record.next_post_date,
                next_post_date = calculate_next_post_date(
                    days_of_week,
                    time_range_start,
                    time_range_end,
                    timezone,
                    recurring_post_record.next_post_date
                )
            WHERE id = recurring_post_record.id;
            
            RAISE NOTICE 'Created scheduled post % for recurring post %', new_scheduled_post_id, recurring_post_record.id;
            
        EXCEPTION WHEN OTHERS THEN
            -- Record the failed execution
            INSERT INTO recurring_post_executions (
                recurring_post_id,
                execution_date,
                execution_time,
                status,
                error_message
            ) VALUES (
                recurring_post_record.id,
                DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                execution_time,
                'failed',
                SQLERRM
            );
            
            -- Still update next_post_date so we don't get stuck
            UPDATE recurring_posts 
            SET next_post_date = calculate_next_post_date(
                days_of_week,
                time_range_start,
                time_range_end,
                timezone,
                recurring_post_record.next_post_date
            )
            WHERE id = recurring_post_record.id;
            
            RAISE NOTICE 'Failed to create scheduled post for recurring post %: %', recurring_post_record.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- 2. Add manual testing function
CREATE OR REPLACE FUNCTION test_process_recurring_posts()
RETURNS TABLE(
    recurring_post_id UUID,
    recurring_post_name VARCHAR,
    scheduled_post_id UUID,
    next_post_date TIMESTAMP WITH TIME ZONE,
    status TEXT,
    message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Call the main processing function
    PERFORM process_recurring_posts();
    
    -- Return results
    RETURN QUERY
    SELECT 
        rp.id as recurring_post_id,
        rp.name as recurring_post_name,
        rpe.scheduled_post_id,
        rp.next_post_date,
        rpe.status::TEXT,
        COALESCE(rpe.error_message, 'Success') as message
    FROM recurring_posts rp
    LEFT JOIN LATERAL (
        SELECT * FROM recurring_post_executions
        WHERE recurring_post_id = rp.id
        ORDER BY created_at DESC
        LIMIT 1
    ) rpe ON true
    WHERE rp.is_active = true
    ORDER BY rp.created_at DESC;
END;
$$;

-- 3. Add function to view upcoming recurring posts
CREATE OR REPLACE FUNCTION view_upcoming_recurring_posts(days_ahead INTEGER DEFAULT 7)
RETURNS TABLE(
    id UUID,
    name VARCHAR,
    platform VARCHAR,
    next_post_date TIMESTAMP WITH TIME ZONE,
    days_until_post NUMERIC,
    is_active BOOLEAN,
    content_preview TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rp.id,
        rp.name,
        rp.platform,
        rp.next_post_date,
        EXTRACT(EPOCH FROM (rp.next_post_date - NOW())) / 86400 as days_until_post,
        rp.is_active,
        LEFT((rp.content->>'text')::TEXT, 100) as content_preview
    FROM recurring_posts rp
    WHERE rp.is_active = true
    AND rp.next_post_date IS NOT NULL
    AND rp.next_post_date <= NOW() + (days_ahead || ' days')::INTERVAL
    ORDER BY rp.next_post_date ASC;
END;
$$;

-- 4. Add function to recalculate all next_post_dates
CREATE OR REPLACE FUNCTION recalculate_all_recurring_post_dates()
RETURNS TABLE(
    id UUID,
    name VARCHAR,
    old_next_post_date TIMESTAMP WITH TIME ZONE,
    new_next_post_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    post_record RECORD;
    new_date TIMESTAMP WITH TIME ZONE;
BEGIN
    FOR post_record IN 
        SELECT * FROM recurring_posts WHERE is_active = true
    LOOP
        new_date := calculate_next_post_date(
            post_record.days_of_week,
            post_record.time_range_start,
            post_record.time_range_end,
            post_record.timezone,
            post_record.last_posted_at
        );
        
        UPDATE recurring_posts
        SET next_post_date = new_date
        WHERE recurring_posts.id = post_record.id;
        
        RETURN QUERY
        SELECT 
            post_record.id,
            post_record.name,
            post_record.next_post_date as old_next_post_date,
            new_date as new_next_post_date;
    END LOOP;
END;
$$;

-- 5. Add cleanup function for old executions
CREATE OR REPLACE FUNCTION cleanup_old_recurring_executions(keep_per_post INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH ranked_executions AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY recurring_post_id 
                ORDER BY created_at DESC
            ) as rn
        FROM recurring_post_executions
    )
    DELETE FROM recurring_post_executions
    WHERE id IN (
        SELECT id FROM ranked_executions WHERE rn > keep_per_post
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 6. Recalculate next_post_date for all existing active recurring posts
SELECT * FROM recalculate_all_recurring_post_dates();

-- Add comments
COMMENT ON FUNCTION test_process_recurring_posts IS 'Manually trigger recurring posts processing and return results for testing';
COMMENT ON FUNCTION view_upcoming_recurring_posts IS 'View all upcoming recurring posts within specified days';
COMMENT ON FUNCTION recalculate_all_recurring_post_dates IS 'Force recalculation of next_post_date for all active recurring posts';
COMMENT ON FUNCTION cleanup_old_recurring_executions IS 'Clean up old execution records, keeping only the most recent N per recurring post';
