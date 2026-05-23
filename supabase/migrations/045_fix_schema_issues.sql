-- Add 'draft' AND 'publishing' to the allowed statuses for scheduled_posts
ALTER TABLE scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_status_check;

ALTER TABLE scheduled_posts ADD CONSTRAINT scheduled_posts_status_check 
CHECK (status IN ('scheduled', 'published', 'failed', 'cancelled', 'draft', 'publishing'));

-- Rename 'templates' table to 'post_templates' to match application code expectation
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'templates') THEN
        ALTER TABLE templates RENAME TO post_templates;
    END IF;
END $$;

-- If 'post_templates' does not exist (and 'templates' didn't either), create it
CREATE TABLE IF NOT EXISTS post_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  platform VARCHAR(50) NOT NULL,
  category VARCHAR(100) DEFAULT 'General' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Re-create indexes to ensure they exist on the correct table name
DROP INDEX IF EXISTS idx_templates_user_id;
DROP INDEX IF EXISTS idx_templates_user_category;
DROP INDEX IF EXISTS idx_templates_user_platform;
DROP INDEX IF EXISTS idx_templates_name;

CREATE INDEX IF NOT EXISTS idx_post_templates_user_id ON post_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_post_templates_user_category ON post_templates(user_id, category);
CREATE INDEX IF NOT EXISTS idx_post_templates_user_platform ON post_templates(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_post_templates_name ON post_templates(name);

-- Ensure RLS is enabled on post_templates
ALTER TABLE post_templates ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own templates
DROP POLICY IF EXISTS "Users can manage their own templates" ON post_templates;

CREATE POLICY "Users can manage their own templates"
ON post_templates
FOR ALL
USING (auth.uid() = user_id);

-- Add updated_at trigger if not exists
DROP TRIGGER IF EXISTS update_post_templates_updated_at ON post_templates;
CREATE TRIGGER update_post_templates_updated_at 
    BEFORE UPDATE ON post_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
