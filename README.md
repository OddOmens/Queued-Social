# Queued — Enterprise-Grade Social Media Scheduler

A self-hostable, modern social media scheduling application built with React, TypeScript, and Supabase. Seamlessly schedule posts to Threads, LinkedIn, and Instagram with an interactive visual calendar, custom recurring schedule engines, automated media compression, rich post analytics, and gamified goal tracking.

<p align="center">
  <img src="https://img.shields.io/github/license/OddOmens/queued-social?style=for-the-badge&color=blue" alt="License" />
  <img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js" alt="Node Version" />
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-Database%20%26%20Serverless-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Cloudflare-R2%20Storage-F38020?style=for-the-badge&logo=cloudflare" alt="Cloudflare R2" />
  <img src="https://img.shields.io/badge/Stripe-SaaS%20Billing-635BFF?style=for-the-badge&logo=stripe" alt="Stripe" />
</p>

---

## 🌟 Key Features

*   **📅 Interactive Visual Calendar**: Drag-and-drop posts in weekly or monthly calendar grids to plan schedules visually.
*   **🔄 Advanced Recurring Post Engine**: Schedule posts to repeat on custom frequencies (hourly, daily, weekly, or specific days of the week) for automated recurring social campaigns.
*   **📸 Decoupled Media Library with Cloudflare R2**: Upload images/videos with automatic client-side compression (max 1920px, 0.8 JPEG quality). Files are uploaded to Cloudflare R2 for cost-effective, high-speed delivery with automated fallback to Supabase Storage.
*   **📊 Rich Post & Growth Analytics**: Track views, likes, replies, and engagement rates. Store daily follower snapshots and visual performance metrics over time.
*   **🎯 Goal & Habit Tracking**: Set customized daily posting and commenting goals per platform, with visual habits trackers to maintain consistent social routines.
*   **🛡️ Secure Platform Integrations**: Native OAuth handlers for Threads (Meta), Instagram (Graph API & Direct Login), and LinkedIn using standard encryption to store user credentials safely in Supabase.
*   **💳 SaaS Billing Engine**: Pre-built integration with Stripe checkout sessions and billing portals supporting Free and Pro tiers with custom usage limits.
*   **⚙️ Enterprise Admin Panel**: Manage global system settings, toggle individual platform APIs, and oversee user activity from a secure dashboard.
*   **🖥️ Dual-Deployment Options**: Fully compatible with managed Supabase Cloud or 100% self-hosted using the included multi-container Docker Compose configuration.

---

## 🏗️ Architecture Overview

Queued uses a modern, decoupled architecture designed for high scalability, low storage costs, and maximum deployment flexibility.

```mermaid
graph TD
    %% Clients
    Client[React 18 Frontend] -- HTTPS / WS --> Kong[Kong API Gateway]

    %% Kong Routing
    Kong --> Auth[Supabase Gotrue Auth]
    Kong --> PostgREST[PostgREST Auto-API]
    Kong --> Storage[Supabase Storage API]
    Kong --> EdgeRuntime[Deno Edge Runtime]

    %% Database & Cron
    subgraph Self-Hosted Supabase / Docker Compose
        PostgREST --> DB[(PostgreSQL Database)]
        Auth --> DB
        DB -- pg_cron --> EdgeRuntime
        EdgeRuntime -- pg_net --> DB
    end

    %% Storage Decoupling
    Storage -- S3 Protocol (Primary) --> R2[Cloudflare R2 Bucket]
    Storage -- Local Fallback --> StorageFS[Local File Storage]

    %% External APIs
    EdgeRuntime -- OAuth & Webhooks --> Stripe[Stripe Payment API]
    EdgeRuntime -- Content Publishing --> Meta[Meta Developers Threads/Instagram]
    EdgeRuntime -- Content Publishing --> LinkedIn[LinkedIn Developer Portal]
```

### Decoupled Media Architecture: Supabase Storage + Cloudflare R2
While standard Supabase configurations rely on local storage or Supabase Cloud storage limits, Queued uses an S3-compatible adapter to bridge the Supabase Storage API directly with **Cloudflare R2**. 
- **Upload Flow**: The frontend initiates uploads using the standard Supabase SDK. The Supabase Storage container intercepts the request and relays the binary file directly to your R2 bucket.
- **Benefits**: Near-zero storage and egress fees, globally distributed CDN performance, and seamless media delivery to social networks requiring public URLs.
- **Failover**: If Cloudflare R2 is unreachable, the system automatically redirects storage actions to the legacy Supabase Storage local bucket.

---

## 🛠️ Complete Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 18, TypeScript, Vite | Fast, modern client-side compilation and dev loop |
| **Styling & UI** | Tailwind CSS, Shadcn/ui | Beautiful, adaptive components matching premium layouts |
| **State & Fetching** | Zustand, React Query (v5) | Client state and optimized asynchronous database synchronization |
| **Database** | PostgreSQL v15 (via Supabase) | Main relational datastore supporting 53 migrations |
| **Cron Scheduling** | PostgreSQL `pg_cron` & `pg_net` | Periodic micro-triggers calling edge functions every minute |
| **Serverless Logic** | Deno (Supabase Edge Functions) | Decoupled background workers (14 functions) |
| **Payments / SaaS** | Stripe API | Customer subscriptions, plans, and billing portals |
| **Media Storage** | Cloudflare R2 | S3-compliant high-performance media storage |
| **Testing Suite** | Vitest, Playwright | Reliable unit and end-to-end browser integration tests |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js 18+** installed on your machine
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm install supabase --save-dev` or `brew install supabase/tap/supabase`)
- A [Supabase account & project](https://app.supabase.com) (or a self-hosted server running Docker)

### 2. Clone the Repository & Install Dependencies
```bash
git clone https://github.com/OddOmens/queued-social.git
cd queued-social
npm install
```

### 3. Configure Local Environment Variables
Create a local configuration file from the template:
```bash
cp .env.example .env.local
```
Open `.env.local` and configure your API tokens (refer to the [Environment Variables](#-environment-variables) reference table below).

### 4. Initialize and Run Database Migrations
Link your local workspace to your Supabase cloud project:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```
Push the complete schema migrations to your database:
```bash
# Push database migrations to production
supabase db push

# OR: Setup local development database (resets and seeds local DB)
supabase db reset
```

### 5. Deploy Serverless Edge Functions
Deploy all 14 Deno Edge Functions to your Supabase project in a single command:
```bash
supabase functions deploy --no-verify-jwt
```

### 6. Start the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🐳 Self-Hosting with Docker & Coolify

Queued includes a comprehensive `docker-compose.supabase.yml` configuration to spin up a fully-functional, self-hosted Supabase environment (PostgreSQL, Kong, Gotrue Auth, Storage API, Edge Runtime, and Studio Dashboard) on your own server.

### Setup Instructions:
1. **Copy the Environment Template**:
   ```bash
   cp .env.supabase.example .env.supabase
   ```
2. **Generate Secure Cryptographic JWT Tokens**:
   Run the utility script to generate valid JWT keys for Gotrue, Kong, and your application environment:
   ```bash
   node scripts/generate-supabase-keys.js
   ```
   Paste the generated keys into your `.env.supabase` file under `JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY`.
3. **Initialize Configuration Directories**:
   ```bash
   mkdir -p supabase/volumes/kong
   ```
4. **Deploy the Services**:
   ```bash
   docker compose -f docker-compose.supabase.yml --env-file .env.supabase up -d
   ```
5. **Apply Database Schema**:
   Run database migrations against your local dockerized Postgres instance:
   ```bash
   supabase db push --db-url "postgresql://postgres:your-postgres-password@localhost:5432/postgres"
   ```

---

## 🌥️ Cloudflare R2 Storage Configuration

To utilize Cloudflare R2 as your high-speed, cost-effective media library storage provider:

1. **Create an R2 Bucket**:
   - Log into your [Cloudflare Dashboard](https://dash.cloudflare.com).
   - Navigate to **R2** → **Create bucket**. Name it (e.g., `queued-media`).
2. **Generate API Credentials**:
   - Click **Manage R2 API Tokens**.
   - Create an API token with **Read/Write** access permissions.
   - Copy the `Access Key ID` and `Secret Access Key`.
3. **Configure Environment Variables**:
   In your `.env.supabase` (for self-hosting) or your Supabase Edge Function Secrets (for cloud deployment), set the following keys:
   ```bash
   supabase secrets set \
     STORAGE_BACKEND=s3 \
     STORAGE_S3_BUCKET=queued-media \
     STORAGE_S3_ENDPOINT=https://your-cloudflare-account-id.r2.cloudflarestorage.com \
     STORAGE_S3_ACCESS_KEY=your-r2-access-key-id \
     STORAGE_S3_SECRET_KEY=your-r2-secret-access-key \
     STORAGE_S3_REGION=auto
   ```
4. **Define Supabase Storage Bucket Policies**:
   Follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md#4-set-up-storage-buckets) to create a public storage bucket named `media-files` with appropriate row-level security (RLS) policies.

---

## 🔒 Environment Variables Reference

### App Environment Settings (`.env.local` / `.env.production`)

| Key | Description | Required | Default |
|---|---|---|---|
| `VITE_SUPABASE_URL` | The public endpoint URL of your Supabase project | Yes | None |
| `VITE_SUPABASE_ANON_KEY` | The public anonymous API key for your Supabase project | Yes | None |
| `VITE_APP_URL` | The fully qualified public root URL of your client web application | Yes | `http://localhost:3000` |
| `VITE_ENABLE_BROWSER_SCHEDULER` | Set to `false` in production to rely purely on database pg_cron jobs | No | `false` |
| `VITE_THREADS_CLIENT_ID` | Meta/Threads application Client ID for Threads connection | Yes | None |
| `VITE_LINKEDIN_CLIENT_ID` | LinkedIn Developer portal client ID | Yes | None |
| `VITE_INSTAGRAM_CLIENT_ID` | Instagram Graph API / Direct login App ID | Yes | None |
| `INSTAGRAM_CLIENT_SECRET` | Instagram client secret key | Yes | None |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable API key | No | None |
| `VITE_STRIPE_PRO_PRICE_ID` | Stripe pricing ID for the Pro subscription plan | No | None |

### Supabase Edge Function Secrets

To set secrets for the serverless Deno runtime, execute `supabase secrets set KEY=VALUE`.

| Secret | Used By (Edge Functions) | Description |
|---|---|---|
| `SCHEDULER_SECRET` | `process-scheduled-posts`, `refresh-analytics`, `sync-*` | Secret token authorizing pg_cron to call Edge Functions |
| `VITE_CREDENTIAL_ENCRYPTION_KEY` | `publish-post`, `process-scheduled-posts`, OAuth | 32-character base64-encoded key encrypting platform access tokens in Postgres |
| `LINKEDIN_CLIENT_ID` | `linkedin-oauth` | Client ID for LinkedIn integration |
| `LINKEDIN_CLIENT_SECRET` | `linkedin-oauth` | Client Secret for LinkedIn integration |
| `LINKEDIN_REDIRECT_URI` | `linkedin-oauth` | Auth callback URI: `https://yourdomain.com/auth/linkedin/callback` |
| `VITE_THREADS_CLIENT_SECRET` | `exchange-oauth-token` | Client Secret for Meta Threads API integration |
| `STRIPE_SECRET_KEY` | `create-checkout-session`, `create-portal-session` | Stripe Secret API Key (begins with `sk_`) |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Stripe Webhook Signing Secret (begins with `whsec_`) |

---

## 📅 Platform Cron Scheduler Configuration

To automate queue processing without user browser interaction, Queued schedules background postgres crons. Run the following command in the **Supabase Dashboard SQL Editor** to establish the credentials:

```sql
ALTER DATABASE postgres SET "app.supabase_url" = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET "app.supabase_anon_key" = 'YOUR_ANON_KEY';
ALTER DATABASE postgres SET "app.scheduler_secret" = 'YOUR_SCHEDULER_SECRET';

-- Apply to current DB session
SELECT set_config('app.supabase_url',      'https://YOUR_PROJECT_REF.supabase.co', false);
SELECT set_config('app.supabase_anon_key', 'YOUR_ANON_KEY',                        false);
SELECT set_config('app.scheduler_secret',  'YOUR_SCHEDULER_SECRET',                false);
```

### Scheduled Cron Jobs Overview:

1.  **`process-scheduled-posts` (`* * * * *` - Every minute)**: Scans for posts marked `scheduled` whose time has passed, invokes `publish-post`, and attempts API publication.
2.  **`sync-threads-analytics` (`0 12 * * *` - Daily at 12:00 PM)**: Fetches and records up-to-date post stats from social APIs.
3.  **`sync-threads-followers` (`10 12 * * *` - Daily at 12:10 PM)**: Captures daily follower metric growth snapshots.
4.  **`sync-goal-progress` (`5 12 * * *` - Daily at 12:05 PM)**: Refreshes individual goal progress parameters.

---

## 🛠️ Development & Testing

```bash
# Start Vite development server locally
npm run dev

# Run TypeScript compilation checks
npm run type-check

# Run linter
npm run lint

# Compile production bundle
npm run build

# Run unit tests via Vitest
npm run test

# Run end-to-end tests via Playwright
npm run test:e2e
```

---

## 📂 Project Directory Structure

```text
queued-social/
├── src/
│   ├── components/       # Reusable React UI controls (visual calendars, cards)
│   ├── pages/            # View pages (Dashboard, Media Library, Analytics)
│   ├── hooks/            # Customized React query/mutation state triggers
│   ├── services/         # Client-side API layer communicating with Supabase
│   ├── stores/           # Zustand state managers for auth and themes
│   └── config/           # Site router and platform metadata constants
├── supabase/
│   ├── migrations/       # 53 SQL migrations maintaining relational schemas
│   ├── functions/        # 14 Deno Edge Functions handling social API calls
│   ├── scripts/          # Database management/troubleshooting SQL scripts
│   ├── volumes/          # Configuration files for Kong, Db init, and Vector
│   ├── config.toml       # Supabase project system configurations
│   └── seed.sql          # Seed values for development and local crons
├── docs/
│   ├── SUPABASE_SETUP.md      # In-depth guide to Supabase installation
│   ├── EDGE_FUNCTIONS.md      # Advanced breakdown of each serverless script
│   ├── STRIPE_SETUP.md        # Comprehensive payment setup guide
│   ├── MEDIA_LIBRARY.md       # R2 Media management specifications
│   ├── SUBSCRIPTIONS.md       # Detailed breakdown of plans and access limits
│   └── FACEBOOK_APP_SETUP.md  # Step-by-step Meta Developer setup
├── scripts/              # Infrastructure and deployment bash helper scripts
└── e2e/                  # Playwright web automation browser tests
```

---

## 📄 License & Maintenance

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Proudly built and maintained by **Odd Omens LLC** (<support@oddomens.com>). For bug reports, feature requests, or technical questions, please open an issue in the [GitHub issue tracker](https://github.com/OddOmens/queued-social/issues).
