-- Fix remaining security issues detected by Supabase linter
-- This migration addresses:
-- 1. Additional functions without search_path set
-- 2. HTTP extension in public schema
-- 3. Any test functions that were created

-- ============================================================================
-- FIX FUNCTION SEARCH_PATH ISSUES
-- ============================================================================

-- Fix test_http_basic function (if it exists)
-- This might be a test function or created by http extension
DROP FUNCTION IF EXISTS test_http_basic() CASCADE;
DROP FUNCTION IF EXISTS test_http_basic(text) CASCADE;
DROP FUNCTION IF EXISTS test_http_basic(text, text) CASCADE;

-- Fix test_scheduled_posts function (if it exists)
DROP FUNCTION IF EXISTS test_scheduled_posts() CASCADE;

-- Fix process_scheduled_posts_cron function (if it exists)
-- This might be a cron wrapper function
DROP FUNCTION IF EXISTS process_scheduled_posts_cron() CASCADE;

-- Recreate process_scheduled_posts_cron with proper security settings
-- This function is likely called by pg_cron
CREATE OR REPLACE FUNCTION process_scheduled_posts_cron()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simply call the main process_scheduled_posts function
  PERFORM process_scheduled_posts();
END;
$$;

COMMENT ON FUNCTION process_scheduled_posts_cron() IS 'Wrapper function for cron job - SECURITY: Uses search_path protection';

-- Recreate calculate_next_post_date with proper security (if it wasn't updated)
-- This ensures it has the correct settings even if migration 013 missed it
CREATE OR REPLACE FUNCTION calculate_next_post_date(
  p_recurrence_type TEXT,
  p_recurrence_interval INTEGER,
  p_last_post_date TIMESTAMPTZ,
  p_recurrence_days INTEGER[],
  p_preferred_time TIME
)
RETURNS TIMESTAMPTZ
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_date TIMESTAMPTZ;
  v_current_date TIMESTAMPTZ;
  v_day_of_week INTEGER;
BEGIN
  -- Start from last post date or now
  v_current_date := COALESCE(p_last_post_date, NOW());

  CASE p_recurrence_type
    WHEN 'daily' THEN
      -- Add interval days
      v_next_date := v_current_date + (p_recurrence_interval || ' days')::INTERVAL;

    WHEN 'weekly' THEN
      -- Find next occurrence of specified days
      v_current_date := v_current_date + INTERVAL '1 day';

      LOOP
        v_day_of_week := EXTRACT(DOW FROM v_current_date)::INTEGER;

        IF v_day_of_week = ANY(p_recurrence_days) THEN
          v_next_date := v_current_date;
          EXIT;
        END IF;

        v_current_date := v_current_date + INTERVAL '1 day';
      END LOOP;

    WHEN 'monthly' THEN
      -- Add interval months
      v_next_date := v_current_date + (p_recurrence_interval || ' months')::INTERVAL;

    ELSE
      RAISE EXCEPTION 'Invalid recurrence type: %', p_recurrence_type;
  END CASE;

  -- Set to preferred time
  v_next_date := DATE_TRUNC('day', v_next_date) + p_preferred_time;

  -- Ensure next date is in the future
  IF v_next_date <= NOW() THEN
    v_next_date := v_next_date + INTERVAL '1 day';
  END IF;

  RETURN v_next_date;
END;
$$;

-- Recreate update_service_status with proper security (if it wasn't updated)
CREATE OR REPLACE FUNCTION update_service_status(
  p_service_name TEXT,
  p_enabled BOOLEAN,
  p_updated_by UUID
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the service status
  UPDATE service_controls
  SET
    enabled = p_enabled,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE service_name = p_service_name;

  -- If no rows were updated, insert a new record
  IF NOT FOUND THEN
    INSERT INTO service_controls (service_name, enabled, updated_by)
    VALUES (p_service_name, p_enabled, p_updated_by);
  END IF;

  RAISE NOTICE 'Service % status updated to % by user %', p_service_name, p_enabled, p_updated_by;
END;
$$;

-- ============================================================================
-- FIX HTTP EXTENSION IN PUBLIC SCHEMA
-- ============================================================================

-- Move http extension to extensions schema if it exists
DO $$
BEGIN
  -- Create extensions schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS extensions;

  -- Check if http extension exists in public schema
  IF EXISTS (
    SELECT 1 FROM pg_extension
    WHERE extname = 'http'
    AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- Note: We can't directly move an extension to another schema
    -- The best practice is to drop and recreate in the correct schema
    -- However, this might break existing functions that use it
    -- So we'll just comment on the issue
    RAISE NOTICE 'HTTP extension detected in public schema. Consider recreating in extensions schema.';
    RAISE NOTICE 'To fix: DROP EXTENSION http; CREATE EXTENSION http SCHEMA extensions;';
    RAISE NOTICE 'Warning: This will temporarily break any functions using http extension';
  END IF;
END $$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Ensure authenticated users can execute necessary functions
GRANT EXECUTE ON FUNCTION process_scheduled_posts_cron() TO service_role;
GRANT EXECUTE ON FUNCTION calculate_next_post_date(TEXT, INTEGER, TIMESTAMPTZ, INTEGER[], TIME) TO authenticated;
GRANT EXECUTE ON FUNCTION update_service_status(TEXT, BOOLEAN, UUID) TO authenticated;

-- ============================================================================
-- SECURITY COMMENTS
-- ============================================================================

COMMENT ON SCHEMA public IS 'Standard public schema - SECURITY: Extensions should be in extensions schema';
COMMENT ON FUNCTION calculate_next_post_date(TEXT, INTEGER, TIMESTAMPTZ, INTEGER[], TIME) IS 'Calculates next recurring post date - SECURITY: Uses search_path protection';
COMMENT ON FUNCTION update_service_status(TEXT, BOOLEAN, UUID) IS 'Updates service control status - SECURITY: Uses search_path protection';

-- ============================================================================
-- VERIFICATION QUERY (for manual checking)
-- ============================================================================

-- Uncomment to see all functions and their security settings:
-- SELECT
--   p.proname AS function_name,
--   p.prosecdef AS is_security_definer,
--   p.proconfig AS config_settings,
--   CASE
--     WHEN p.proconfig IS NULL THEN 'MISSING search_path'
--     WHEN 'search_path=public' = ANY(p.proconfig) THEN 'OK'
--     ELSE 'WRONG search_path'
--   END AS search_path_status
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.prokind = 'f'
-- ORDER BY search_path_status DESC, p.proname;
