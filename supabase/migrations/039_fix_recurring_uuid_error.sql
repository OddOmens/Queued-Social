-- ============================================================================
-- FIX RECURRING POSTS UUID ERROR
-- ============================================================================
-- The process_recurring_posts function was incorrectly declaring
-- user_platform_account_id as UUID when it should be VARCHAR(100)
-- This caused failures when trying to process Threads posts
-- ============================================================================

DROP FUNCTION IF EXISTS process_recurring_posts();

CREATE OR REPLACE FUNCTION process_recurring_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    recurring_post_record RECORD;
    new_scheduled_post_id UUID;
    execution_time TIME;
    user_platform_account_id VARCHAR(100);  -- ✅ FIXED: Was UUID, should be VARCHAR
    user_account_name VARCHAR;
    new_next_post_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Find and LOCK recurring posts that should be posted now
    -- FOR UPDATE SKIP LOCKED prevents race conditions
    FOR recurring_post_record IN 
        SELECT * FROM recurring_posts 
        WHERE is_active = true 
        AND next_post_date IS NOT NULL
        AND next_post_date <= NOW()
        ORDER BY next_post_date
        FOR UPDATE SKIP LOCKED  -- ✅ ATOMIC LOCK
    LOOP
        BEGIN
            -- Calculate new next_post_date BEFORE creating the post
            -- This ensures we don't process the same recurring post twice
            new_next_post_date := calculate_next_post_date(
                recurring_post_record.days_of_week,
                recurring_post_record.time_range_start,
                recurring_post_record.time_range_end,
                recurring_post_record.timezone,
                recurring_post_record.next_post_date
            );
            
            -- Update next_post_date IMMEDIATELY to prevent other processes from seeing this
            UPDATE recurring_posts 
            SET 
                next_post_date = new_next_post_date,
                last_posted_at = recurring_post_record.next_post_date,
                updated_at = NOW()
            WHERE id = recurring_post_record.id;
            
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
                
                CONTINUE;
            END IF;
            
            -- Now create the scheduled post (after updating next_post_date)
            INSERT INTO scheduled_posts (
                user_id,
                platform,
                content,
                scheduled_time,
                status,
                platform_account_id,
                account_name,
                recurring_post_id
            ) VALUES (
                recurring_post_record.user_id,
                recurring_post_record.platform,
                recurring_post_record.content,
                recurring_post_record.next_post_date,
                'scheduled',
                user_platform_account_id,
                user_account_name,
                recurring_post_record.id
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
            
            RAISE NOTICE 'Created scheduled post % for recurring post % (next: %)', 
                new_scheduled_post_id, 
                recurring_post_record.id,
                new_next_post_date;
            
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
            
            RAISE NOTICE 'Failed to create scheduled post for recurring post %: %', recurring_post_record.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION process_recurring_posts IS 
  'Processes recurring posts with atomic locking and correct VARCHAR platform_account_id';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed recurring posts UUID error';
  RAISE NOTICE '✅ Changed user_platform_account_id from UUID to VARCHAR(100)';
END;
$$;
