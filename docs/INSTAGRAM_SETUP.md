# Instagram Direct Login Setup Guide

## What Is This?

Instagram Direct Login allows users to connect their Instagram Professional accounts **without needing a Facebook Page**. This uses Instagram's Platform API (launched July 2024).

## Benefits

✅ No Facebook Page required
✅ Direct Instagram authentication
✅ Automatic publishing still works
✅ Simpler user experience
✅ Works with Business and Creator accounts

## Setup Steps

### Step 1: Register for Instagram Platform API

1. **Go to Instagram Developer Platform**
   https://www.instagram.com/developer/

2. **Create a New App**
   - Click "Create App" or "Register Your App"
   - Choose app type: **Business**
   - Fill in app details:
     - App Name: "Queued Social Scheduler"
     - Company: Your company name
     - Contact Email: Your email

3. **Get Your Credentials**
   - After creating, you'll see:
     - **Instagram App ID** - Copy this
     - **Instagram App Secret** - Click "Show" and copy

### Step 2: Configure OAuth Settings

1. **Add Redirect URI**
   - In your app settings, find "OAuth Redirect URIs"
   - Add: `https://queued.oddomens.com/auth/instagram-direct/callback`
   - Save changes

2. **Configure Required Products**
   - Add "Instagram Basic Display"
   - Add "Instagram Content Publishing"

3. **Set Required Permissions**
   The following scopes are needed:
   - `instagram_business_basic` - Access to profile info
   - `instagram_business_content_publish` - Publishing posts
   - `instagram_business_manage_comments` - Managing comments (optional)

### Step 3: Set Environment Variables

#### In Cloudflare Pages

1. Go to: Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables

2. Add for **Production** environment:
   ```
   VITE_INSTAGRAM_CLIENT_ID = <your-instagram-app-id>
   INSTAGRAM_CLIENT_SECRET = <your-instagram-app-secret>
   ```

3. Add for **Preview** environment (same values)

4. Click **Save** and **redeploy**

#### In Supabase Edge Functions

1. Go to: Supabase Dashboard → Project Settings → Edge Functions → Manage Secrets

2. Add secrets:
   ```
   VITE_INSTAGRAM_CLIENT_ID = <your-instagram-app-id>
   INSTAGRAM_CLIENT_SECRET = <your-instagram-app-secret>
   ```

3. Redeploy edge function:
   ```bash
   supabase functions deploy exchange-oauth-token
   ```

### Step 4: Deploy Your Code

The implementation is already in your code. Just deploy:

```bash
# Commit changes
git add .
git commit -m "Add Instagram Direct Login support"
git push

# Deploy edge function (if using Supabase CLI)
supabase functions deploy exchange-oauth-token
```

Cloudflare Pages will auto-deploy when you push.

### Step 5: Test the Connection

1. Go to: https://queued.oddomens.com/settings

2. Scroll to Instagram section

3. You should see an **"Add Account"** button for Instagram

4. Click **"Add Account"**

5. You'll be redirected to Instagram's OAuth page

6. Log in with your Instagram Professional account

7. Grant permissions

8. You'll be redirected back to Settings

9. Your Instagram account should now be connected!

## Troubleshooting

### "VITE_INSTAGRAM_CLIENT_ID - Instagram Direct Login not configured"

**Problem**: Environment variable not set or not deployed

**Fix**:
1. Check Cloudflare Pages environment variables are set
2. Trigger a new deployment
3. Clear browser cache and reload

### "Missing Instagram Environment Variables on Server"

**Problem**: Supabase Edge Function doesn't have the secrets

**Fix**:
1. Add secrets to Supabase (see Step 3 above)
2. Redeploy edge function: `supabase functions deploy exchange-oauth-token`

### "Invalid client ID"

**Problem**: Wrong App ID or app doesn't exist

**Fix**:
1. Verify you copied the correct Instagram App ID (not Facebook App ID)
2. Check the app exists in Instagram Developer Portal
3. Make sure it's the App ID, not the App Secret

### "Redirect URI mismatch"

**Problem**: Redirect URI in app doesn't match code

**Fix**:
1. In Instagram Developer Portal, add exact URI: `https://queued.oddomens.com/auth/instagram-direct/callback`
2. No trailing slash
3. Must be HTTPS

### "This app is in Development Mode"

**Problem**: App needs to be live or you need to be added as tester

**Fix**:
- Option A: Add yourself as app tester in App Roles
- Option B: Submit app for review and switch to Live Mode

### Still getting connection errors

**Fix**:
1. Instagram account must be Professional (Business or Creator)
2. Convert your Instagram account to Professional in Instagram app settings
3. Make sure you registered for Instagram Platform API (not Facebook Graph API)

## About Instagram Direct Login

This implementation uses Instagram's Platform API (launched July 2024):
- ✅ No Facebook Page required
- ✅ Direct Instagram authentication
- ✅ Automatic publishing works
- ✅ Simpler setup for users
- ✅ Works with Business and Creator accounts

## Files Modified

The following files were updated to add Instagram Direct Login:

- [src/pages/SettingsPage.tsx](src/pages/SettingsPage.tsx) - Added Direct Login button and function
- [src/pages/InstagramDirectCallbackPage.tsx](src/pages/InstagramDirectCallbackPage.tsx) - NEW callback handler
- [src/App.tsx](src/App.tsx) - Added route for Direct Login callback
- [supabase/functions/exchange-oauth-token/index.ts](supabase/functions/exchange-oauth-token/index.ts) - Added Instagram Direct handling
- [.env.example](.env.example) - Added Instagram Direct env vars

## Next Steps

1. ✅ Register app on Instagram Developer Platform
2. ✅ Get App ID and Secret
3. ✅ Configure OAuth redirect URI
4. ✅ Set environment variables in Cloudflare Pages
5. ✅ Set secrets in Supabase Edge Functions
6. ✅ Deploy code and edge function
7. ✅ Test connection on Settings page
8. ✅ Verify publishing works with Direct Login account

## Resources

- [Instagram Platform API Documentation](https://www.instagram.com/developer/)
- [Instagram Direct Login Implementation Guide (GitHub)](https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc)
- [Instagram API 2026 Complete Guide](https://getlate.dev/blog/instagram-api)

---

**You now have both Instagram connection methods available!**
Users can choose based on their needs and preferences.
