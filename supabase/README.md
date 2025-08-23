# Database Setup and Migrations

This directory contains the database schema and migration files for the Social Media Scheduler application.

## Overview

The application uses Supabase (PostgreSQL) as the backend database with the following core tables:

- `user_profiles` - Extended user profile information
- `time_slots` - User-defined posting time slots
- `scheduled_posts` - Scheduled social media posts
- `platform_credentials` - Encrypted OAuth tokens and API credentials

## Migration Files

### 001_initial_schema.sql
Creates the core database schema including:
- All main tables with proper constraints
- Performance indexes
- Updated_at triggers for automatic timestamp management
- UUID generation setup

### 002_rls_policies.sql
Sets up Row Level Security (RLS) policies to ensure:
- Users can only access their own data
- Service role can perform system operations
- Proper isolation between user accounts

## Running Migrations

### Option 1: Using the Migration Script (Recommended)

1. Ensure your environment variables are set in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run migrations:
   ```bash
   node scripts/migrate.js run
   ```

### Option 2: Manual Execution via Supabase Dashboard

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of each migration file in order:
   - First: `001_initial_schema.sql`
   - Second: `002_rls_policies.sql`
4. Execute each migration

### Option 3: Using Supabase CLI

If you have the Supabase CLI installed:

1. Initialize Supabase in your project:
   ```bash
   supabase init
   ```

2. Link to your remote project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Copy migration files to the Supabase migrations directory:
   ```bash
   cp supabase/migrations/* supabase/migrations/
   ```

4. Push migrations:
   ```bash
   supabase db push
   ```

## Database Schema Details

### Tables

#### user_profiles
- Extends Supabase auth.users with additional profile data
- Stores user timezone preferences
- Automatically managed created_at/updated_at timestamps

#### time_slots
- Defines when users want to post content
- Supports multiple slots per day of week (0=Sunday, 6=Saturday)
- Timezone-aware time storage
- Can be activated/deactivated without deletion

#### scheduled_posts
- Stores all scheduled social media posts
- JSONB content field for flexible post data
- Status tracking (scheduled, published, failed, cancelled)
- Error message storage for failed posts
- Platform-agnostic design

#### platform_credentials
- Securely stores OAuth tokens and API credentials
- JSONB credentials field for flexible credential storage
- Expiration tracking for token refresh
- Unique constraint per user/platform combination

### Indexes

Performance indexes are created for:
- User-based queries (most common access pattern)
- Time-based queries for scheduling
- Status-based queries for job processing
- Active credential lookups

### Security

Row Level Security (RLS) ensures:
- Users can only access their own data
- Service role can perform system operations
- No cross-user data leakage
- Secure credential storage

## Environment Variables Required

```bash
# Public Supabase URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Public anonymous key (for client-side operations)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Service role key (for server-side operations and migrations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Troubleshooting

### Migration Fails
- Check that your service role key has the correct permissions
- Verify your Supabase URL is correct
- Ensure you're connected to the internet
- Check the Supabase dashboard for any existing conflicting tables

### RLS Policies Not Working
- Verify that RLS is enabled on all tables
- Check that your JWT token contains the correct user ID
- Test policies using the Supabase dashboard SQL editor

### Performance Issues
- Check that indexes are properly created
- Monitor query performance in the Supabase dashboard
- Consider adding additional indexes for your specific query patterns

## Development Tips

1. **Local Development**: Use Supabase local development for testing migrations
2. **Backup**: Always backup your database before running migrations in production
3. **Testing**: Test migrations on a staging environment first
4. **Rollback**: Keep rollback scripts for complex migrations
5. **Monitoring**: Monitor database performance after applying new indexes