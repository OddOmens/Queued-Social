-- Row Level Security policies for templates table
-- This migration adds RLS policies to ensure users can only access their own templates

-- Enable RLS on the templates table
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see only their own templates
CREATE POLICY "Users can view own templates" ON templates
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own templates
CREATE POLICY "Users can insert own templates" ON templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own templates
CREATE POLICY "Users can update own templates" ON templates
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON templates
    FOR DELETE USING (auth.uid() = user_id);