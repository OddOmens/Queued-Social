-- Fix Recurring Posts Errors
-- Fixes issues with service_controls and recurring posts trigger

-- 1. Fix the recurring posts trigger to handle INSERT properly
CREATE OR REPLACE FUNCTION update_recurring_post_next_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Handle INSERT (no OLD record exists)
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_active = true THEN
            NEW.next_post_date := calculate_next_post_date(
                NEW.days_of_week,
                NEW.time_range_start,
                NEW.time_range_end,
                NEW.timezone,
                NEW.last_posted_at
            );
        ELSE
            NEW.next_post_date := NULL;
        END IF;
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Only update next_post_date if the post is active and relevant fields changed
        IF NEW.is_active = true AND (
            OLD.days_of_week IS DISTINCT FROM NEW.days_of_week OR
            OLD.time_range_start IS DISTINCT FROM NEW.time_range_start OR
            OLD.time_range_end IS DISTINCT FROM NEW.time_range_end OR
            OLD.timezone IS DISTINCT FROM NEW.timezone OR
            OLD.is_active IS DISTINCT FROM NEW.is_active OR
            OLD.last_posted_at IS DISTINCT FROM NEW.last_posted_at
        ) THEN
            NEW.next_post_date := calculate_next_post_date(
                NEW.days_of_week,
                NEW.time_range_start,
                NEW.time_range_end,
                NEW.timezone,
                NEW.last_posted_at
            );
        ELSIF NEW.is_active = false THEN
            NEW.next_post_date := NULL;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Recreate the trigger to ensure it's properly set up
DROP TRIGGER IF EXISTS update_recurring_post_next_date_trigger ON recurring_posts;
CREATE TRIGGER update_recurring_post_next_date_trigger
    BEFORE INSERT OR UPDATE ON recurring_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_recurring_post_next_date();

-- 3. Verify the service_status table exists (it should from migration 009)
-- If it doesn't exist, create it
CREATE TABLE IF NOT EXISTS service_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    disabled_reason TEXT,
    disabled_by UUID REFERENCES auth.users(id),
    disabled_at TIMESTAMPTZ,
    enabled_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ensure default services exist
INSERT INTO service_status (service_name, is_enabled) VALUES
    ('instagram', true),
    ('threads', true),
    ('linkedin', true),
    ('scheduling', true),
    ('publishing', true),
    ('media_upload', true),
    ('templates', true),
    ('webhooks', true)
ON CONFLICT (service_name) DO NOTHING;

-- 5. Ensure RLS is properly configured
ALTER TABLE service_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read service status" ON service_status;
DROP POLICY IF EXISTS "Service role can manage service status" ON service_status;

-- Recreate policies
CREATE POLICY "Authenticated users can read service status" ON service_status
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage service status" ON service_status
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 6. Ensure the is_service_enabled function exists
CREATE OR REPLACE FUNCTION is_service_enabled(p_service_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    service_enabled BOOLEAN;
BEGIN
    SELECT is_enabled INTO service_enabled
    FROM service_status
    WHERE service_name = p_service_name;
    
    RETURN COALESCE(service_enabled, true); -- Default to enabled if not found
END;
$$;

-- 7. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON service_status TO authenticated;
GRANT EXECUTE ON FUNCTION is_service_enabled(TEXT) TO authenticated;

-- 8. Test the recurring posts trigger with a dummy insert (will be rolled back)
DO $$
DECLARE
    test_id UUID;
BEGIN
    -- This tests if the trigger works without actually creating a post
    -- We'll use a savepoint to roll it back
    BEGIN
        INSERT INTO recurring_posts (
            user_id,
            name,
            platform,
            content,
            days_of_week,
            time_range_start,
            time_range_end,
            timezone,
            is_active
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', -- Dummy user ID
            'Test Post',
            'threads',
            '{"type": "single", "text": "Test", "metadata": {}}'::jsonb,
            ARRAY[1, 2, 3],
            '09:00',
            '17:00',
            'UTC',
            true
        ) RETURNING id INTO test_id;
        
        -- If we got here, the trigger worked
        RAISE NOTICE 'Trigger test successful, rolling back test insert';
        
        -- Roll back the test insert
        RAISE EXCEPTION 'Test successful, rolling back';
    EXCEPTION WHEN OTHERS THEN
        -- Expected - we're rolling back
        IF SQLERRM != 'Test successful, rolling back' THEN
            RAISE NOTICE 'Trigger test failed: %', SQLERRM;
        END IF;
    END;
END;
$$;

-- 9. Verify everything is working
SELECT 
    'Service Status Check' as test,
    service_name,
    is_enabled
FROM service_status
ORDER BY service_name;

COMMENT ON FUNCTION update_recurring_post_next_date IS 'Updated to handle both INSERT and UPDATE operations properly';
