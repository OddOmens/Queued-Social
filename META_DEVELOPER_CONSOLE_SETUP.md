# Meta Developer Console Setup for Threads API

## 🎯 Quick Fix Checklist

The most common cause of "400 Bad Request" errors is incorrect Meta Developer Console configuration. Follow this checklist:

### 1. **App Status** (Most Important!)
- [ ] Go to [Meta Developer Console](https://developers.facebook.com)
- [ ] Select your app (ID: 753393784148937)
- [ ] Navigate to **App Review** → **Permissions and Features**
- [ ] Ensure app is in **"Live"** mode, NOT "Development" mode
- [ ] If in Development mode, switch to Live mode

> **⚠️ Critical:** In Development mode, only app developers can use OAuth. This is the #1 cause of 400 errors.

### 2. **Threads API Configuration**
- [ ] Go to **Products** → **Threads API**
- [ ] Click **Settings** or **Configure**
- [ ] Verify these exact settings:

#### **Redirect URIs:**
```
https://schedule.oddomens.com/auth/threads/callback
```
> Must match EXACTLY (case-sensitive, no trailing slash)

#### **App Domains:**
```
schedule.oddomens.com
```

### 3. **Basic App Settings**
- [ ] Go to **Settings** → **Basic**
- [ ] Verify **App ID**: `753393784148937`
- [ ] Verify **App Secret** is set (don't share this!)
- [ ] Add to **App Domains**: `schedule.oddomens.com`

### 4. **Permissions & Scopes**
- [ ] Ensure these scopes are approved:
  - `threads_basic` - Basic profile access
  - `threads_content_publish` - Publish content

### 5. **App Review Status**
- [ ] Check if app requires review for production use
- [ ] Submit for review if needed
- [ ] Ensure all required information is provided

## 🔧 Step-by-Step Setup

### Step 1: Access Meta Developer Console
1. Go to https://developers.facebook.com
2. Log in with your Meta account
3. Select your app or create a new one

### Step 2: Add Threads API Product
1. Click **"Add Product"** in the left sidebar
2. Find **"Threads API"** and click **"Set Up"**
3. Follow the setup wizard

### Step 3: Configure Threads API Settings
1. In the left sidebar, click **Products** → **Threads API**
2. Click **Settings** or **Configure**
3. Add these settings:

**Redirect URIs:**
```
https://schedule.oddomens.com/auth/threads/callback
```

**Webhook URL** (optional for now):
```
https://schedule.oddomens.com/api/webhooks/threads
```

### Step 4: Configure App Basic Settings
1. Go to **Settings** → **Basic**
2. Fill in required fields:
   - **Display Name**: Social Media Scheduler
   - **App Domains**: `schedule.oddomens.com`
   - **Privacy Policy URL**: `https://schedule.oddomens.com/privacy`
   - **Terms of Service URL**: `https://schedule.oddomens.com/terms`

### Step 5: Switch to Live Mode
1. Go to **App Review** → **Permissions and Features**
2. Find the toggle for **Live Mode**
3. Switch from "Development" to "Live"
4. Confirm the change

## 🚨 Common Issues & Solutions

### Issue 1: "Invalid redirect_uri"
**Cause:** Redirect URI doesn't match exactly
**Solution:** 
- Check for typos, extra spaces, or wrong protocol (http vs https)
- Ensure no trailing slash
- Must be exactly: `https://schedule.oddomens.com/auth/threads/callback`

### Issue 2: "Invalid client_id"
**Cause:** Wrong Client ID or app not found
**Solution:**
- Verify Client ID is exactly: `753393784148937`
- Ensure app exists and you have access

### Issue 3: "App not approved for production use"
**Cause:** App is in Development mode or needs review
**Solution:**
- Switch to Live mode in App Review section
- Submit for app review if required

### Issue 4: "Invalid scope"
**Cause:** Requesting unauthorized scopes
**Solution:**
- Only request: `threads_basic,threads_content_publish`
- Ensure scopes are approved in your app

### Issue 5: "Domain not allowed"
**Cause:** Domain not whitelisted
**Solution:**
- Add `schedule.oddomens.com` to App Domains
- Verify domain ownership if required

## 🧪 Testing Your Configuration

### Method 1: Use the Debug Tool
1. Open `debug-threads-oauth.html` in your browser
2. Check all configuration values
3. Test the OAuth URL generation
4. Click "Test OAuth Flow" to try the actual flow

### Method 2: Manual URL Test
Copy and paste this URL in your browser:
```
https://graph.threads.net/oauth/authorize?client_id=753393784148937&redirect_uri=https%3A%2F%2Fschedule.oddomens.com%2Fauth%2Fthreads%2Fcallback&scope=threads_basic%2Cthreads_content_publish&response_type=code&state=test123
```

**Expected Results:**
- ✅ **Success:** Threads login page appears
- ❌ **400 Error:** Check Meta Developer Console settings above

### Method 3: Check Browser Console
1. Open your app at `https://schedule.oddomens.com`
2. Go to Settings → Connected Accounts
3. Click "Connect" for Threads
4. Check browser console for detailed logs

## 📋 Pre-Launch Checklist

Before going live with Threads integration:

- [ ] App is in Live mode (not Development)
- [ ] All redirect URIs are configured correctly
- [ ] App domains are whitelisted
- [ ] Required scopes are approved
- [ ] App review is completed (if required)
- [ ] Privacy Policy and Terms of Service are published
- [ ] OAuth flow tested successfully
- [ ] Token exchange tested successfully
- [ ] Error handling implemented
- [ ] Rate limiting considered

## 🆘 Still Having Issues?

If you're still getting 400 errors after checking everything above:

1. **Double-check App Mode:** Ensure app is in "Live" mode, not "Development"
2. **Wait for Propagation:** Changes can take 5-10 minutes to propagate
3. **Clear Browser Cache:** Clear cookies and try in incognito mode
4. **Check Meta Status:** Visit https://developers.facebook.com/status/
5. **Contact Meta Support:** Use the support channels in Meta Developer Console

## 📞 Meta Developer Support

If you need help from Meta:
1. Go to Meta Developer Console
2. Click **Help** in the top navigation
3. Select **Get Support**
4. Choose **Threads API** as the product
5. Describe your issue with specific error messages

---

**Remember:** The most common issue is having the app in Development mode instead of Live mode. Always check this first!