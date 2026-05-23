-- Fix search_path security issue for all functions
-- This migration adds SET search_path to all functions to prevent search_path injection attacks

-- Drop functions that might have signature/return type changes
DROP FUNCTION IF EXISTS trigger_post_processing() CASCADE;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix process_scheduled_posts function
CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  post_record RECORD;
  service_enabled BOOLEAN;
BEGIN
  -- Check if the posting service is enabled
  SELECT is_service_enabled('posting_service') INTO service_enabled;

  IF NOT service_enabled THEN
    RAISE NOTICE 'Posting service is disabled. Skipping post processing.';
    RETURN;
  END IF;

  -- Find posts that are due to be published
  FOR post_record IN
    SELECT id, user_id, platform, content, scheduled_time
    FROM scheduled_posts
    WHERE status = 'scheduled'
      AND scheduled_time <= NOW()
    ORDER BY scheduled_time
  LOOP
    -- Here you would call your Edge Function to publish the post
    -- For now, we'll just log it
    RAISE NOTICE 'Processing post % for platform % at %',
      post_record.id,
      post_record.platform,
      post_record.scheduled_time;

    -- In production, this would trigger your Edge Function
    -- The Edge Function would handle the actual posting and update the status
  END LOOP;
END;
$$;

-- Fix trigger_post_processing function
-- Function was dropped above to handle return type changes
CREATE FUNCTION trigger_post_processing()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- This would notify your application to process posts
  PERFORM pg_notify('post_processing', json_build_object(
    'post_id', NEW.id,
    'user_id', NEW.user_id,
    'scheduled_time', NEW.scheduled_time
  )::text);

  RETURN NEW;
END;
$$;

-- Recreate trigger if it was dropped with CASCADE
DROP TRIGGER IF EXISTS trigger_post_processing_trigger ON scheduled_posts;
CREATE TRIGGER trigger_post_processing_trigger
  AFTER INSERT ON scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_post_processing();

-- Fix get_account_display_name function
CREATE OR REPLACE FUNCTION get_account_display_name(account_record platform_credentials)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  display_name TEXT;
BEGIN
  -- Extract display name from credentials JSONB based on platform
  CASE account_record.platform
    WHEN 'linkedin' THEN
      display_name := COALESCE(
        account_record.credentials->>'name',
        account_record.credentials->>'email',
        'LinkedIn Account'
      );
    WHEN 'threads' THEN
      display_name := COALESCE(
        account_record.credentials->>'username',
        'Threads Account'
      );
    ELSE
      display_name := account_record.platform || ' Account';
  END CASE;

  RETURN display_name;
END;
$$;

-- Fix create_default_templates function
CREATE OR REPLACE FUNCTION create_default_templates(user_uuid UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert default templates for the new user
  INSERT INTO templates (user_id, name, content, category, is_system)
  VALUES
    -- Professional templates
    (user_uuid, 'Product Launch', '🚀 Exciting news! We''re launching [Product Name] today!\n\n[Brief description]\n\nKey features:\n• [Feature 1]\n• [Feature 2]\n• [Feature 3]\n\nLearn more: [Link]', 'Professional', true),
    (user_uuid, 'Company Update', '📢 Company Update\n\n[Update details]\n\nWhat this means:\n[Explanation]\n\n#CompanyNews #Update', 'Professional', true),
    (user_uuid, 'Event Announcement', '📅 Save the date!\n\n[Event Name]\n📍 [Location]\n🗓️ [Date & Time]\n\nJoin us for [brief description]\n\nRegister: [Link]\n\n#Event #SaveTheDate', 'Professional', true),

    -- Engagement templates
    (user_uuid, 'Question Post', '❓ Quick question for you:\n\n[Your question]\n\nDrop your thoughts in the comments! 👇\n\n#Community #Question', 'Engagement', true),
    (user_uuid, 'Poll Post', '📊 We want to hear from you!\n\n[Poll question]\n\n👍 Option A: [Option]\n❤️ Option B: [Option]\n💡 Option C: [Option]\n\nVote below!\n\n#Poll #Community', 'Engagement', true),
    (user_uuid, 'Tips & Tricks', '💡 Pro Tip:\n\n[Your tip]\n\nWhy it works:\n[Explanation]\n\nTry it and let us know how it goes!\n\n#Tips #LifeHack', 'Engagement', true),

    -- Educational templates
    (user_uuid, 'How-To Guide', '📚 How to [Task]:\n\nStep 1: [Step]\nStep 2: [Step]\nStep 3: [Step]\n\n✨ Result: [Outcome]\n\nSave this for later!\n\n#HowTo #Tutorial', 'Educational', true),
    (user_uuid, 'Industry Insight', '🔍 Industry Insight:\n\n[Your insight]\n\nWhat does this mean?\n[Explanation]\n\nKey takeaways:\n• [Point 1]\n• [Point 2]\n\n#Industry #Insights', 'Educational', true),
    (user_uuid, 'Did You Know', '🤔 Did you know?\n\n[Interesting fact]\n\nWhy it matters:\n[Explanation]\n\nShare if you learned something new!\n\n#DidYouKnow #Learning', 'Educational', true);

  RAISE NOTICE 'Created default templates for user %', user_uuid;
END;
$$;

-- Fix trigger_create_default_templates function
CREATE OR REPLACE FUNCTION trigger_create_default_templates()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create default templates for the new user
  PERFORM create_default_templates(NEW.id);
  RETURN NEW;
END;
$$;

-- Fix calculate_next_post_date function
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

-- Fix update_recurring_post_next_date function
CREATE OR REPLACE FUNCTION update_recurring_post_next_date()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update next_scheduled_date when a post is published
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    UPDATE recurring_posts
    SET
      last_post_date = NEW.published_at,
      next_scheduled_date = calculate_next_post_date(
        recurrence_type,
        recurrence_interval,
        NEW.published_at,
        recurrence_days,
        preferred_time
      )
    WHERE id = NEW.recurring_post_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix process_recurring_posts function
CREATE OR REPLACE FUNCTION process_recurring_posts()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  recurring_record RECORD;
  new_post_id UUID;
BEGIN
  -- Find recurring posts that are due
  FOR recurring_record IN
    SELECT *
    FROM recurring_posts
    WHERE is_active = true
      AND next_scheduled_date <= NOW()
      AND (end_date IS NULL OR next_scheduled_date <= end_date)
  LOOP
    -- Create a new scheduled post
    INSERT INTO scheduled_posts (
      user_id,
      account_id,
      platform,
      content,
      scheduled_time,
      status,
      recurring_post_id
    )
    VALUES (
      recurring_record.user_id,
      recurring_record.account_id,
      recurring_record.platform,
      recurring_record.content,
      recurring_record.next_scheduled_date,
      'scheduled',
      recurring_record.id
    )
    RETURNING id INTO new_post_id;

    -- Update the recurring post's next date
    UPDATE recurring_posts
    SET
      last_post_date = recurring_record.next_scheduled_date,
      next_scheduled_date = calculate_next_post_date(
        recurrence_type,
        recurrence_interval,
        recurring_record.next_scheduled_date,
        recurrence_days,
        preferred_time
      )
    WHERE id = recurring_record.id;

    RAISE NOTICE 'Created scheduled post % from recurring post %', new_post_id, recurring_record.id;
  END LOOP;
END;
$$;

-- Fix update_service_status function
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

-- Fix is_service_enabled function
CREATE OR REPLACE FUNCTION is_service_enabled(p_service_name TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
  FROM service_controls
  WHERE service_name = p_service_name;

  -- If service doesn't exist in table, assume it's enabled
  RETURN COALESCE(v_enabled, true);
END;
$$;

-- Fix cleanup_failed_post_media function
CREATE OR REPLACE FUNCTION cleanup_failed_post_media()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  media_record RECORD;
  deleted_count INTEGER := 0;
BEGIN
  -- Find media files from failed posts older than 24 hours
  FOR media_record IN
    SELECT DISTINCT mf.id, mf.file_path, mf.thumbnail_path, mf.storage_bucket, mf.user_id
    FROM media_files mf
    INNER JOIN scheduled_posts sp ON sp.content->>'mediaUrl' = mf.file_path
    WHERE sp.status = 'failed'
      AND sp.updated_at < NOW() - INTERVAL '24 hours'
  LOOP
    -- Delete from storage
    BEGIN
      -- Note: Actual storage deletion happens via Supabase Storage API
      -- This is a placeholder for the deletion logic

      -- Delete the database record
      DELETE FROM media_files WHERE id = media_record.id;
      deleted_count := deleted_count + 1;

      RAISE NOTICE 'Deleted media file % for failed post', media_record.file_path;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to delete media file %: %', media_record.file_path, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Cleanup completed. Deleted % media files from failed posts', deleted_count;
END;
$$;

-- Fix cleanup_orphaned_media function
CREATE OR REPLACE FUNCTION cleanup_orphaned_media()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  media_record RECORD;
  deleted_count INTEGER := 0;
BEGIN
  -- Find media files not referenced by any posts (older than 7 days)
  FOR media_record IN
    SELECT mf.*
    FROM media_files mf
    WHERE mf.created_at < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_posts sp
        WHERE sp.content->>'mediaUrl' = mf.file_path
      )
  LOOP
    -- Delete the database record
    DELETE FROM media_files WHERE id = media_record.id;
    deleted_count := deleted_count + 1;

    RAISE NOTICE 'Deleted orphaned media file %', media_record.file_path;
  END LOOP;

  RAISE NOTICE 'Cleanup completed. Deleted % orphaned media files', deleted_count;
END;
$$;

-- Fix trigger_media_cleanup function
CREATE OR REPLACE FUNCTION trigger_media_cleanup()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Run both cleanup functions
  PERFORM cleanup_failed_post_media();
  PERFORM cleanup_orphaned_media();

  RAISE NOTICE 'Media cleanup triggered successfully';
END;
$$;

-- Fix reassign_post_to_account function
CREATE OR REPLACE FUNCTION reassign_post_to_account(
  p_post_id UUID,
  p_account_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_platform TEXT;
  v_post_platform TEXT;
BEGIN
  -- Get the platform from the account
  SELECT platform INTO v_account_platform
  FROM platform_credentials
  WHERE id = p_account_id AND user_id = p_user_id;

  IF v_account_platform IS NULL THEN
    RAISE EXCEPTION 'Account not found or does not belong to user';
  END IF;

  -- Get the platform from the post
  SELECT platform INTO v_post_platform
  FROM scheduled_posts
  WHERE id = p_post_id AND user_id = p_user_id;

  IF v_post_platform IS NULL THEN
    RAISE EXCEPTION 'Post not found or does not belong to user';
  END IF;

  -- Check if platforms match
  IF v_account_platform != v_post_platform THEN
    RAISE EXCEPTION 'Account platform (%) does not match post platform (%)', v_account_platform, v_post_platform;
  END IF;

  -- Update the post
  UPDATE scheduled_posts
  SET account_id = p_account_id
  WHERE id = p_post_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Fix test_http_basic function (if exists in Edge Functions)
-- Note: This is for Edge Functions, not database functions
-- The search_path issue might be from Deno/TypeScript Edge Functions
-- which don't have SQL search_path issues

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at timestamp - SECURITY: Uses search_path protection';
COMMENT ON FUNCTION process_scheduled_posts() IS 'Processes scheduled posts for publishing - SECURITY: Uses search_path protection';
COMMENT ON FUNCTION is_service_enabled(TEXT) IS 'Checks if a service is enabled - SECURITY: Uses search_path protection';
