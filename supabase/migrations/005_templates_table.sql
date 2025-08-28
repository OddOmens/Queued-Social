-- Templates table for reusable post templates
-- This migration adds the templates table to store user-created post templates

CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  content JSONB NOT NULL, -- Same structure as scheduled_posts.content
  platform VARCHAR(50) NOT NULL,
  category VARCHAR(100) DEFAULT 'General' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_templates_user_id ON templates(user_id);
CREATE INDEX idx_templates_user_category ON templates(user_id, category);
CREATE INDEX idx_templates_user_platform ON templates(user_id, platform);
CREATE INDEX idx_templates_name ON templates(name);

-- Add updated_at trigger
CREATE TRIGGER update_templates_updated_at 
    BEFORE UPDATE ON templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE templates IS 'Stores reusable post templates created by users';
COMMENT ON COLUMN templates.content IS 'JSONB containing the post content structure (same format as scheduled_posts.content)';
COMMENT ON COLUMN templates.category IS 'User-defined category for organizing templates';