# Facebook Login Settings - Complete Configuration Guide

## Your Screenshot: Facebook Login Settings

Based on your screenshot, here's exactly what to configure:

---

## Section 1: Client OAuth Settings

### Settings to Enable (Toggle to "Yes"):

1. ✅ **Client OAuth login** → **Yes**
   - Required for OAuth flow

2. ✅ **Web OAuth login** → **Yes**
   - Required for web apps

3. ✅ **Enforce HTTPS** → **Yes**
   - Already recommended (keep it)

4. ✅ **Use Strict Mode for redirect URIs** → **Yes**
   - Already recommended (keep it)

### Settings to Keep Disabled (Toggle to "No"):

5. ⬜ **Force Web OAuth reauthentication** → **No**
   - Not needed

6. ⬜ **Embedded browser OAuth login** → **No**
   - Not needed for web app

7. ⬜ **Login from devices** → **No**
   - Not needed

8. ⬜ **Login with the JavaScript SDK** → **No**
   - You're using server-side OAuth, not JS SDK

---

## Section 2: Valid OAuth Redirect URIs ⚠️ CRITICAL

**This is the most important field!**

In the text box under "Valid OAuth Redirect URIs", paste:

```
https://queued.oddomens.com/auth/instagram/callback
```

**Important Notes:**
- Must be **exact** - no typos
- Must be **HTTPS** (not HTTP)
- Must **match exactly** what's in your code ([SettingsPage.tsx:108](src/pages/SettingsPage.tsx#L108))
- No trailing slash
- One URL per line (if you have multiple)

**Why this matters:**
Facebook will **only** redirect to URLs listed here. If it's missing or wrong, you'll get errors.

---

## Section 3: Deauthorize Callback URL

When users disconnect your app, Facebook pings this URL.

**Enter**:
```
https://queued.oddomens.com
```

(Just your main domain is fine)

---

## Section 4: Data Deletion Request URL

Required for GDPR compliance. When users request data deletion, Facebook pings this URL.

**Enter**:
```
https://queued.oddomens.com
```

(You can implement a proper endpoint later, but this is required to save the form)

---

## Section 5: Allowed Domains for JavaScript SDK

**Leave empty** - you don't need this since you're using server-side OAuth flow.

---

## After Saving

Click **Save Changes** at the bottom.

---

## Now Configure Instagram Graph API Settings

After saving Facebook Login settings, you need to configure Instagram Graph API settings too:

### Go to: Instagram Graph API → Basic Display

Configure the same settings there:

1. **Valid OAuth Redirect URIs**:
   ```
   https://queued.oddomens.com/auth/instagram/callback
   ```

2. **Deauthorize Callback URL**:
   ```
   https://queued.oddomens.com
   ```

3. **Data Deletion Request URL**:
   ```
   https://queued.oddomens.com
   ```

Click **Save Changes**

---

## Summary Checklist

- [ ] **Facebook Login → Settings**:
  - [ ] Client OAuth login: **Yes**
  - [ ] Web OAuth login: **Yes**
  - [ ] Enforce HTTPS: **Yes**
  - [ ] Use Strict Mode: **Yes**
  - [ ] Valid OAuth Redirect URIs: `https://queued.oddomens.com/auth/instagram/callback`
  - [ ] Deauthorize Callback URL: `https://queued.oddomens.com`
  - [ ] Data Deletion Request URL: `https://queued.oddomens.com`
  - [ ] Click **Save Changes**

- [ ] **Instagram Graph API → Basic Display**:
  - [ ] Valid OAuth Redirect URIs: `https://queued.oddomens.com/auth/instagram/callback`
  - [ ] Deauthorize Callback URL: `https://queued.oddomens.com`
  - [ ] Data Deletion Request URL: `https://queued.oddomens.com`
  - [ ] Click **Save Changes**

- [ ] **Get your credentials** (Settings → Basic):
  - [ ] Copy **App ID**
  - [ ] Copy **App Secret**

- [ ] **Update environment variables**:
  - [ ] Cloudflare Pages: `VITE_INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET`
  - [ ] Supabase Edge Functions: Same variables

- [ ] **Redeploy**:
  - [ ] Cloudflare Pages deployment
  - [ ] Supabase Edge Functions

- [ ] **Test**:
  - [ ] Go to Settings page on your site
  - [ ] Check Environment Configuration card shows App ID
  - [ ] Click "Connect Instagram"
  - [ ] Should redirect to Facebook (not error)

---

## What Each URL Does

### Valid OAuth Redirect URIs
**Facebook redirects here after user authorizes your app**

User journey:
1. User clicks "Connect Instagram" on your site
2. Redirects to Facebook OAuth
3. User grants permissions
4. Facebook redirects back to: `https://queued.oddomens.com/auth/instagram/callback?code=ABC123`
5. Your app handles the callback

### Deauthorize Callback URL
**Facebook pings this when user disconnects your app**

Optional - you can implement later to clean up user data when they disconnect.

### Data Deletion Request URL
**Facebook pings this when user requests data deletion**

Required by Meta for compliance. You should implement an endpoint to handle deletion requests, but for now just entering your domain is enough to save the form.

---

## Common Mistakes to Avoid

❌ **Wrong redirect URI**: `https://queued.oddomens.com/callback` (missing `/auth/instagram/`)
❌ **HTTP instead of HTTPS**: `http://queued.oddomens.com/...`
❌ **Trailing slash**: `https://queued.oddomens.com/auth/instagram/callback/`
❌ **Not saving after changes**: Always click "Save Changes" at bottom
❌ **Only configuring Facebook Login**: Must also configure Instagram Graph API settings

✅ **Correct**: `https://queued.oddomens.com/auth/instagram/callback`

---

## Next: Get Your App Credentials

After saving all settings:

1. Go to **Settings → Basic** (left sidebar)
2. You'll see:
   - **App ID**: `123456789012345` (copy this)
   - **App Secret**: Click "Show" and copy it

3. These go in your environment variables:
   ```
   VITE_INSTAGRAM_CLIENT_ID=123456789012345
   INSTAGRAM_CLIENT_SECRET=abc123def456...
   ```

---

## Ready to Test

After configuring everything and deploying:

1. Go to https://queued.oddomens.com/settings
2. Scroll to "Environment Configuration" card
3. Verify Instagram Client ID shows (in green)
4. Click "Connect Instagram"
5. Should redirect to Facebook OAuth page
6. Grant permissions
7. Should redirect back to your site with success message

If you get errors, check the troubleshooting guides:
- [INSTAGRAM_CONNECTION_FIX.md](INSTAGRAM_CONNECTION_FIX.md)
- [INSTAGRAM_APP_ID_ERROR_SOLUTION.md](INSTAGRAM_APP_ID_ERROR_SOLUTION.md)
