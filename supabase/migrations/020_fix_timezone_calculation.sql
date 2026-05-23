-- Fix Timezone Calculation for Recurring Posts
-- The calculate_next_post_date function was not properly handling timezones

CREATE OR REPLACE FUNCTION calculate_next_post_date(
    p_days_of_week INTEGER[],
    p_time_range_start TIME,
    p_time_range_end TIME,
    p_timezone VARCHAR(50) DEFAULT 'UTC',
    p_last_posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
DECLARE
    current_time_tz TIMESTAMP WITH TIME ZONE;
    current_date_tz DATE;
    check_date DATE;
    day_of_week INTEGER;
    random_time TIME;
    next_post_timestamp TIMESTAMP WITH TIME ZONE;
    days_to_check INTEGER := 14; -- Check up to 2 weeks ahead
    local_timestamp TIMESTAMP;
BEGIN
    -- Get current time in the specified timezone
    current_time_tz := NOW() AT TIME ZONE p_timezone;
    current_date_tz := DATE(current_time_tz);
    
    -- Start checking from today (or day after last post if it was today)
    IF p_last_posted_at IS NOT NULL THEN
        DECLARE
            last_post_date_tz DATE;
        BEGIN
            last_post_date_tz := DATE(p_last_posted_at AT TIME ZONE p_timezone);
            IF last_post_date_tz = current_date_tz THEN
                check_date := current_date_tz + 1;
            ELSE
                check_date := current_date_tz;
            END IF;
        END;
    ELSE
        check_date := current_date_tz;
    END IF;
    
    -- Look for the next valid day within the next 2 weeks
    FOR i IN 0..days_to_check LOOP
        day_of_week := EXTRACT(DOW FROM check_date + i);
        
        -- Check if this day is in our target days
        IF day_of_week = ANY(p_days_of_week) THEN
            -- Generate random time within the specified range
            random_time := p_time_range_start + (
                RANDOM() * (
                    EXTRACT(EPOCH FROM p_time_range_end::TIME) - 
                    EXTRACT(EPOCH FROM p_time_range_start::TIME)
                )
            ) * INTERVAL '1 second';
            
            -- Create a local timestamp (without timezone) by combining date and time
            local_timestamp := (check_date + i) + random_time;
            
            -- Convert this local timestamp to UTC by specifying it's IN the user's timezone
            -- This is the correct way: we're saying "this time is in p_timezone, convert to UTC"
            next_post_timestamp := timezone(p_timezone, local_timestamp);
            
            -- Make sure it's in the future (compare in UTC)
            IF next_post_timestamp > NOW() THEN
                RETURN next_post_timestamp;
            END IF;
        END IF;
    END LOOP;
    
    -- If no valid date found, return NULL
    RETURN NULL;
END;
$$;

-- Test the function with Central Time
DO $$
DECLARE
    test_result TIMESTAMP WITH TIME ZONE;
    test_result_central TEXT;
    test_result_utc TEXT;
BEGIN
    -- Test with Central Time (America/Chicago)
    test_result := calculate_next_post_date(
        ARRAY[0,1,2,3,4,5,6], -- Every day
        '11:00'::TIME,        -- 11:00 AM
        '15:00'::TIME,        -- 3:00 PM
        'America/Chicago',    -- Central Time
        NULL
    );
    
    IF test_result IS NOT NULL THEN
        -- Show the result in both Central and UTC
        test_result_central := to_char(test_result AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD HH24:MI:SS TZ');
        test_result_utc := to_char(test_result, 'YYYY-MM-DD HH24:MI:SS TZ');
        
        RAISE NOTICE 'Test Result:';
        RAISE NOTICE '  Central Time: %', test_result_central;
        RAISE NOTICE '  UTC Time: %', test_result_utc;
        RAISE NOTICE '  Stored as: %', test_result;
        
        -- Verify the time is within the expected range in Central Time
        DECLARE
            hour_central INTEGER;
        BEGIN
            hour_central := EXTRACT(HOUR FROM test_result AT TIME ZONE 'America/Chicago');
            IF hour_central >= 11 AND hour_central < 15 THEN
                RAISE NOTICE '✅ Time is correctly within 11:00 AM - 3:00 PM Central';
            ELSE
                RAISE NOTICE '❌ Time is OUTSIDE the expected range! Hour: %', hour_central;
            END IF;
        END;
    ELSE
        RAISE NOTICE '❌ Function returned NULL';
    END IF;
END;
$$;

COMMENT ON FUNCTION calculate_next_post_date IS 'Calculates next post date with proper timezone handling. Times are specified in user timezone and stored as UTC.';
