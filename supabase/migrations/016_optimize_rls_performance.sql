-- Optimize RLS policies for better performance
-- This migration wraps auth.uid() and auth.jwt() calls in subqueries
-- to prevent re-evaluation on every row

-- The fix: Replace auth.uid() with (SELECT auth.uid())
-- This calculates the user ID once per query instead of once per row

-- ============================================================================
-- MEDIA_FILES TABLE - Fix RLS performance and simplify policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own media files" ON media_files;
DROP POLICY IF EXISTS "Users can insert own media files" ON media_files;
DROP POLICY IF EXISTS "Users can update own media files" ON media_files;
DROP POLICY IF EXISTS "Users can delete own media files" ON media_files;
DROP POLICY IF EXISTS "Service role has full access to media files" ON media_files;

-- Recreate with optimized auth function calls
CREATE POLICY "Users can view own media files"
  ON media_files
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own media files"
  ON media_files
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own media files"
  ON media_files
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own media files"
  ON media_files
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Service role policy - uses TO service_role instead of jwt check
CREATE POLICY "Service role has full access to media files"
  ON media_files
  FOR ALL
  TO service_role
  USING (true);

-- Note: By specifying TO authenticated/service_role, we eliminate the need
-- for redundant policies and improve performance

COMMENT ON POLICY "Users can view own media files" ON media_files IS 'Optimized RLS - auth.uid() wrapped in subquery';
COMMENT ON POLICY "Users can insert own media files" ON media_files IS 'Optimized RLS - auth.uid() wrapped in subquery';
COMMENT ON POLICY "Users can update own media files" ON media_files IS 'Optimized RLS - auth.uid() wrapped in subquery';
COMMENT ON POLICY "Users can delete own media files" ON media_files IS 'Optimized RLS - auth.uid() wrapped in subquery';
COMMENT ON POLICY "Service role has full access to media files" ON media_files IS 'Optimized RLS - Uses TO service_role instead of jwt check';
