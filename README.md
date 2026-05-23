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

## ⚡ Hosting the Frontend on Cloudflare Pages

Since the Queued frontend is a compiled Single Page Application (SPA) built with React and Vite, you do **not** need to host it inside a heavy Docker container or deploy it via Coolify. Instead, you can host the frontend globally on **Cloudflare Pages** for free. This gives you automated Git-based builds, SSL certificates, instant previews, and fast global asset delivery.

### Setup Instructions

#### 1. Push your Code to Git
Deploying to Cloudflare Pages requires your codebase to be hosted on **GitHub** or **GitLab**. Ensure your local changes are committed and pushed to your remote repository.

#### 2. Create a Cloudflare Pages Project
1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. In the left sidebar, navigate to **Workers & Pages** → **Overview**.
3. Click **Create Application** → **Pages** → **Connect to Git**.
4. Authorize Cloudflare to access your GitHub/GitLab account and select your `queued-social` repository.
5. Click **Begin setup**.

#### 3. Configure Build Settings
Under the **Build settings** section, configure the build parameters:
- **Framework preset**: Select `Vite` (if not pre-detected, select `None`).
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/`

#### 4. Inject Environment Variables (Critical)
Cloudflare compiles your React app on their build servers. For the frontend to communicate with your Supabase database and platforms, you must inject your `VITE_` configuration tokens at build time:
1. In the build setup page, expand **Environment variables (advanced)**.
2. Add your key-value pairs (refer to [App Environment Settings](#app-environment-settings-envlocal--envproduction) for values):
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
   - `VITE_APP_URL` = `https://your-custom-pages-subdomain.pages.dev` (or your custom domain)
   - `VITE_ENABLE_BROWSER_SCHEDULER` = `false`
   - `VITE_THREADS_CLIENT_ID` = `your-threads-client-id`
   - `VITE_LINKEDIN_CLIENT_ID` = `your-linkedin-client-id`
   - `VITE_INSTAGRAM_CLIENT_ID` = `your-instagram-app-id`
3. Click **Save and Deploy**.

#### 5. SPA Routing Configurations (Already Handled)
In Single Page Applications (SPAs), when a user refreshes their browser on a sub-route (e.g. `/dashboard` or `/auth/callback`), standard static hosts return a `404 Not Found` error. 

To resolve this, Queued includes a pre-configured `_redirects` rule in the `public/` directory:
```text
/*    /index.html   200
```
Vite automatically copies this rule into your production `dist/` directory during compilation. Cloudflare Pages detects this rule automatically and transparently rewrites all sub-path requests back to `index.html`, allowing React Router to successfully parse the path.

---

## 🌥️ Cloudflare R2 Setup Guide

To leverage Cloudflare R2 as a secure, fast, and cost-effective media library storage provider instead of standard Supabase local storage limits, you must configure your Cloudflare bucket, CORS policies, API tokens, and Supabase serverless secrets.

### 1. Enable R2 and Create a Bucket
1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click **R2** on the left-hand navigation sidebar.
3. Click **Create bucket**.
4. Name your bucket (e.g., `queued-social`) and click **Create bucket**. Leave the location as **Automatic**.

### 2. Configure Bucket CORS Policies (Critical for Direct Client Uploads)
Because Queued uploads files directly from the user's browser using secure presigned URLs generated by our Edge Functions, your R2 bucket must accept cross-origin requests.
1. Within your newly created bucket dashboard, click the **Settings** tab.
2. Scroll down to the **CORS Policy** section and click **Add CORS Policy**.
3. Paste the following JSON block into the policy editor:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["PUT", "GET", "DELETE", "OPTIONS"],
       "AllowedHeaders": ["content-type", "authorization", "x-client-info", "apikey"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   > [!TIP]
   > For production deployments, substitute `"*"` in `"AllowedOrigins"` with your actual web application URL (e.g., `["https://schedule.yourdomain.com"]`) to restrict upload access to your app's frontend.
4. Click **Save**.

### 3. Generate R2 API Keys
1. Go back to the main **R2** dashboard page.
2. In the right-hand sidebar under **Developer Platform**, click **Manage R2 API Tokens**.
3. Click **Create API Token**.
4. Set a name (e.g., `queued-social-sync`).
5. Under **Permissions**, select **Admin Read & Write**.
6. Under **TTL**, select a duration (recommend **Forever** or a custom long duration).
7. Click **Create Token**.
8. Copy the **Access Key ID**, **Secret Access Key**, and **Account ID** immediately. *Note: The Secret Access Key is only displayed once.*

### 4. Configure Serverless Secrets and Environment Variables

For cloud production environments using managed Supabase, set these secrets on your Deno Edge Functions using the Supabase CLI:

```bash
supabase secrets set \
  R2_ACCOUNT_ID=your-cloudflare-account-id \
  R2_ACCESS_KEY_ID=your-r2-access-key-id \
  R2_SECRET_ACCESS_KEY=your-r2-secret-access-key \
  R2_BUCKET_NAME=your-r2-bucket-name
```

Additionally, if you are configuring self-hosted dockerized Supabase (Docker Compose), make sure the matching values are specified in your `.env.supabase` file:

```env
STORAGE_BACKEND=s3
STORAGE_S3_BUCKET=your-r2-bucket-name
STORAGE_S3_ENDPOINT=https://your-cloudflare-account-id.r2.cloudflarestorage.com
STORAGE_S3_ACCESS_KEY=your-r2-access-key-id
STORAGE_S3_SECRET_KEY=your-r2-secret-access-key
STORAGE_S3_REGION=auto
```

### 5. Define Supabase Storage Bucket Policies (Legacy Fallback)
Follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md#4-set-up-storage-buckets) to create a public storage bucket named `media-files` with appropriate row-level security (RLS) policies. This ensures that if Cloudflare R2 experiences outages, the frontend seamlessly transitions to local Supabase Storage.

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
| `R2_ACCOUNT_ID` | `upload-media` | Cloudflare Account ID (copied from the R2 dashboard) |
| `R2_ACCESS_KEY_ID` | `upload-media` | Cloudflare R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | `upload-media` | Cloudflare R2 Secret Access Key |
| `R2_BUCKET_NAME` | `upload-media` | Cloudflare R2 Bucket Name (e.g., `queued-social`) |

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

## ⚠️ Open Source Disclaimer & No Warranty

> [!WARNING]
> **This software is provided "as is" without warranty of any kind, express or implied.**
> 
> Queued is a self-hostable open-source project. By deploying and using this codebase, you acknowledge and agree to the following terms:
> - **Self-Maintenance**: Any bugs, security vulnerabilities, Deno runtime issues, database migrations, or third-party API breaking changes (Meta, Threads, LinkedIn, Stripe) are **solely your responsibility** to diagnose, patch, and maintain.
> - **No Liability**: The maintainers (**Odd Omens LLC**) provide **zero guarantees of stability, platform compatibility, or support**. Under no circumstances shall the authors or copyright holders be liable for any claims, damages, data loss, social media account suspensions/shadowbans, financial charges, or other liabilities arising from the use of this software.
> - **Compliance**: You are fully responsible for adhering to the respective developer agreements and rate limits of Meta/Facebook, LinkedIn, and Stripe.

---

## 📄 License & Maintenance

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Proudly open-sourced by **Odd Omens LLC** (<support@oddomens.com>). Feel free to fork the repository, customize the scheduler to your needs, or submit contributions via pull requests!
