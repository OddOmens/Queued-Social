# Queued — Social Media Scheduler

An open-source social media scheduling application built with React, TypeScript, and Supabase. Schedule posts to Threads, LinkedIn, and Instagram with a visual calendar interface, recurring post support, analytics tracking, and goal management.

## Features

- **Multi-platform scheduling** — Threads, LinkedIn, Instagram
- **Visual calendar** — drag-and-drop post scheduling interface
- **Recurring posts** — set posts to repeat on custom schedules
- **Media library** — upload, organize, and reuse images/videos
- **Post analytics** — track views, likes, replies, engagement rates
- **Goal tracking** — set daily post and comment goals per platform
- **Follower growth** — daily Threads follower count snapshots
- **Post templates** — save and reuse content templates
- **Subscription tiers** — free and pro plans via Stripe
- **Admin panel** — manage users and toggle platform services

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: Supabase Auth
- **Payments**: Stripe
- **State**: Zustand + React Query
- **Testing**: Vitest, Playwright

## Quick Start

### 1. Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A [Supabase project](https://app.supabase.com)

### 2. Clone and install

```bash
git clone https://github.com/OddOmens/queued-social.git
cd queued-social
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in your values — see [Environment Variables](#environment-variables) below.

### 4. Set up Supabase

See **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)** for the full guide. The short version:

```bash
# Run all migrations
supabase db push

# Configure cron job credentials (required for scheduled posting)
# Edit supabase/seed.sql with your project values, then run it in the SQL editor

# Deploy edge functions
supabase functions deploy --no-verify-jwt

# Set edge function secrets
supabase secrets set SCHEDULER_SECRET=your-secret \
  VITE_CREDENTIAL_ENCRYPTION_KEY=your-32-char-key \
  LINKEDIN_CLIENT_ID=... \
  LINKEDIN_CLIENT_SECRET=... \
  LINKEDIN_REDIRECT_URI=https://yourdomain.com/auth/linkedin/callback
```

### 5. Start development

```bash
npm run dev
```

Visit `http://localhost:3000`

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

### Required

```env
# Supabase — https://app.supabase.com > Project Settings > API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Encryption key for stored OAuth credentials (32 chars, base64)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
VITE_CREDENTIAL_ENCRYPTION_KEY=your-32-char-base64-key
```

### Platform OAuth (connect whichever you need)

```env
# Threads / Meta — https://developers.facebook.com
VITE_THREADS_CLIENT_ID=your-threads-client-id
VITE_THREADS_CLIENT_SECRET=your-threads-client-secret

# LinkedIn — https://developer.linkedin.com
VITE_LINKEDIN_CLIENT_ID=your-linkedin-client-id
VITE_LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
```

### Optional

```env
# Stripe (required for subscription features)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin emails (comma-separated)
VITE_ADMIN_EMAILS=admin@yourdomain.com
```

## Supabase Setup

Full details in **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**.

### Database Migrations

53 migrations build the complete schema incrementally. Run them all with:

```bash
supabase db push       # production
supabase db reset      # local dev (also runs seed.sql)
```

### Edge Functions

14 serverless functions handle platform API calls and background jobs. See **[docs/EDGE_FUNCTIONS.md](docs/EDGE_FUNCTIONS.md)** for details.

```bash
# Deploy all
supabase functions deploy --no-verify-jwt

# Deploy one
supabase functions deploy process-scheduled-posts --no-verify-jwt
```

### Cron Jobs

Automatic scheduling relies on `pg_cron` + `pg_net` to call edge functions. After running migrations, configure the cron credentials in the SQL editor:

```sql
ALTER DATABASE postgres SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY';
ALTER DATABASE postgres SET "app.scheduler_secret" = 'YOUR_SCHEDULER_SECRET';
```

The `scheduler_secret` must also be deployed as an edge function secret:

```bash
supabase secrets set SCHEDULER_SECRET=your-secret-value
```

## OAuth App Setup

### Threads (Meta)

1. Go to [Meta Developer Console](https://developers.facebook.com) and create an app
2. Add the **Threads API** product
3. Set redirect URIs:
   - Dev: `http://localhost:3000/auth/threads/callback`
   - Prod: `https://yourdomain.com/auth/threads/callback`
4. Request scopes: `threads_basic`, `threads_content_publish`

### LinkedIn

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com) and create an app
2. Add **Sign In with LinkedIn using OpenID Connect**
3. Set redirect URIs:
   - Dev: `http://localhost:3000/auth/linkedin/callback`
   - Prod: `https://yourdomain.com/auth/linkedin/callback`
4. Request scopes: `openid`, `profile`, `email`, `w_member_social`

## Development

```bash
npm run dev          # start dev server
npm run build        # production build
npm run type-check   # TypeScript check
npm run lint         # lint
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
```

## Project Structure

```
queued-social/
├── src/
│   ├── components/     # React UI components
│   ├── pages/          # Route-level page components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API/Supabase service layer
│   ├── stores/         # Zustand state stores
│   └── config/         # App configuration
├── supabase/
│   ├── migrations/     # 53 SQL migrations (full schema history)
│   ├── functions/      # 14 Deno edge functions
│   ├── scripts/        # Maintenance SQL (check status, reset posts, etc.)
│   ├── volumes/        # Self-hosted Supabase config
│   ├── config.toml     # Supabase CLI project config
│   └── seed.sql        # Local dev seed (app settings)
├── docs/
│   ├── SUPABASE_SETUP.md     # Complete Supabase setup guide
│   ├── EDGE_FUNCTIONS.md     # Edge function reference
│   ├── STRIPE_SETUP.md       # Stripe/subscription setup
│   ├── INSTAGRAM_SETUP.md    # Instagram OAuth setup
│   ├── FACEBOOK_APP_SETUP.md # Facebook/Meta app setup
│   ├── MEDIA_LIBRARY.md      # Media library features
│   └── SUBSCRIPTIONS.md      # Subscription implementation details
├── scripts/            # Deploy and build scripts
└── e2e/                # Playwright end-to-end tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
