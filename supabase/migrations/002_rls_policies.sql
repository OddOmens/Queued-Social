-- Row Level Security (RLS) policies for Social Media Scheduler
-- These policies ensure users can only access their own data

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;

-- User Profiles RLS Policies
-- Users can only see and modify their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON user_profiles
    FOR DELETE USING (auth.uid() = id);

-- Time Slots RLS Policies
-- Users can only manage their own time slots
CREATE POLICY "Users can view own time slots" ON time_slots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time slots" ON time_slots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time slots" ON time_slots
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time slots" ON time_slots
    FOR DELETE USING (auth.uid() = user_id);

-- Scheduled Posts RLS Policies
-- Users can only manage their own scheduled posts
CREATE POLICY "Users can view own scheduled posts" ON scheduled_posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled posts" ON scheduled_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled posts" ON scheduled_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled posts" ON scheduled_posts
    FOR DELETE USING (auth.uid() = user_id);

-- Platform Credentials RLS Policies
-- Users can only manage their own platform credentials
CREATE POLICY "Users can view own platform credentials" ON platform_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own platform credentials" ON platform_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own platform credentials" ON platform_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own platform credentials" ON platform_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- Service role policies for system operations (like scheduled job execution)
-- These allow the service role to read scheduled posts for publishing
CREATE POLICY "Service role can read scheduled posts for publishing" ON scheduled_posts
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'service_role' OR 
        (status = 'scheduled' AND scheduled_time <= NOW())
    );

CREATE POLICY "Service role can update post status" ON scheduled_posts
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'service_role'
    ) WITH CHECK (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Allow service role to read platform credentials for publishing
CREATE POLICY "Service role can read platform credentials" ON platform_credentials
    FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');