-- Auto-clear errors when editing or rescheduling failed posts
-- This migration adds a trigger that automatically resets failed posts to scheduled
-- when the user edits the content or changes the scheduled time

-- Function to auto-clear errors and reset status when post is edited
CREATE OR REPLACE FUNCTION auto_clear_post_errors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only process if the post was previously failed
    IF OLD.status = 'failed' THEN
        -- If content or scheduled_time changed, reset to scheduled
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

-- Create trigger on scheduled_posts
DROP TRIGGER IF EXISTS auto_clear_post_errors_trigger ON scheduled_posts;
CREATE TRIGGER auto_clear_post_errors_trigger
    BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION auto_clear_post_errors();

COMMENT ON FUNCTION auto_clear_post_errors IS 'Automatically clears error_message and resets status to scheduled when a failed post is edited';
COMMENT ON TRIGGER auto_clear_post_errors_trigger ON scheduled_posts IS 'Auto-clears errors when user edits content or reschedules a failed post';
