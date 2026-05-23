-- Sync Account Names Across Posts
-- This migration ensures that when a user updates their platform account name,
-- all related posts (scheduled, failed, published) reflect the updated label

-- Function to sync account names when platform_credentials is updated
CREATE OR REPLACE FUNCTION sync_account_names_on_credential_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only proceed if account_name or account_username changed
    IF (OLD.account_name IS DISTINCT FROM NEW.account_name) OR 
       (OLD.account_username IS DISTINCT FROM NEW.account_username) THEN
        
        -- Update all scheduled_posts with this account
        UPDATE scheduled_posts
        SET 
            account_name = NEW.account_name,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
        AND platform = NEW.platform
        AND platform_account_id = NEW.platform_account_id;
        
        -- Log the update
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

-- Create trigger on platform_credentials
DROP TRIGGER IF EXISTS sync_account_names_trigger ON platform_credentials;
CREATE TRIGGER sync_account_names_trigger
    AFTER UPDATE ON platform_credentials
    FOR EACH ROW
    EXECUTE FUNCTION sync_account_names_on_credential_update();

-- Function to manually sync account names for all posts
-- Useful for fixing any inconsistencies or after bulk updates
CREATE OR REPLACE FUNCTION sync_all_account_names()
RETURNS TABLE(
    platform VARCHAR,
    platform_account_id VARCHAR,
    account_name VARCHAR,
    posts_updated INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    credential_record RECORD;
    updated_count INTEGER;
BEGIN
    -- Loop through all active platform credentials
    FOR credential_record IN 
        SELECT 
            pc.user_id,
            pc.platform,
            pc.platform_account_id,
            pc.account_name
        FROM platform_credentials pc
        WHERE pc.account_name IS NOT NULL
    LOOP
        -- Update scheduled_posts for this credential
        UPDATE scheduled_posts sp
        SET 
            account_name = credential_record.account_name,
            updated_at = NOW()
        WHERE sp.user_id = credential_record.user_id
        AND sp.platform = credential_record.platform
        AND sp.platform_account_id = credential_record.platform_account_id
        AND (sp.account_name IS DISTINCT FROM credential_record.account_name);
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        
        -- Return results for this credential
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

-- Function to check for posts with mismatched account names
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
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id as post_id,
        sp.status as post_status,
        sp.scheduled_time as post_scheduled_time,
        sp.account_name as post_account_name,
        pc.account_name as credential_account_name,
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

-- Run initial sync to fix any existing mismatches
SELECT * FROM sync_all_account_names();

-- Add comments
COMMENT ON FUNCTION sync_account_names_on_credential_update IS 'Automatically syncs account names to all related posts when platform_credentials is updated';
COMMENT ON FUNCTION sync_all_account_names IS 'Manually sync account names for all posts from their platform credentials';
COMMENT ON FUNCTION check_account_name_mismatches IS 'Find posts with account names that do not match their platform credentials';

-- Create a view for easy monitoring of account name consistency
CREATE OR REPLACE VIEW account_name_consistency AS
SELECT 
    pc.user_id,
    pc.platform,
    pc.platform_account_id,
    pc.account_name as credential_account_name,
    COUNT(sp.id) as total_posts,
    COUNT(sp.id) FILTER (WHERE sp.account_name = pc.account_name) as matching_posts,
    COUNT(sp.id) FILTER (WHERE sp.account_name IS DISTINCT FROM pc.account_name) as mismatched_posts,
    COUNT(sp.id) FILTER (WHERE sp.status = 'scheduled') as scheduled_posts,
    COUNT(sp.id) FILTER (WHERE sp.status = 'published') as published_posts,
    COUNT(sp.id) FILTER (WHERE sp.status = 'failed') as failed_posts
FROM platform_credentials pc
LEFT JOIN scheduled_posts sp ON 
    pc.user_id = sp.user_id AND
    pc.platform = sp.platform AND
    pc.platform_account_id = sp.platform_account_id
GROUP BY pc.user_id, pc.platform, pc.platform_account_id, pc.account_name
ORDER BY mismatched_posts DESC, total_posts DESC;

COMMENT ON VIEW account_name_consistency IS 'Monitor account name consistency across posts and credentials';
