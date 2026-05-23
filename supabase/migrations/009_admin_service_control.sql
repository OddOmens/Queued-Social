-- ============================================================================
-- ADMIN SERVICE CONTROL SYSTEM
-- ============================================================================

-- Create service_status table to track global service availability
CREATE TABLE IF NOT EXISTS service_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    disabled_reason TEXT,
    disabled_by UUID REFERENCES auth.users(id),
    disabled_at TIMESTAMPTZ,
    enabled_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default services
INSERT INTO service_status (service_name, is_enabled) VALUES
    ('instagram', true),
    ('threads', true),
    ('linkedin', true),
    ('scheduling', true),
    ('publishing', true),
    ('media_upload', true),
    ('templates', true),
    ('webhooks', true)
ON CONFLICT (service_name) DO NOTHING;

-- Create admin_actions table to log admin activities
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
    target_service TEXT,
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies - but keep them simple for now
-- Admin checking will be handled in the application layer
ALTER TABLE service_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read service status (needed for service guards)
CREATE POLICY "Authenticated users can read service status" ON service_status
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only allow service role to modify service status (admin functions will use service role)
CREATE POLICY "Service role can manage service status" ON service_status
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Only allow service role to manage admin actions
CREATE POLICY "Service role can manage admin actions" ON admin_actions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to update service status (admin checking handled in app layer)
CREATE OR REPLACE FUNCTION update_service_status(
    p_service_name TEXT,
    p_is_enabled BOOLEAN,
    p_disabled_reason TEXT DEFAULT NULL,
    p_admin_user_id UUID DEFAULT NULL
)
RETURNS service_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result service_status;
    admin_id UUID;
BEGIN
    -- Use provided admin_user_id or current auth user
    admin_id := COALESCE(p_admin_user_id, auth.uid());
    
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;
    
    -- Update service status
    UPDATE service_status 
    SET 
        is_enabled = p_is_enabled,
        disabled_reason = CASE WHEN p_is_enabled THEN NULL ELSE p_disabled_reason END,
        disabled_by = CASE WHEN p_is_enabled THEN NULL ELSE admin_id END,
        disabled_at = CASE WHEN p_is_enabled THEN NULL ELSE NOW() END,
        enabled_at = CASE WHEN p_is_enabled THEN NOW() ELSE enabled_at END,
        updated_at = NOW()
    WHERE service_name = p_service_name
    RETURNING * INTO result;
    
    -- Log admin action
    INSERT INTO admin_actions (admin_user_id, action_type, target_service, details)
    VALUES (
        admin_id,
        CASE WHEN p_is_enabled THEN 'enable_service' ELSE 'disable_service' END,
        p_service_name,
        jsonb_build_object(
            'reason', p_disabled_reason,
            'previous_status', NOT p_is_enabled
        )
    );
    
    RETURN result;
END;
$$;

-- Create function to check if service is enabled
CREATE OR REPLACE FUNCTION is_service_enabled(p_service_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    service_enabled BOOLEAN;
BEGIN
    SELECT is_enabled INTO service_enabled
    FROM service_status
    WHERE service_name = p_service_name;
    
    RETURN COALESCE(service_enabled, true); -- Default to enabled if not found
END;
$$;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_service_status_updated_at 
    BEFORE UPDATE ON service_status 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON service_status TO authenticated;
GRANT EXECUTE ON FUNCTION is_service_enabled(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_service_status(TEXT, BOOLEAN, TEXT) TO authenticated;