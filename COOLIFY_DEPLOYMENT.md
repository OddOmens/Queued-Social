# Coolify Deployment Guide

## 🚀 Environment Variables Setup

Since we've removed local `.env` files to avoid conflicts, **all environment variables must be set in Coolify**.

### Required Environment Variables

Set these in your Coolify project's Environment Variables section:

```bash
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://elbmmhzvvbwoumcjxjlf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYm1taHp2dmJ3b3VtY2p4amxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5ODM5NzQsImV4cCI6MjA3MTU1OTk3NH0.gm92J2Q-ZcyfF-xBuISPXzPl0Q3vSr2Qe8NCTtFSnB0

# App Configuration
VITE_APP_URL=https://schedule.oddomens.com

# Platform API Configuration
VITE_THREADS_CLIENT_ID=753393784148937
```

### Optional Environment Variables

```bash
# Supabase Service Role Key (for admin operations)
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Threads API Secret (for OAuth)
THREADS_CLIENT_SECRET=your-threads-client-secret

# Webhook Verification Token
THREADS_WEBHOOK_VERIFY_TOKEN=your-webhook-token
```

## 🔧 Deployment Steps

1. **Set Environment Variables in Coolify**
   - Go to your project settings
   - Navigate to Environment Variables
   - Add all required variables listed above

2. **Deploy**
   - Trigger a new deployment
   - The build process will use environment variables from Coolify
   - No local `.env` files will interfere

3. **Verify**
   - Check the application loads without errors
   - Test authentication functionality
   - Monitor browser console for any configuration issues

## 🐛 Troubleshooting

### If you see "Missing Supabase environment variables" error:
1. Verify all required environment variables are set in Coolify
2. Check that variable names match exactly (case-sensitive)
3. Ensure no placeholder values are being used
4. Trigger a fresh deployment

### If authentication fails:
1. Verify `VITE_SUPABASE_URL` points to your actual Supabase project
2. Verify `VITE_SUPABASE_ANON_KEY` is the correct anonymous key
3. Check Supabase project settings for allowed origins

### Environment Variable Validation:
The app now includes automatic validation that will:
- ✅ Check all required variables are present
- ✅ Verify no placeholder values are being used
- ✅ Show helpful error messages if configuration is invalid
- ✅ Log successful configuration in development mode

## 📁 File Structure Changes

We've removed these files to prevent conflicts with Coolify:
- ❌ `.env` (deleted)
- ❌ `.env.production` (deleted)
- ✅ `.env.local` (kept for local development)
- ✅ `.env.example` (kept as template)
- ✅ `.env.production.example` (kept as template)

## 🔒 Security Notes

- Environment variables are baked into the JavaScript bundle at build time
- Only `VITE_*` prefixed variables are exposed to the client
- Never put sensitive secrets in `VITE_*` variables
- Use Coolify's secure environment variable storage