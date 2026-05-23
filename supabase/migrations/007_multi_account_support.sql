-- Multi-account support migration
-- Allows users to connect multiple accounts per platform

-- First, drop the existing unique constraint
ALTER TABLE platform_credentials DROP CONSTRAINT platform_credentials_user_id_platform_key;

-- Add new fields to support multiple accounts per platform
ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS platform_account_id VARCHAR(100);
ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS account_username VARCHAR(100);

-- Update existing records to have a platform_account_id based on their credentials
-- This is a one-time update for existing Threads accounts
UPDATE platform_credentials 
SET platform_account_id = COALESCE(
  credentials->>'userId', 
  credentials->'credentials'->>'userId',
  'legacy_account'
)
WHERE platform_account_id IS NULL AND platform = 'threads';

-- Set default account names for existing records
UPDATE platform_credentials 
SET account_name = COALESCE(
  credentials->>'username',
  credentials->'credentials'->>'username', 
  platform || '_account_1'
)
WHERE account_name IS NULL;

-- Set default account usernames for existing records
UPDATE platform_credentials 
SET account_username = COALESCE(
  credentials->>'username',
  credentials->'credentials'->>'username',
  'unknown'
)
WHERE account_username IS NULL;

-- Make platform_account_id required for future records
ALTER TABLE platform_credentials ALTER COLUMN platform_account_id SET NOT NULL;

-- Create new unique constraint that allows multiple accounts per platform
ALTER TABLE platform_credentials ADD CONSTRAINT platform_credentials_user_platform_account_unique 
UNIQUE(user_id, platform, platform_account_id);

-- Add index for better performance on multi-account queries
CREATE INDEX idx_platform_credentials_user_platform_active ON platform_credentials(user_id, platform, is_active);
CREATE INDEX idx_platform_credentials_account_lookup ON platform_credentials(user_id, platform, platform_account_id, is_active);

-- Add a function to get the display name for an account
CREATE OR REPLACE FUNCTION get_account_display_name(account_record platform_credentials)
RETURNS TEXT AS $$
BEGIN
  -- Return account_name if set, otherwise construct from username or platform_account_id
  RETURN COALESCE(
    account_record.account_name,
    account_record.account_username,
    account_record.platform || '_' || account_record.platform_account_id
  );
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the schema changes
COMMENT ON COLUMN platform_credentials.platform_account_id IS 'Unique identifier for the account on the platform (e.g., Instagram user ID, Threads user ID)';
COMMENT ON COLUMN platform_credentials.account_name IS 'User-friendly name for the account (can be customized by user)';
COMMENT ON COLUMN platform_credentials.account_username IS 'Platform username/handle for the account';
COMMENT ON CONSTRAINT platform_credentials_user_platform_account_unique ON platform_credentials IS 'Allows multiple accounts per platform per user';