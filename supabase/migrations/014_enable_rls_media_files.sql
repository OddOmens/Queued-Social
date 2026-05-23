-- Enable Row Level Security (RLS) for media_files table
-- This migration adds RLS policies to protect media files

-- Enable RLS on media_files table
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own media files
CREATE POLICY "Users can view own media files"
  ON media_files
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own media files
CREATE POLICY "Users can insert own media files"
  ON media_files
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own media files
CREATE POLICY "Users can update own media files"
  ON media_files
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own media files
CREATE POLICY "Users can delete own media files"
  ON media_files
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Service role has full access (for cleanup functions and edge functions)
CREATE POLICY "Service role has full access to media files"
  ON media_files
  FOR ALL
  USING (
    -- Check if the current role is the service role
    -- Service role operations bypass RLS by default, but this makes it explicit
    auth.jwt()->>'role' = 'service_role'
  );

-- Add helpful comments
COMMENT ON TABLE media_files IS 'Stores metadata for uploaded media files - SECURITY: RLS enabled, users can only access their own files';
COMMENT ON POLICY "Users can view own media files" ON media_files IS 'Allows users to view only their own media files';
COMMENT ON POLICY "Users can insert own media files" ON media_files IS 'Allows users to upload media files';
COMMENT ON POLICY "Users can update own media files" ON media_files IS 'Allows users to update their own media file metadata';
COMMENT ON POLICY "Users can delete own media files" ON media_files IS 'Allows users to delete their own media files';
COMMENT ON POLICY "Service role has full access to media files" ON media_files IS 'Allows service role (edge functions) to manage all media files for cleanup operations';
