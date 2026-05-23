# Supabase

Everything needed to set up and run the Queued Social database.

## Structure

```
supabase/
├── migrations/          # 53 SQL migrations — run in order to build the full schema
├── functions/           # 14 Deno edge functions
├── scripts/             # Useful SQL snippets for maintenance and setup
│   ├── configure-cron.sql    — set credentials for cron trigger functions
│   ├── check-status.sql      — verify cron jobs, settings, and post counts
│   ├── reset-stuck-posts.sql — unstick posts that failed to publish
│   └── manual-trigger.sql    — run the scheduler immediately
├── volumes/             # Self-hosted Supabase config (kong, db init, vector)
├── seed.sql             # Local dev seed — fill in your values before `supabase db reset`
└── config.toml          # Supabase CLI project config
```

## Quick Setup

See **[../docs/SUPABASE_SETUP.md](../docs/SUPABASE_SETUP.md)** for the full guide.

```bash
# 1. Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# 2. Run all 53 migrations
supabase db push

# 3. Configure cron jobs
#    Open scripts/configure-cron.sql in the Supabase SQL editor,
#    fill in your URL / anon key / scheduler secret, and run it.

# 4. Deploy all edge functions
supabase functions deploy --no-verify-jwt

# 5. Set edge function secrets
supabase secrets set \
  SCHEDULER_SECRET=your-secret \
  VITE_CREDENTIAL_ENCRYPTION_KEY=your-32-char-key \
  LINKEDIN_CLIENT_ID=... \
  LINKEDIN_CLIENT_SECRET=... \
  LINKEDIN_REDIRECT_URI=https://yourdomain.com/auth/linkedin/callback
```

## Migrations

53 migrations build the full schema incrementally. Migration **053** is the final and most important — it overwrites all cron trigger functions to use `current_setting('app.*')` rather than hardcoded credentials.

| Range | What it sets up |
|-------|----------------|
| 001–003 | Core tables, RLS, media storage |
| 004–009 | Cron setup, media cleanup, templates, admin panel |
| 010–020 | Recurring posts, multi-account support, timezone handling |
| 021–048 | Analytics, post fixes, subscription system |
| 049–052 | Daily crons (analytics, goals, follower tracking) |
| 053 | Clean cron configuration via `app.settings` |

## Edge Functions

See **[../docs/EDGE_FUNCTIONS.md](../docs/EDGE_FUNCTIONS.md)** for the full reference.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `process-scheduled-posts` | Every minute | Find and dispatch due posts |
| `publish-post` | Internal | Publish to Threads/LinkedIn/Instagram |
| `exchange-oauth-token` | User action | OAuth for Threads/Instagram |
| `linkedin-oauth` | User action | OAuth for LinkedIn |
| `upload-media` | User action | Upload to Supabase Storage |
| `cleanup-media` | Manual | Remove orphaned media |
| `refresh-analytics` | Daily 12:00 UTC | Sync post analytics |
| `sync-goal-progress` | Daily 12:05 UTC | Sync comment counts |
| `sync-threads-followers` | Daily 12:10 UTC | Sync follower snapshots |
| `threads-interactions` | User action | Fetch replies |
| `create-checkout-session` | User action | Stripe checkout |
| `create-portal-session` | User action | Stripe billing portal |
| `stripe-webhook` | Stripe | Handle subscription events |
| `instagram-webhook` | Meta | Handle Instagram events |
