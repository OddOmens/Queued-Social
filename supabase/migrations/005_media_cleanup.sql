-- Media cleanup functions and scheduled jobs

-- Function to clean up media files for failed posts older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_failed_post_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    post_record record;
    media_url text;
    filename text;
    file_path text;
    cleanup_count int := 0;
BEGIN
    RAISE NOTICE 'Starting cleanup of media files for failed posts older than 24 hours';
    
    -- Find failed posts older than 24 hours that have media
    FOR post_record IN 
        SELECT id, user_id, content, updated_at
        FROM scheduled_posts 
        WHERE status = 'failed' 
        AND updated_at < NOW() - INTERVAL '24 hours'
        AND content->>'mediaUrls' IS NOT NULL
        AND jsonb_array_length(content->'mediaUrls') > 0
    LOOP
        RAISE NOTICE 'Cleaning up media for failed post: %', post_record.id;
        
        -- Process each media URL in the post
        FOR media_url IN 
            SELECT jsonb_array_elements_text(post_record.content->'mediaUrls')
        LOOP
            -- Extract filename from URL
            filename := split_part(media_url, '/', -1);
            file_path := post_record.user_id || '/' || filename;
            
            RAISE NOTICE 'Cleaning up media file: %', file_path;
            
            -- Note: Actual file deletion would be handled by the application
            -- This function just identifies what needs to be cleaned up
            cleanup_count := cleanup_count + 1;
        END LOOP;
        
        -- Mark the post as cleaned up by removing media URLs
        UPDATE scheduled_posts 
        SET 
            content = content - 'mediaUrls',
            updated_at = NOW()
        WHERE id = post_record.id;
    END LOOP;
    
    RAISE NOTICE 'Media cleanup completed. Identified % files for cleanup', cleanup_count;
END;
$$;

-- Function to clean up orphaned media files older than 7 days
CREATE OR REPLACE FUNCTION cleanup_orphaned_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    media_record record;
    is_referenced boolean;
    cleanup_count int := 0;
BEGIN
    RAISE NOTICE 'Starting cleanup of orphaned media files older than 7 days';
    
    -- Find media files older than 7 days
    FOR media_record IN 
        SELECT id, user_id, file_path, created_at
        FROM media_files 
        WHERE created_at < NOW() - INTERVAL '7 days'
    LOOP
        -- Check if this media file is still referenced by any post
        SELECT EXISTS(
            SELECT 1 FROM scheduled_posts 
            WHERE user_id = media_record.user_id
            AND content->>'mediaUrls' LIKE '%' || split_part(media_record.file_path, '/', -1) || '%'
        ) INTO is_referenced;
        
        -- If not referenced, mark for cleanup
        IF NOT is_referenced THEN
            RAISE NOTICE 'Orphaned media file found: %', media_record.file_path;
            
            -- Delete the media record (actual file deletion handled by application)
            DELETE FROM media_files WHERE id = media_record.id;
            cleanup_count := cleanup_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Orphaned media cleanup completed. Removed % records', cleanup_count;
END;
$$;

-- Function to trigger media cleanup via Edge Function
CREATE OR REPLACE FUNCTION trigger_media_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    http_response record;
BEGIN
    RAISE NOTICE 'Triggering media cleanup Edge Function at %', NOW();
    
    -- First run the database cleanup functions
    PERFORM cleanup_failed_post_media();
    PERFORM cleanup_orphaned_media();
    
    -- Then trigger the Edge Function for actual file deletion
    BEGIN
        SELECT * INTO http_response FROM http((
            'POST',
            'http://supabase_edge_functions_cleanup-media/cleanup-media',
            ARRAY[http_header('Content-Type','application/json')],
            '{}',
            NULL
        )::http_request);
        
        RAISE NOTICE 'Media cleanup Edge Function response: status=%, content=%', 
                     http_response.status, http_response.content;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to call media cleanup Edge Function: %', SQLERRM;
    END;
END;
$$;

-- Schedule media cleanup to run daily at 2 AM
DO $$
BEGIN
    BEGIN
        -- Clean up failed post media daily
        PERFORM cron.schedule('cleanup-failed-post-media', '0 2 * * *', 'SELECT cleanup_failed_post_media();');
        
        -- Clean up orphaned media weekly (Sundays at 3 AM)
        PERFORM cron.schedule('cleanup-orphaned-media', '0 3 * * 0', 'SELECT cleanup_orphaned_media();');
        
        -- Trigger full media cleanup daily at 4 AM
        PERFORM cron.schedule('trigger-media-cleanup', '0 4 * * *', 'SELECT trigger_media_cleanup();');
        
        RAISE NOTICE 'Media cleanup cron jobs scheduled successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule media cleanup cron jobs: %. Will use application-level scheduling instead.', SQLERRM;
    END;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_updated_at 
ON scheduled_posts(status, updated_at) 
WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS idx_media_files_created_at 
ON media_files(created_at);

CREATE INDEX IF NOT EXISTS idx_media_files_user_id_created_at 
ON media_files(user_id, created_at);