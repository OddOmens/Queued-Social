# External Release & Security Guide

This guide outlines the steps required to securely release the Scheduler App to external users ("Beyond just me").

## 🚨 Critical Security Fixes

### 1. Fix Data Leak in Scheduled Posts
**Issue**: A vulnerability in the Row Level Security (RLS) policies allowed any authenticated user to view *any* scheduled post that was due for publishing, regardless of who owned it.
**Fix**: Apply migration `040_fix_scheduled_posts_rls.sql`.

```bash
supabase db push
# OR copy content of 040_fix_scheduled_posts_rls.sql to Supabase SQL Editor
```

### 2. Secure the Edge Function
**Issue**: The `process-scheduled-posts` Edge Function is currently public. Anyone who knows the URL can trigger the scheduler. While not a data leak (logs aside), it exposes your infrastructure.
**Fix**:
1.  Add a generic secret check to the Edge Function.
2.  Update the Cron Job to send this secret.

**Action**:
Modify `supabase/functions/process-scheduled-posts/index.ts` to check for a customized header (e.g., `x-scheduler-secret`).

## 🌍 Infrastructure Preparation

### 1. Environment Variables
Ensure these are set in your Supabase Project Settings (Edge Functions):

| Variable | Purpose |
|----------|---------|
| `VITE_CREDENTIAL_ENCRYPTION_KEY` | **CRITICAL**. Must be a 32-character string. Used to encrypt/decrypt user credentials. |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase, but verify. |
| `INSTAGRAM_ITEM_limit` | (Optional) Publishing limits. |

### 2. Admin Configuration
To restrict the `/admin` page:
1.  Set `VITE_ADMIN_EMAILS` in your frontend deployment (Vercel/Netlify/Coolify).
    *   Example: `VITE_ADMIN_EMAILS=admin@yourdomain.com,support@yourdomain.com`

## 📱 Platform Compliance (The Hard Part)

To let external users connect their *own* Instagram/Threads/LinkedIn accounts, you act as the "Platform Provider".

### Meta (Instagram & Threads)
*   **Current State**: Your App is likely in "Development Mode". Only you (and added "Testers") can connect accounts.
*   **To Go Public**: You must submit your App for **App Review** and **Business Verification** at [developers.facebook.com](https://developers.facebook.com).
    *   Required Permissions: `instagram_basic`, `instagram_content_publish`, `threads_basic`, `threads_content_publish`.
*   **Warning**: This process can take weeks and requires a privacy policy, terms of service, and a screencast of the app working.

### LinkedIn
*   Similar verification process for "Marketing Developer Platform" access if you want high limits. Basic API access might be enough for personal use but check quotas.

## 📝 Checklist for Launch

- [ ] Apply Migration `040` (Fix RLS).
- [ ] Set `VITE_CREDENTIAL_ENCRYPTION_KEY` in Production.
- [ ] Set `VITE_ADMIN_EMAILS` in Production Frontend.
- [ ] Disable "Enable Signup" in Supabase Auth IF you want to control access (Invite Only).
- [ ] OR Enable "Enable Signup" if you want public access.
- [ ] **Meta App Review**: Submit for "Live" access if unrelated users will use it.
