-- Fix Security Vulnerability in RLS Policy
-- The previous policy allowed ANY authenticated user to view scheduled posts from ANY user
-- if the post was due for publishing. This was a security risk.

-- Drop the insecure policy
DROP POLICY IF EXISTS "Service role can read scheduled posts for publishing" ON scheduled_posts;

-- Recreate the policy restricting it ONLY to the service role
-- Note: The service_role key typically bypasses RLS anyway, but this policy explicitly allows it
-- while preventing regular users from seeing other users' due posts.
CREATE POLICY "Service role can read scheduled posts for publishing" ON scheduled_posts
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'service_role'
    );
