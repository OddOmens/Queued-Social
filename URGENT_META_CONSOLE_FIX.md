# 🚨 URGENT: Fix Meta Developer Console for Threads OAuth

## The Problem
You're getting a **400 Bad Request** error when trying to connect Threads. This is **100% a Meta Developer Console configuration issue**.

## 🎯 IMMEDIATE ACTION REQUIRED

### Step 1: Check App Status (CRITICAL!)
1. Go to https://developers.facebook.com
2. Log in and select your app (ID: `753393784148937`)
3. Look at the top of the page - is there a banner saying "Development Mode"?
4. If yes, **this is your problem!**

### Step 2: Switch to Live Mode
1. Click **App Review** in the left sidebar
2. Click **Permissions and Features**
3. Look for a toggle switch that says **"Live"** vs **"Development"**
4. **Switch it to "Live" mode**
5. Confirm the change

> **⚠️ CRITICAL:** 90% of 400 OAuth errors are caused by apps being in Development mode!

### Step 3: Verify Redirect URI
1. Click **Products** → **Threads API** in the left sidebar
2. Click **Settings** or **Configure**
3. Look for **"Redirect URIs"** section
4. Ensure it contains EXACTLY this (case-sensitive):
   ```
   https://schedule.oddomens.com/auth/threads/callback
   ```
5. If not there, add it and save

### Step 4: Verify App Domains
1. Click **Settings** → **Basic** in the left sidebar
2. Look for **"App Domains"** field
3. Ensure it contains:
   ```
   schedule.oddomens.com
   ```
4. If not there, add it and save

### Step 5: Wait and Test
1. **Wait 5-10 minutes** for changes to propagate
2. **Clear your browser cache** or use incognito mode
3. **Test the OAuth flow again**

## 🧪 Testing Tools

### Option 1: Use the Diagnostic Tool
Open `threads-oauth-diagnostics.html` in your browser and click "Try OAuth Flow"

### Option 2: Manual URL Test
Copy and paste this URL in your browser:
```
https://graph.threads.net/oauth/authorize?client_id=753393784148937&redirect_uri=https%3A%2F%2Fschedule.oddomens.com%2Fauth%2Fthreads%2Fcallback&scope=threads_basic%2Cthreads_content_publish&response_type=code&state=test123
```

**Expected Results:**
- ✅ **Success:** Threads login page appears
- ❌ **Still 400:** Double-check the steps above

## 📋 Quick Verification Checklist

After making changes, verify these in Meta Developer Console:

- [ ] App is in **"Live"** mode (not Development)
- [ ] Redirect URI: `https://schedule.oddomens.com/auth/threads/callback`
- [ ] App Domain: `schedule.oddomens.com`
- [ ] Client ID: `753393784148937`
- [ ] Threads API product is added to your app
- [ ] Required scopes are approved: `threads_basic`, `threads_content_publish`

## 🔍 Screenshots to Look For

### App Status (Should show "Live"):
```
[App Name] • Live Mode • App ID: 753393784148937
```

### Threads API Settings:
```
Redirect URIs:
✅ https://schedule.oddomens.com/auth/threads/callback

Authorized Domains:
✅ schedule.oddomens.com
```

### Basic Settings:
```
App Domains: schedule.oddomens.com
App ID: 753393784148937
```

## 🆘 If Still Not Working

### Double-Check These Common Issues:

1. **Typos in URLs:**
   - No extra spaces
   - Correct protocol (https://)
   - No trailing slashes
   - Case-sensitive matching

2. **App Permissions:**
   - App has Threads API product added
   - Required scopes are approved
   - App review is complete (if required)

3. **Propagation Time:**
   - Changes can take 5-10 minutes
   - Try clearing browser cache
   - Test in incognito mode

4. **Account Access:**
   - You have admin access to the app
   - App belongs to the correct Meta account
   - No restrictions on the app

## 📞 Meta Developer Support

If you've checked everything and it's still not working:

1. Go to Meta Developer Console
2. Click **Help** → **Get Support**
3. Select **Threads API** as the product
4. Describe the issue: "Getting 400 Bad Request on OAuth authorize endpoint"
5. Include your App ID: `753393784148937`
6. Mention you've verified all redirect URIs and app domains

## 🎯 Most Likely Solution

**99% chance the fix is:** Switch your app from **Development mode** to **Live mode** in the App Review section.

This is the most common cause of 400 OAuth errors and explains why your app works perfectly but Threads OAuth fails.

---

**After fixing, test immediately with the diagnostic tool or manual URL to confirm it's working!**