# Edge Functions Reference

All edge functions live in `supabase/functions/`. They run on Deno and are deployed to Supabase's edge network.

## Deployment

```bash
# Deploy all functions
supabase functions deploy --no-verify-jwt

# Deploy a single function
supabase functions deploy <function-name> --no-verify-jwt
```

> `--no-verify-jwt` is required because some functions are called by the cron scheduler (which uses a custom `x-scheduler-secret` header rather than a user JWT).

## Function Reference

### `process-scheduled-posts`

**Trigger:** pg_cron, every minute (`* * * * *`)
**Auth:** `x-scheduler-secret` header OR valid user JWT (for manual testing)

Scans `scheduled_posts` for rows where `status = 'scheduled'` and `scheduled_time <= NOW()`, then calls `publish-post` for each one. Handles deduplication, recurring post generation, and error state tracking.

**Required secrets:** `SCHEDULER_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`

---

### `publish-post`

**Trigger:** Called by `process-scheduled-posts`
**Auth:** Service role key

Does the actual work of publishing a post to the social platform. Handles:
- Decrypting stored OAuth credentials
- Uploading media to platform CDNs before posting
- Calling Threads, LinkedIn, and Instagram APIs
- Updating post status to `published` or `failed`
- Storing the platform post ID for analytics

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`

---

### `exchange-oauth-token`

**Trigger:** Called from the frontend during OAuth callback
**Auth:** User JWT

Exchanges an OAuth authorization code for access/refresh tokens and stores them encrypted in `platform_credentials`. Supports Threads and Instagram.

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`, `VITE_THREADS_CLIENT_SECRET`

---

### `linkedin-oauth`

**Trigger:** Called from the frontend during LinkedIn OAuth callback
**Auth:** User JWT

LinkedIn-specific OAuth token exchange. LinkedIn uses a slightly different OAuth flow than Meta, so it has its own function.

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`

---

### `upload-media`

**Trigger:** Called from the frontend on file upload
**Auth:** User JWT

Accepts a multipart/form-data upload, stores the file in the `media-files` Supabase Storage bucket, and creates a record in the `media_files` table with metadata (dimensions, mime type, size).

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

### `cleanup-media`

**Trigger:** Called manually or on a schedule (not automatically scheduled by default)
**Auth:** Service role key

Deletes media files from storage and the `media_files` table that are no longer referenced by any scheduled post. Safe to run on a schedule to keep storage costs down.

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

### `refresh-analytics`

**Trigger:** pg_cron, daily at 12:00 UTC (7:00 AM EST)
**Auth:** `x-scheduler-secret` header

Fetches current analytics (views, likes, replies, reposts) for all published Threads posts across all users and updates the `analytics` column in `scheduled_posts`.

**Required secrets:** `SCHEDULER_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`

---

### `sync-goal-progress`

**Trigger:** pg_cron, daily at 12:05 UTC
**Auth:** `x-scheduler-secret` header

Counts comments made by each user on Threads today and upserts the result into `goal_progress`. Post counts are calculated directly from `scheduled_posts` (no API call needed).

**Required secrets:** `SCHEDULER_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`

---

### `sync-threads-followers`

**Trigger:** pg_cron, daily at 12:10 UTC
**Auth:** `x-scheduler-secret` header

Calls the Threads profile API for each connected account and stores a daily snapshot in `threads_profile_snapshots`. Computes net follower change vs. the previous day.

**Required secrets:** `SCHEDULER_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`

---

### `threads-interactions`

**Trigger:** Called from the frontend
**Auth:** User JWT

Fetches recent replies and interactions for a user's Threads posts. Used to populate the engagement/community view in the app.

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_CREDENTIAL_ENCRYPTION_KEY`

---

### `create-checkout-session`

**Trigger:** Called from the frontend when user upgrades to Pro
**Auth:** User JWT

Creates a Stripe Checkout session for the Pro subscription. Returns a session URL that the frontend redirects to.

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`

---

### `create-portal-session`

**Trigger:** Called from the frontend from the billing settings page
**Auth:** User JWT

Creates a Stripe Customer Portal session so users can manage their subscription, update payment method, or cancel.

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`

---

### `stripe-webhook`

**Trigger:** POST from Stripe webhook (configure in Stripe Dashboard)
**Auth:** Stripe webhook signature (`stripe-signature` header)

Handles Stripe webhook events:
- `checkout.session.completed` — activates Pro subscription
- `customer.subscription.updated` — updates subscription status
- `customer.subscription.deleted` — downgrades to free

**Webhook URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

### `instagram-webhook`

**Trigger:** POST from Meta webhook (configure in Meta Developer Console)
**Auth:** Meta webhook verification token

Handles Instagram webhook events for post status updates and story completions.

**Webhook URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/instagram-webhook`

**Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Cron Schedule Summary

| Function | Schedule | UTC Time |
|----------|----------|----------|
| `process-scheduled-posts` | `* * * * *` | Every minute |
| `refresh-analytics` | `0 12 * * *` | 12:00 UTC (7 AM EST) |
| `sync-goal-progress` | `5 12 * * *` | 12:05 UTC |
| `sync-threads-followers` | `10 12 * * *` | 12:10 UTC |

Cron jobs are managed in the database by `pg_cron`. Check their status:

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Recent run history
SELECT jobname, status, start_time, end_time, return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

## Calling Functions Manually

### From the Supabase Dashboard

Go to **Edge Functions > [function name] > Test**.

### Via curl

```bash
# With scheduler secret (for cron-triggered functions)
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-posts \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "x-scheduler-secret: YOUR_SCHEDULER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source": "manual"}'

# With user JWT (for user-triggered functions)
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-analytics \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Trigger the scheduler from SQL

```sql
SELECT process_scheduled_posts();
```

## Local Development

To test edge functions locally:

```bash
supabase start          # start local Supabase stack
supabase functions serve  # serve all functions with hot reload
```

Then call them at `http://localhost:54321/functions/v1/<function-name>`.

Set local function environment variables in `supabase/.env` (do not commit this file):

```env
SCHEDULER_SECRET=local-dev-secret
VITE_CREDENTIAL_ENCRYPTION_KEY=your-key
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback
```
