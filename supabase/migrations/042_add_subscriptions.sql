-- Add subscription management tables
-- This migration adds support for Stripe subscriptions with a free tier (30 posts) and pro tier (unlimited)

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'pro')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
    ON subscriptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to get user's post limit based on subscription
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
        WHEN 'pro' THEN
            RETURN -1; -- -1 means unlimited
        ELSE
            RETURN 30; -- Free tier limit
    END CASE;
END;
$$;

-- Function to check if user can create more posts
CREATE OR REPLACE FUNCTION can_create_post(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_limit INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Get user's post limit
    v_limit := get_user_post_limit(p_user_id);
    
    -- If unlimited, always return true
    IF v_limit = -1 THEN
        RETURN TRUE;
    END IF;
    
    -- Count user's scheduled posts
    SELECT COUNT(*) INTO v_current_count
    FROM scheduled_posts
    WHERE user_id = p_user_id
    AND status IN ('pending', 'processing');
    
    -- Check if under limit
    RETURN v_current_count < v_limit;
END;
$$;

-- Create default free subscription for existing users
INSERT INTO subscriptions (user_id, plan_type, status)
SELECT id, 'free', 'active'
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM subscriptions WHERE subscriptions.user_id = auth.users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Grant permissions
GRANT SELECT ON subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_post_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_create_post(UUID) TO authenticated;

COMMENT ON TABLE subscriptions IS 'Stores user subscription information for Stripe billing';
COMMENT ON FUNCTION get_user_post_limit(UUID) IS 'Returns the post limit for a user based on their subscription plan';
COMMENT ON FUNCTION can_create_post(UUID) IS 'Checks if a user can create more scheduled posts based on their plan limit';
