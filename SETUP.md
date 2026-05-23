# Setup Guide

> For a quick overview, start with the [README](README.md).
> For full Supabase/database setup, see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).
> For edge function details, see [docs/EDGE_FUNCTIONS.md](docs/EDGE_FUNCTIONS.md).

## Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- A Supabase project at [app.supabase.com](https://app.supabase.com)

## 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/queued-social.git
cd queued-social
npm install
```

## 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

### Supabase

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Find these at **Supabase Dashboard > Project Settings > API**.

### Encryption Key

The app encrypts stored OAuth tokens with AES-GCM. Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```env
VITE_CREDENTIAL_ENCRYPTION_KEY=your-generated-key
```

> This same key must be set as an edge function secret:
> `supabase secrets set VITE_CREDENTIAL_ENCRYPTION_KEY=your-generated-key`

### Platform OAuth

**Threads (Meta)**
- Create an app at [developers.facebook.com](https://developers.facebook.com)
- Add Threads API product
- Set redirect URI: `http://localhost:3000/auth/threads/callback`

```env
VITE_THREADS_CLIENT_ID=your-threads-client-id
VITE_THREADS_CLIENT_SECRET=your-threads-client-secret
```

**LinkedIn**
- Create an app at [developer.linkedin.com](https://developer.linkedin.com)
- Add Sign In with LinkedIn (OpenID Connect)
- Set redirect URI: `http://localhost:3000/auth/linkedin/callback`
- Request scopes: `openid`, `profile`, `email`, `w_member_social`

```env
VITE_LINKEDIN_CLIENT_ID=your-linkedin-client-id
VITE_LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
```

### Admin

```env
VITE_ADMIN_EMAILS=admin@yourdomain.com
```

### Stripe (optional — only needed for subscription features)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 3. Supabase Setup

See **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)** for the complete guide. Summary:

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Run all 53 migrations
supabase db push

# Configure cron job credentials (in Supabase SQL editor):
# ALTER DATABASE postgres SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';
# ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY';
# ALTER DATABASE postgres SET "app.scheduler_secret" = 'YOUR_SCHEDULER_SECRET';

# Create storage bucket
# Go to Supabase Dashboard > Storage > New bucket
# Name: media-files, Public: Yes

# Deploy edge functions
supabase functions deploy --no-verify-jwt

# Set edge function secrets
supabase secrets set \
  SCHEDULER_SECRET=your-scheduler-secret \
  VITE_CREDENTIAL_ENCRYPTION_KEY=your-encryption-key \
  LINKEDIN_CLIENT_ID=your-linkedin-client-id \
  LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret \
  LINKEDIN_REDIRECT_URI=https://yourdomain.com/auth/linkedin/callback
```

## 4. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000`.

## 5. Production Deployment

```bash
# Build
npm run build:prod

# Deploy dist/ to your hosting provider (Vercel, Netlify, Cloudflare Pages, etc.)
```

Set all environment variables in your hosting provider's dashboard. Use the production values (live Stripe keys, production OAuth redirect URIs, etc.).

## Development Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run build:prod   # Production build with optimization
npm run type-check   # TypeScript check
npm run lint         # ESLint
npm run lint:fix     # ESLint auto-fix
npm run test         # Unit tests (Vitest)
npm run test:e2e     # End-to-end tests (Playwright)
npm run preview      # Preview production build locally
```

## Troubleshooting

**"Encryption key required" error**
- Ensure `VITE_CREDENTIAL_ENCRYPTION_KEY` is set in `.env.local` AND as an edge function secret

**OAuth redirect mismatch**
- The redirect URI in your OAuth app settings must match exactly (protocol, domain, no trailing slash)

**Posts not publishing**
- Check that cron jobs are active: `SELECT jobname, active FROM cron.job;`
- Verify app settings are configured (see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md#3-configure-cron-jobs))
- Check pg_net responses: `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;`

**Supabase connection issues**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match your project
- Check that RLS policies were applied by the migrations

For more troubleshooting, see [docs/SUPABASE_SETUP.md#troubleshooting](docs/SUPABASE_SETUP.md#troubleshooting).
