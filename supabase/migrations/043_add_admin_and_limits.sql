-- Add admin role support and enhance subscription limits
-- This migration adds admin role tracking and enforces feature limits

-- Update subscriptions table to support admin role
ALTER TABLE subscriptions 
    DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;

ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_plan_type_check 
    CHECK (plan_type IN ('free', 'pro', 'admin'));

-- Add admin emails table for easy management
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin users
CREATE POLICY "Admins can view admin users"
    ON admin_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM subscriptions 
            WHERE subscriptions.user_id = auth.uid() 
            AND subscriptions.plan_type = 'admin'
        )
    );

-- Create index
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE user_id = p_user_id
        AND plan_type = 'admin'
        AND status = 'active'
    ) INTO v_is_admin;
    
    RETURN v_is_admin;
END;
$$;

-- Function to check if user is pro or admin
CREATE OR REPLACE FUNCTION is_pro_or_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_access BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM subscriptions
        WHERE user_id = p_user_id
        AND plan_type IN ('pro', 'admin')
        AND status = 'active'
    ) INTO v_has_access;
    
    RETURN v_has_access;
END;
$$;

-- Update get_user_post_limit to handle admin
CREATE OR REPLACE FUNCTION get_user_post_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_type TEXT;
BEGIN
    -- Get the user's plan type
    SELECT plan_type INTO v_plan_type
    FROM subscriptions
    WHERE user_id = p_user_id
    AND status = 'active';
    
    -- If no subscription found, default to free
    IF v_plan_type IS NULL THEN
        v_plan_type := 'free';
    END IF;
    
    -- Return limit based on plan
    CASE v_plan_type
        WHEN 'admin' THEN
            RETURN -1; -- Unlimited for admin
        WHEN 'pro' THEN
            RETURN -1; -- Unlimited for pro
        ELSE
            RETURN 30; -- Free tier limit
    END CASE;
END;
$$;

-- Add trigger to prevent creating posts beyond limit
CREATE OR REPLACE FUNCTION check_post_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_can_create BOOLEAN;
BEGIN
    -- Check if user can create more posts
    v_can_create := can_create_post(NEW.user_id);
    
    IF NOT v_can_create THEN
        RAISE EXCEPTION 'Post limit reached. Upgrade to Pro for unlimited posts.';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_post_limit ON scheduled_posts;

-- Create trigger to enforce post limits
CREATE TRIGGER enforce_post_limit
    BEFORE INSERT ON scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION check_post_limit();

-- Function to auto-grant admin status based on email
CREATE OR REPLACE FUNCTION auto_grant_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_emails TEXT[];
BEGIN
    -- Get admin emails from environment (set via VITE_ADMIN_EMAILS)
    -- For now, we'll check the admin_users table
    IF EXISTS (
        SELECT 1 FROM admin_users WHERE email = NEW.email
    ) THEN
        -- Create or update subscription to admin
        INSERT INTO subscriptions (user_id, plan_type, status)
        VALUES (NEW.id, 'admin', 'active')
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            plan_type = 'admin',
            status = 'active',
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_grant_admin_trigger ON auth.users;

-- Create trigger to auto-grant admin on user creation
CREATE TRIGGER auto_grant_admin_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_grant_admin();

-- Grant permissions
GRANT SELECT ON admin_users TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_pro_or_admin(UUID) TO authenticated;

-- Add helpful comments
COMMENT ON TABLE admin_users IS 'Stores admin user emails for automatic admin role assignment';
COMMENT ON FUNCTION is_admin(UUID) IS 'Returns true if user has admin role';
COMMENT ON FUNCTION is_pro_or_admin(UUID) IS 'Returns true if user has pro or admin role';
COMMENT ON TRIGGER enforce_post_limit ON scheduled_posts IS 'Enforces post limits based on subscription plan';
