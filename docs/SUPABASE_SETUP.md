# Supabase Setup Guide

This guide covers everything needed to configure Supabase for Queued Social — from a fresh project to a fully working scheduled posting system.

## Table of Contents

1. [Create a Supabase Project](#1-create-a-supabase-project)
2. [Run Database Migrations](#2-run-database-migrations)
3. [Configure Cron Jobs](#3-configure-cron-jobs)
4. [Set Up Storage Buckets](#4-set-up-storage-buckets)
5. [Deploy Edge Functions](#5-deploy-edge-functions)
6. [Set Edge Function Secrets](#6-set-edge-function-secrets)
7. [Configure Authentication](#7-configure-authentication)
8. [Verify Everything Works](#8-verify-everything-works)

---

## 1. Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project
2. Note your **Project URL** and **anon key** from **Project Settings > API**
3. Install the Supabase CLI:
   ```bash
   npm install supabase --save-dev
   # or globally
   brew install supabase/tap/supabase
   ```
4. Link your project:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

---

## 2. Run Database Migrations

The project uses 53 migrations that build the complete schema. Run them all with:

```bash
# Production — pushes migrations to your linked Supabase project
supabase db push

# Local development — resets local DB and runs all migrations + seed.sql
supabase db reset
```

### What the migrations create

| Group | Migrations | What it sets up |
|-------|-----------|-----------------|
| Core schema | 001–003 | `user_profiles`, `time_slots`, `scheduled_posts`, `platform_credentials`, `media_files` |
| Security | 002, 013–016, 040 | Row Level Security policies for all tables |
| Cron scheduler | 004, 028–048 | pg_cron job + `process_scheduled_posts()` function |
| Templates | 005–008 | Post templates with default seed data |
| Admin | 009, 043 | Service control panel, admin users table |
| Recurring posts | 010, 017–020, 035–039 | Recurring post schedules and execution history |
| Analytics | 021, 049 | Analytics columns + daily analytics cron |
| Subscriptions | 042, 043 | Stripe subscription tables + plan limits |
| Features | 044–047 | Nullable scheduled time, schema fixes, First Threads (hooks) table |
| Goals | 050 | Goals table + daily goal sync cron |
| Follower tracking | 051–052 | Threads follower/profile snapshots table |
| Cron config | 053 | **Rewrites all cron functions to use `app.settings`** (no hardcoded values) |

### Known migration quirks

- Two files share prefix `005` (`005_media_cleanup.sql` and `005_templates_table.sql`) — Supabase runs them alphabetically; both are idempotent
- Two files share prefix `027` for the same reason
- Migration 052 drops the `threads_follower_snapshots` table created in 051 and replaces it with the richer `threads_profile_snapshots` table — this is intentional

---

## 3. Configure Cron Jobs

**This step is required for scheduled posting to work.**

Migration 053 defines all cron trigger functions using `current_setting('app.*')`. You must set these three PostgreSQL app settings in your database.

### Option A: Using the Supabase SQL editor (recommended for production)

Go to **Supabase Dashboard > SQL Editor** and run:

```sql
ALTER DATABASE postgres SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY';
ALTER DATABASE postgres SET "app.scheduler_secret" = 'YOUR_SCHEDULER_SECRET';

-- Apply to current session immediately
SELECT set_config('app.supabase_url',      'https://YOUR_PROJECT_REF.supabase.co', false);
SELECT set_config('app.supabase_anon_key', 'YOUR_ANON_KEY',                        false);
SELECT set_config('app.scheduler_secret',  'YOUR_SCHEDULER_SECRET',                false);
```

Replace:
- `YOUR_PROJECT_REF` — your Supabase project ref (e.g. `abcdefghijklmnop`)
- `YOUR_ANON_KEY` — from **Project Settings > API > anon (public) key**
- `YOUR_SCHEDULER_SECRET` — any secure random string, e.g.:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### Option B: Local development with seed.sql

Edit `supabase/seed.sql` and replace the placeholder values:

```sql
ALTER DATABASE postgres SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY_HERE';
ALTER DATABASE postgres SET "app.scheduler_secret" = 'YOUR_SCHEDULER_SECRET_HERE';
```

Then `supabase db reset` will run this automatically.

### Verify cron jobs are active

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Expected output:

| jobname | schedule | active |
|---------|----------|--------|
| process-scheduled-posts | `* * * * *` | true |
| sync-threads-analytics | `0 12 * * *` | true |
| sync-goal-progress | `5 12 * * *` | true |
| sync-threads-followers | `10 12 * * *` | true |

---

## 4. Set Up Storage Buckets

Create two storage buckets in **Supabase Dashboard > Storage**:

### `media-files` bucket

1. Click **New bucket**
2. Name: `media-files`
3. Public: **Yes** (media must be publicly accessible for social platforms)
4. File size limit: `50MB`

Add these storage policies (in the **Policies** tab):

```sql
-- Allow authenticated users to upload their own files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read their media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'media-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access (needed for platform API uploads)
CREATE POLICY "Public read access for media"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'media-files');

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete their media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media-files' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 5. Deploy Edge Functions

Deploy all 14 edge functions at once:

```bash
supabase functions deploy --no-verify-jwt
```

Or deploy individually:

```bash
supabase functions deploy process-scheduled-posts --no-verify-jwt
supabase functions deploy publish-post --no-verify-jwt
supabase functions deploy exchange-oauth-token --no-verify-jwt
supabase functions deploy linkedin-oauth --no-verify-jwt
supabase functions deploy upload-media --no-verify-jwt
supabase functions deploy refresh-analytics --no-verify-jwt
supabase functions deploy sync-goal-progress --no-verify-jwt
supabase functions deploy sync-threads-followers --no-verify-jwt
supabase functions deploy cleanup-media --no-verify-jwt
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy create-portal-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy instagram-webhook --no-verify-jwt
supabase functions deploy threads-interactions --no-verify-jwt
```

See [docs/EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md) for what each function does.

---

## 6. Set Edge Function Secrets

Set all required secrets with one command:

```bash
supabase secrets set \
  SCHEDULER_SECRET=your-scheduler-secret \
  VITE_CREDENTIAL_ENCRYPTION_KEY=your-32-char-base64-key \
  LINKEDIN_CLIENT_ID=your-linkedin-client-id \
  LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret \
  LINKEDIN_REDIRECT_URI=https://yourdomain.com/auth/linkedin/callback \
  VITE_THREADS_CLIENT_SECRET=your-threads-client-secret \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Important:** `SCHEDULER_SECRET` must match the value you set for `app.scheduler_secret` in step 3.

### Verify secrets are set

```bash
supabase secrets list
```

### Required secrets by function

| Secret | Used by functions |
|--------|------------------|
| `SCHEDULER_SECRET` | `process-scheduled-posts`, `refresh-analytics`, `sync-goal-progress`, `sync-threads-followers` |
| `VITE_CREDENTIAL_ENCRYPTION_KEY` | `process-scheduled-posts`, `publish-post`, `refresh-analytics`, `sync-*` |
| `SUPABASE_URL` | All (auto-injected by Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | All (auto-injected by Supabase) |
| `LINKEDIN_CLIENT_ID` | `linkedin-oauth` |
| `LINKEDIN_CLIENT_SECRET` | `linkedin-oauth` |
| `LINKEDIN_REDIRECT_URI` | `linkedin-oauth` |
| `VITE_THREADS_CLIENT_SECRET` | `exchange-oauth-token` |
| `STRIPE_SECRET_KEY` | `create-checkout-session`, `create-portal-session` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` |

---

## 7. Configure Authentication

In **Supabase Dashboard > Authentication > URL Configuration**:

1. **Site URL**: `https://yourdomain.com`
2. **Redirect URLs** (add all that apply):
   ```
   http://localhost:3000/**
   https://yourdomain.com/**
   ```

For email auth, configure your email templates under **Authentication > Email Templates**.

---

## 8. Verify Everything Works

### Check migrations ran correctly

```sql
-- Should return 53 rows (one per migration)
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
ORDER BY executed_at;
```

### Check cron functions are using app settings

```sql
-- Should return your configured values (not empty)
SELECT
  current_setting('app.supabase_url', true)      AS supabase_url,
  current_setting('app.supabase_anon_key', true)  AS anon_key_set,
  current_setting('app.scheduler_secret', true)   AS scheduler_secret_set;
```

### Manually trigger the scheduler

```sql
SELECT process_scheduled_posts();
```

Then check the pg_net response log:

```sql
SELECT id, status_code, created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
```

### Test a scheduled post

1. Connect a social account in the app
2. Create a post scheduled 2 minutes in the future
3. Wait for the cron to fire (runs every minute)
4. Check the post status in the app — it should change to `published`

---

## Troubleshooting

### Cron jobs not running

```sql
-- Check cron job status
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Check if app settings are configured
SELECT current_setting('app.supabase_url', true);
```

If the URL is empty, re-run the app settings configuration from [step 3](#3-configure-cron-jobs).

### Edge function returning 401

The `x-scheduler-secret` header doesn't match. Verify:
1. `app.scheduler_secret` in the database matches
2. `SCHEDULER_SECRET` edge function secret matches
3. Both were set after the last `supabase db reset` / `supabase secrets set`

### Posts stuck in "scheduled" status

```sql
-- See what the cron last did
SELECT * FROM cron.job_run_details
WHERE jobname = 'process-scheduled-posts'
ORDER BY start_time DESC LIMIT 10;

-- Check posts that should have been published
SELECT id, status, scheduled_time, error_message
FROM scheduled_posts
WHERE status = 'scheduled' AND scheduled_time < NOW()
ORDER BY scheduled_time;
```

### OAuth redirect mismatch

Verify the redirect URI in your OAuth app settings matches exactly (protocol, domain, path, no trailing slash) with what's configured in your `.env` and `LINKEDIN_REDIRECT_URI` secret.

### Media upload failing

Check that:
1. The `media-files` storage bucket exists and is public
2. Storage policies are applied (see step 4)
3. `VITE_CREDENTIAL_ENCRYPTION_KEY` is set in both `.env.local` and as an edge function secret
