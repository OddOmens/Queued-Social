-- Migration to add first_threads table for reusable Thread Starters (Hooks)
-- This provides a dedicated storage structure for high-value openers

CREATE TABLE IF NOT EXISTS first_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  hook_text TEXT NOT NULL,
  first_comment TEXT,
  media_urls TEXT[] DEFAULT '{}',
  category VARCHAR(100) DEFAULT 'General',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_first_threads_user_id ON first_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_first_threads_category ON first_threads(category);
CREATE INDEX IF NOT EXISTS idx_first_threads_is_favorite ON first_threads(is_favorite);

-- RLS Policies
ALTER TABLE first_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own first threads"
ON first_threads
FOR ALL
USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_first_threads_updated_at 
    BEFORE UPDATE ON first_threads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some high-quality "Reusable" starters for the user
-- We'll do this in a way that it can be called or just inserted for existing users? 
-- For now, let's just create the table. If they want seeds, I can add a separate migration or insert.
-- The user said "these should be custom and reusable", implying they might want me to add some.

INSERT INTO first_threads (user_id, name, hook_text, first_comment, category)
SELECT 
    id, 
    'The "How-to" Visual Hook', 
    'How I built a {{result}} in just {{timeframe}} (without {{pain_point}}).\n\nThis is the exact framework I used to scale...', 
    'Want the full PDF guide? Drop a "THREAD" below and I''ll DM it to you! 📩',
    'Educational'
FROM user_profiles
LIMIT 1; -- Just adding one as an example if a profile exists, otherwise it does nothing.

INSERT INTO first_threads (user_id, name, hook_text, first_comment, category)
SELECT 
    id, 
    'The Contrarian Opener', 
    'Unpopular opinion: {{controversial_topic}} is actually the best thing that happened to {{industry}}.\n\nMost people think A, but here is why it''s actually B...', 
    'What do you think? Am I crazy or is this the future? 👇',
    'Opinion'
FROM user_profiles
LIMIT 1;
