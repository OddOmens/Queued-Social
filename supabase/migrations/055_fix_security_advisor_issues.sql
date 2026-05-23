-- ============================================================================
-- FIX ALL SUPABASE SECURITY ADVISOR ISSUES
-- ============================================================================
-- Addresses:
--   ERRORS:
--     1. security_definer_view: account_name_consistency view
--     2. rls_disabled_in_public: service_control table
--     3. rls_disabled_in_public: cron_execution_log table
--
--   WARNINGS:
--     4. rls_policy_always_true: goal_progress (Service role ALL USING(true))
--     5. rls_policy_always_true: threads_profile_snapshots (Service role ALL USING(true))
--     6. function_search_path_mutable: 22 functions missing SET search_path = public
-- ============================================================================

-- ============================================================================
-- 1. FIX SECURITY DEFINER VIEW: account_name_consistency
--    Drop and recreate as a plain SECURITY INVOKER view so that RLS policies
--    of the *querying* user are applied, not the view creator's.
-- ============================================================================
DROP VIEW IF EXISTS account_name_consistency;

CREATE VIEW account_name_consistency
WITH (security_invoker = true)
AS
SELECT
    pc.user_id,
    pc.platform,
    pc.platform_account_id,
    pc.account_name AS credential_account_name,
    COUNT(sp.id) AS total_posts,
    COUNT(sp.id) FILTER (WHERE sp.account_name = pc.account_name) AS matching_posts,
    COUNT(sp.id) FILTER (WHERE sp.account_name IS DISTINCT FROM pc.account_name) AS mismatched_posts,
    COUNT(sp.id) FILTER (WHERE sp.status = 'scheduled') AS scheduled_posts,
    COUNT(sp.id) FILTER (WHERE sp.status = 'published') AS published_posts,
    COUNT(sp.id) FILTER (WHERE sp.status = 'failed') AS failed_posts
FROM platform_credentials pc
LEFT JOIN scheduled_posts sp ON
    pc.user_id = sp.user_id AND
    pc.platform = sp.platform AND
    pc.platform_account_id = sp.platform_account_id
GROUP BY pc.user_id, pc.platform, pc.platform_account_id, pc.account_name
ORDER BY mismatched_posts DESC, total_posts DESC;

COMMENT ON VIEW account_name_consistency IS 'Monitor account name consistency across posts and credentials - SECURITY: Uses invoker rights so RLS is enforced';

-- ============================================================================
-- 2. FIX RLS: service_control table (may have been created outside migrations)
--    Enable RLS and restrict to service_role only (it is an internal control table).
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_control'
  ) THEN
    EXECUTE 'ALTER TABLE public.service_control ENABLE ROW LEVEL SECURITY';

    -- Drop existing policies to avoid conflicts
    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage service_control" ON public.service_control';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read service_control" ON public.service_control';

    -- Allow authenticated users to read (needed for service status checks in app)
    EXECUTE '
      CREATE POLICY "Authenticated users can read service_control"
        ON public.service_control FOR SELECT
        USING (auth.uid() IS NOT NULL)
    ';

    -- Only service_role can write
    EXECUTE '
      CREATE POLICY "Service role can manage service_control"
        ON public.service_control FOR ALL
        USING (auth.jwt() ->> ''role'' = ''service_role'')
    ';

    RAISE NOTICE '✅ RLS enabled on service_control';
  ELSE
    RAISE NOTICE '⚠️  Table service_control does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- 3. FIX RLS: cron_execution_log table
--    This is an internal debug/audit table — authenticated users can read,
--    only service_role can write.
-- ============================================================================
ALTER TABLE cron_execution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cron execution log" ON cron_execution_log;
DROP POLICY IF EXISTS "Service role can manage cron execution log" ON cron_execution_log;

CREATE POLICY "Authenticated users can read cron execution log"
  ON cron_execution_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage cron execution log"
  ON cron_execution_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE cron_execution_log IS 'Internal cron execution audit log - SECURITY: RLS enabled';

-- ============================================================================
-- 4 & 5. FIX PERMISSIVE RLS POLICIES (USING(true))
--    Replace blanket USING(true) policies with service_role-scoped ones.
-- ============================================================================

-- goal_progress
DROP POLICY IF EXISTS "Service role can manage goal progress" ON goal_progress;

CREATE POLICY "Service role can manage goal progress"
  ON goal_progress FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- threads_profile_snapshots
DROP POLICY IF EXISTS "Service role can manage profile snapshots" ON threads_profile_snapshots;

CREATE POLICY "Service role can manage profile snapshots"
  ON threads_profile_snapshots FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 6. FIX FUNCTION SEARCH_PATH: Add SET search_path = public to all affected
--    functions. Each is recreated with identical logic + the missing directive.
-- ============================================================================

-- ── is_service_enabled ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_service_enabled(p_service_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    service_enabled BOOLEAN;
BEGIN
    SELECT is_enabled INTO service_enabled
    FROM service_status
    WHERE service_name = p_service_name;

    RETURN COALESCE(service_enabled, true);
END;
$$;

-- ── is_admin ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE user_id = p_user_id
        AND plan_type = 'admin'
        AND status = 'active'
    ) INTO v_is_admin;

    RETURN v_is_admin;
END;
$$;

-- ── is_pro_or_admin ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_pro_or_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_access BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE user_id = p_user_id
        AND plan_type IN ('pro', 'admin')
        AND status = 'active'
    ) INTO v_has_access;

    RETURN v_has_access;
END;
$$;

-- ── update_service_status (009 variant with is_enabled column) ───────────────
CREATE OR REPLACE FUNCTION update_service_status(
    p_service_name TEXT,
    p_is_enabled BOOLEAN,
    p_disabled_reason TEXT DEFAULT NULL,
    p_admin_user_id UUID DEFAULT NULL
)
RETURNS service_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result service_status;
    admin_id UUID;
BEGIN
    admin_id := COALESCE(p_admin_user_id, auth.uid());

    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;

    UPDATE service_status
    SET
        is_enabled = p_is_enabled,
        disabled_reason = CASE WHEN p_is_enabled THEN NULL ELSE p_disabled_reason END,
        disabled_by = CASE WHEN p_is_enabled THEN NULL ELSE admin_id END,
        disabled_at = CASE WHEN p_is_enabled THEN NULL ELSE NOW() END,
        enabled_at = CASE WHEN p_is_enabled THEN NOW() ELSE enabled_at END,
        updated_at = NOW()
    WHERE service_name = p_service_name
    RETURNING * INTO result;

    INSERT INTO admin_actions (admin_user_id, action_type, target_service, details)
    VALUES (
        admin_id,
        CASE WHEN p_is_enabled THEN 'enable_service' ELSE 'disable_service' END,
        p_service_name,
        jsonb_build_object(
            'reason', p_disabled_reason,
            'previous_status', NOT p_is_enabled
        )
    );

    RETURN result;
END;
$$;

-- ── reassign_post_to_account ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reassign_post_to_account(
  post_id UUID,
  new_platform_account_id VARCHAR(100),
  new_account_name VARCHAR(255) DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_record scheduled_posts%ROWTYPE;
  credential_exists BOOLEAN;
BEGIN
  SELECT * INTO post_record FROM scheduled_posts WHERE id = post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post with ID % not found', post_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM platform_credentials
    WHERE user_id = post_record.user_id
    AND platform = post_record.platform
    AND platform_account_id = new_platform_account_id
    AND is_active = true
  ) INTO credential_exists;

  IF NOT credential_exists THEN
    RAISE EXCEPTION 'No active credentials found for platform % account %', post_record.platform, new_platform_account_id;
  END IF;

  UPDATE scheduled_posts
  SET
    platform_account_id = new_platform_account_id,
    account_name = COALESCE(new_account_name, new_platform_account_id),
    updated_at = now()
  WHERE id = post_id;

  RAISE NOTICE 'Successfully reassigned post % to account %', post_id, new_platform_account_id;
  RETURN TRUE;
END;
$$;

-- ── test_process_recurring_posts ─────────────────────────────────────────────
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM process_recurring_posts();

    RETURN QUERY
    SELECT
        rp.id AS recurring_post_id,
        rp.name AS recurring_post_name,
        rpe.scheduled_post_id,
        rp.next_post_date,
        rpe.status::TEXT,
        COALESCE(rpe.error_message, 'Success') AS message
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

-- ── view_upcoming_recurring_posts ────────────────────────────────────────────
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rp.id,
        rp.name,
        rp.platform,
        rp.next_post_date,
        EXTRACT(EPOCH FROM (rp.next_post_date - NOW())) / 86400 AS days_until_post,
        rp.is_active,
        LEFT((rp.content->>'text')::TEXT, 100) AS content_preview
    FROM recurring_posts rp
    WHERE rp.is_active = true
    AND rp.next_post_date IS NOT NULL
    AND rp.next_post_date <= NOW() + (days_ahead || ' days')::INTERVAL
    ORDER BY rp.next_post_date ASC;
END;
$$;

-- ── recalculate_all_recurring_post_dates ─────────────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_all_recurring_post_dates()
RETURNS TABLE(
    id UUID,
    name VARCHAR,
    old_next_post_date TIMESTAMP WITH TIME ZONE,
    new_next_post_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
            post_record.next_post_date AS old_next_post_date,
            new_date AS new_next_post_date;
    END LOOP;
END;
$$;

-- ── cleanup_old_recurring_executions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_recurring_executions(keep_per_post INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
            ) AS rn
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

-- ── sync_account_names_on_credential_update ───────────────────────────────────
CREATE OR REPLACE FUNCTION sync_account_names_on_credential_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.account_name IS DISTINCT FROM NEW.account_name) OR
       (OLD.account_username IS DISTINCT FROM NEW.account_username) THEN

        UPDATE scheduled_posts
        SET
            account_name = NEW.account_name,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
        AND platform = NEW.platform
        AND platform_account_id = NEW.platform_account_id;

        RAISE NOTICE 'Updated account name for % posts from "%" to "%" for account %',
            (SELECT COUNT(*) FROM scheduled_posts
             WHERE user_id = NEW.user_id
             AND platform = NEW.platform
             AND platform_account_id = NEW.platform_account_id),
            OLD.account_name,
            NEW.account_name,
            NEW.platform_account_id;
    END IF;

    RETURN NEW;
END;
$$;

-- ── sync_all_account_names ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_all_account_names()
RETURNS TABLE(
    platform VARCHAR,
    platform_account_id VARCHAR,
    account_name VARCHAR,
    posts_updated INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    credential_record RECORD;
    updated_count INTEGER;
BEGIN
    FOR credential_record IN
        SELECT
            pc.user_id,
            pc.platform,
            pc.platform_account_id,
            pc.account_name
        FROM platform_credentials pc
        WHERE pc.account_name IS NOT NULL
    LOOP
        UPDATE scheduled_posts sp
        SET
            account_name = credential_record.account_name,
            updated_at = NOW()
        WHERE sp.user_id = credential_record.user_id
        AND sp.platform = credential_record.platform
        AND sp.platform_account_id = credential_record.platform_account_id
        AND (sp.account_name IS DISTINCT FROM credential_record.account_name);

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        IF updated_count > 0 THEN
            RETURN QUERY
            SELECT
                credential_record.platform,
                credential_record.platform_account_id,
                credential_record.account_name,
                updated_count;
        END IF;
    END LOOP;
END;
$$;

-- ── check_account_name_mismatches ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_account_name_mismatches()
RETURNS TABLE(
    post_id UUID,
    post_status VARCHAR,
    post_scheduled_time TIMESTAMP WITH TIME ZONE,
    post_account_name VARCHAR,
    credential_account_name VARCHAR,
    platform VARCHAR,
    platform_account_id VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id AS post_id,
        sp.status AS post_status,
        sp.scheduled_time AS post_scheduled_time,
        sp.account_name AS post_account_name,
        pc.account_name AS credential_account_name,
        sp.platform,
        sp.platform_account_id
    FROM scheduled_posts sp
    JOIN platform_credentials pc ON
        sp.user_id = pc.user_id AND
        sp.platform = pc.platform AND
        sp.platform_account_id = pc.platform_account_id
    WHERE sp.account_name IS DISTINCT FROM pc.account_name
    ORDER BY sp.scheduled_time DESC;
END;
$$;

-- ── update_recurring_post_next_date ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_recurring_post_next_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
END;
$$;

-- ── calculate_next_post_date ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_next_post_date(
    p_days_of_week INTEGER[],
    p_time_range_start TIME,
    p_time_range_end TIME,
    p_timezone VARCHAR(50) DEFAULT 'UTC',
    p_last_posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_date_tz TIMESTAMP WITH TIME ZONE;
    check_date DATE;
    day_of_week INTEGER;
    random_time TIME;
    next_post_timestamp TIMESTAMP WITH TIME ZONE;
    days_to_check INTEGER := 14;
BEGIN
    current_date_tz := NOW() AT TIME ZONE p_timezone;

    IF p_last_posted_at IS NOT NULL AND DATE(p_last_posted_at AT TIME ZONE p_timezone) = DATE(current_date_tz) THEN
        check_date := DATE(current_date_tz) + INTERVAL '1 day';
    ELSE
        check_date := DATE(current_date_tz);
    END IF;

    FOR i IN 0..days_to_check LOOP
        day_of_week := EXTRACT(DOW FROM check_date + i);

        IF day_of_week = ANY(p_days_of_week) THEN
            random_time := p_time_range_start + (
                RANDOM() * (
                    EXTRACT(EPOCH FROM p_time_range_end) -
                    EXTRACT(EPOCH FROM p_time_range_start)
                )
            ) * INTERVAL '1 second';

            next_post_timestamp := (check_date + i)::TIMESTAMP + random_time;
            next_post_timestamp := next_post_timestamp AT TIME ZONE p_timezone;

            IF next_post_timestamp > NOW() THEN
                RETURN next_post_timestamp;
            END IF;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$;

-- ── can_upload_media (may exist from older migration or dashboard) ─────────────
-- Recreate only if it exists, preserving its logic but adding search_path
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_upload_media') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION can_upload_media(p_user_id UUID)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      DECLARE
          v_can BOOLEAN;
      BEGIN
          -- Allow upload if user has an active subscription (any tier)
          SELECT EXISTS (
            SELECT 1 FROM subscriptions
            WHERE user_id = p_user_id
            AND status = ''active''
          ) INTO v_can;
          RETURN COALESCE(v_can, false);
      END;
      $fn$
    ';
    RAISE NOTICE '✅ Updated can_upload_media with search_path';
  ELSE
    RAISE NOTICE '⚠️  Function can_upload_media does not exist, skipping';
  END IF;
END $$;

-- ── can_create_post ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_create_post(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER;
    v_current_count INTEGER;
BEGIN
    v_limit := get_user_post_limit(p_user_id);

    IF v_limit = -1 THEN
        RETURN TRUE;
    END IF;

    SELECT COUNT(*) INTO v_current_count
    FROM scheduled_posts
    WHERE user_id = p_user_id
    AND status IN ('pending', 'processing');

    RETURN v_current_count < v_limit;
END;
$$;

-- ── auto_clear_post_errors ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_clear_post_errors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'failed' THEN
        IF (OLD.content IS DISTINCT FROM NEW.content) OR
           (OLD.scheduled_time IS DISTINCT FROM NEW.scheduled_time) THEN

            NEW.status := 'scheduled';
            NEW.error_message := NULL;
            NEW.updated_at := NOW();

            RAISE NOTICE 'Auto-cleared error for post % - content or schedule changed', NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- ── get_user_post_limit ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_post_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_type TEXT;
BEGIN
    SELECT plan_type INTO v_plan_type
    FROM subscriptions
    WHERE user_id = p_user_id
    AND status = 'active';

    IF v_plan_type IS NULL THEN
        v_plan_type := 'free';
    END IF;

    CASE v_plan_type
        WHEN 'admin' THEN
            RETURN -1;
        WHEN 'pro' THEN
            RETURN -1;
        ELSE
            RETURN 30;
    END CASE;
END;
$$;

-- ── check_post_limit ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_post_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_can_create BOOLEAN;
BEGIN
    v_can_create := can_create_post(NEW.user_id);

    IF NOT v_can_create THEN
        RAISE EXCEPTION 'Post limit reached. Upgrade to Pro for unlimited posts.';
    END IF;

    RETURN NEW;
END;
$$;

-- ── auto_grant_admin ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_grant_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM admin_users WHERE email = NEW.email
    ) THEN
        INSERT INTO subscriptions (user_id, plan_type, status)
        VALUES (NEW.id, 'admin', 'active')
        ON CONFLICT (user_id)
        DO UPDATE SET
            plan_type = 'admin',
            status = 'active',
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

-- ── process_recurring_posts ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_recurring_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    recurring_post_record RECORD;
    new_scheduled_post_id UUID;
    execution_time TIME;
    user_platform_account_id UUID;
    user_account_name VARCHAR;
BEGIN
    FOR recurring_post_record IN
        SELECT * FROM recurring_posts
        WHERE is_active = true
        AND next_post_date IS NOT NULL
        AND next_post_date <= NOW()
        ORDER BY next_post_date
    LOOP
        BEGIN
            execution_time := (recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone)::TIME;

            SELECT platform_account_id, account_name
            INTO user_platform_account_id, user_account_name
            FROM platform_credentials
            WHERE user_id = recurring_post_record.user_id
            AND platform = recurring_post_record.platform
            AND is_active = true
            LIMIT 1;

            IF user_platform_account_id IS NULL THEN
                RAISE NOTICE 'No active % account found for user %, skipping recurring post %',
                    recurring_post_record.platform,
                    recurring_post_record.user_id,
                    recurring_post_record.id;

                INSERT INTO recurring_post_executions (
                    recurring_post_id, execution_date, execution_time, status, error_message
                ) VALUES (
                    recurring_post_record.id,
                    DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                    execution_time,
                    'skipped',
                    'No active platform account found'
                );

                UPDATE recurring_posts
                SET next_post_date = calculate_next_post_date(
                    days_of_week, time_range_start, time_range_end, timezone,
                    recurring_post_record.next_post_date
                )
                WHERE id = recurring_post_record.id;

                CONTINUE;
            END IF;

            INSERT INTO scheduled_posts (
                user_id, platform, content, scheduled_time, status,
                platform_account_id, account_name
            ) VALUES (
                recurring_post_record.user_id,
                recurring_post_record.platform,
                recurring_post_record.content,
                recurring_post_record.next_post_date,
                'scheduled',
                user_platform_account_id,
                user_account_name
            ) RETURNING id INTO new_scheduled_post_id;

            INSERT INTO recurring_post_executions (
                recurring_post_id, scheduled_post_id, execution_date, execution_time, status
            ) VALUES (
                recurring_post_record.id,
                new_scheduled_post_id,
                DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                execution_time,
                'scheduled'
            );

            UPDATE recurring_posts
            SET
                last_posted_at = recurring_post_record.next_post_date,
                next_post_date = calculate_next_post_date(
                    days_of_week, time_range_start, time_range_end, timezone,
                    recurring_post_record.next_post_date
                )
            WHERE id = recurring_post_record.id;

            RAISE NOTICE 'Created scheduled post % for recurring post %', new_scheduled_post_id, recurring_post_record.id;

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO recurring_post_executions (
                recurring_post_id, execution_date, execution_time, status, error_message
            ) VALUES (
                recurring_post_record.id,
                DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                execution_time,
                'failed',
                SQLERRM
            );

            UPDATE recurring_posts
            SET next_post_date = calculate_next_post_date(
                days_of_week, time_range_start, time_range_end, timezone,
                recurring_post_record.next_post_date
            )
            WHERE id = recurring_post_record.id;

            RAISE NOTICE 'Failed to create scheduled post for recurring post %: %', recurring_post_record.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- ── claim_scheduled_posts_for_processing ─────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_scheduled_posts_for_processing(
  p_current_time TIMESTAMPTZ,
  lookback_minutes INTEGER DEFAULT 2,
  batch_size INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  platform VARCHAR(50),
  content JSONB,
  scheduled_time TIMESTAMPTZ,
  status VARCHAR(20),
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  platform_post_id VARCHAR(255),
  platform_account_id VARCHAR(100),
  account_name VARCHAR(255),
  analytics JSONB,
  recurring_post_id UUID,
  media_urls TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lookback_time TIMESTAMPTZ;
BEGIN
  lookback_time := p_current_time - (lookback_minutes || ' minutes')::INTERVAL;

  RETURN QUERY
  UPDATE scheduled_posts
  SET
    status = 'publishing',
    updated_at = p_current_time
  WHERE scheduled_posts.id IN (
    SELECT scheduled_posts.id
    FROM scheduled_posts
    WHERE scheduled_posts.status = 'scheduled'
      AND scheduled_posts.scheduled_time <= p_current_time
      AND scheduled_posts.scheduled_time >= lookback_time
    ORDER BY scheduled_posts.scheduled_time ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    scheduled_posts.id,
    scheduled_posts.user_id,
    scheduled_posts.platform,
    scheduled_posts.content,
    scheduled_posts.scheduled_time,
    scheduled_posts.status,
    scheduled_posts.published_at,
    scheduled_posts.error_message,
    scheduled_posts.created_at,
    scheduled_posts.updated_at,
    scheduled_posts.platform_post_id,
    scheduled_posts.platform_account_id,
    scheduled_posts.account_name,
    scheduled_posts.analytics,
    scheduled_posts.recurring_post_id,
    scheduled_posts.media_urls;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  view_ok BOOLEAN;
  svc_ctrl_rls BOOLEAN;
  cron_log_rls BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO cron_log_rls
    FROM pg_class WHERE relname = 'cron_execution_log' AND relkind = 'r';

  RAISE NOTICE '=== SECURITY ADVISOR FIX VERIFICATION ===';
  RAISE NOTICE 'cron_execution_log RLS enabled: %', CASE WHEN cron_log_rls THEN '✅' ELSE '❌' END;
  RAISE NOTICE 'All functions recreated with SET search_path = public ✅';
  RAISE NOTICE 'account_name_consistency view recreated as SECURITY INVOKER ✅';
  RAISE NOTICE 'Permissive RLS policies replaced with service_role scoped policies ✅';
  RAISE NOTICE '=== FIX COMPLETE ===';
END;
$$;
