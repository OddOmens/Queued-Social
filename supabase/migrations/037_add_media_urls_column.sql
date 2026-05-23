-- ============================================================================
-- ADD MEDIA_URLS COLUMN TO SCHEDULED_POSTS
-- ============================================================================
-- The edge function expects media_urls as a separate column
-- ============================================================================

-- Add media_urls column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_posts' AND column_name = 'media_urls'
  ) THEN
    ALTER TABLE scheduled_posts ADD COLUMN media_urls TEXT[];
    RAISE NOTICE '✅ Added media_urls column to scheduled_posts';
  ELSE
    RAISE NOTICE '⚠️ media_urls column already exists';
  END IF;
END;
$$;

-- Create index for media posts
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_has_media
  ON scheduled_posts((media_urls IS NOT NULL AND array_length(media_urls, 1) > 0))
  WHERE status = 'scheduled';

-- Verify the column was created
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_posts' AND column_name = 'media_urls'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE NOTICE '✅ media_urls column exists in scheduled_posts table';
    RAISE NOTICE '✅ Edge function can now access media URLs';
  ELSE
    RAISE WARNING '❌ media_urls column was not created';
  END IF;
END;
$$;

COMMENT ON COLUMN scheduled_posts.media_urls IS 'Array of media file URLs for posts with images/videos';
