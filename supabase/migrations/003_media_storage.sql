-- Media storage setup for Social Media Scheduler
-- This migration creates media files table and storage buckets

-- Media files table to track uploaded files
CREATE TABLE media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  width INTEGER,
  height INTEGER,
  duration REAL, -- For video files (in seconds)
  thumbnail_path VARCHAR(500),
  storage_bucket VARCHAR(100) DEFAULT 'media-files',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for media files
CREATE INDEX idx_media_files_user_id ON media_files(user_id);
CREATE INDEX idx_media_files_mime_type ON media_files(mime_type);
CREATE INDEX idx_media_files_created_at ON media_files(created_at);
CREATE INDEX idx_media_files_file_path ON media_files(file_path);

-- Add updated_at trigger to media_files
CREATE TRIGGER update_media_files_updated_at 
    BEFORE UPDATE ON media_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage buckets (these need to be created via Supabase dashboard or API)
-- The buckets will be:
-- - 'media-files': For original uploaded files
-- - 'thumbnails': For generated thumbnails

-- Note: Storage buckets and policies need to be set up via Supabase dashboard or API
-- This is documented in the storage service implementation