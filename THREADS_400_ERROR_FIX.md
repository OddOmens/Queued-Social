# Threads OAuth 400 Bad Request Error Fix

## Issue
Getting `400 Bad Request` error when trying to access Threads OAuth URL:
```
https://graph.threads.net/oauth/authorize?client_id=753393784148937&redirect_uri=https%3A%2F%2Fschedule.oddomens.com%2Fauth%2Fthreads%2Fcallback&scope=threads_basic,threads_content_publish&response_type=code&state=hcbdcb
```

## Root Causes & Solutions

### 1. **URL Encoding Issues** ✅ FIXED
**Problem**: Scope parameter wasn't properly URL encoded
**Solution**: Used `URLSearchParams` for proper encoding

### 2. **Meta Developer Console Configuration**
The 400 error often indicates issues with your app configuration in Meta Developer Console.

#### Check These Settings:

1. **App Status**:
   - Go to [Meta Developer Console](https://developers.facebook.com)
   - Select your app (ID: 753393784148937)
   - Ensure app is in **"Live"** mode, not "Development"

2. **Threads API Settings**:
   - Navigate to "Products" → "Threads API"
   - Verify these settings:

   **Redirect URIs** (must match exactly):
   ```
   https://schedule.oddomens.com/auth/threads/callback
   ```

   **App Domains**:
   ```
   schedule.oddomens.com
   ```

3. **App Review Status**:
   - Check if your app needs review for production use
   - Threads API might require approval for live usage

### 3. **Client ID Validation**
**Problem**: Invalid or incorrect Client ID
**Solution**: Verify the Client ID is exactly: `753393784148937`

### 4. **Scope Issues**
**Problem**: Requesting invalid or unauthorized scopes
**Current Scopes**: `threads_basic,threads_content_publish`

**Verify these scopes are**:
- Available for your app
- Approved in Meta Developer Console
- Not requiring additional permissions

### 5. **Domain Verification**
**Problem**: Domain not verified in Meta Console
**Solution**: 
1. Go to App Settings → Basic
2. Add `schedule.oddomens.com` to App Domains
3. Verify domain ownership if required

## Testing Steps

### 1. **Manual URL Test**
Try this URL directly in browser:
```
https://graph.threads.net/oauth/authorize?client_id=753393784148937&redirect_uri=https%3A%2F%2Fschedule.oddomens.com%2Fauth%2Fthreads%2Fcallback&scope=threads_basic%2Cthreads_content_publish&response_type=code&state=test123
```

### 2. **Check Console Logs**
After deploying the fix, check browser console for:
```
🔗 Threads OAuth Details: { clientId, redirectUri, scope, state, fullUrl }
```

### 3. **Verify Environment Variables**
Use the Debug component to ensure:
- `VITE_THREADS_CLIENT_ID` = `753393784148937`
- All variables are loaded correctly

## Common Meta Developer Console Issues

### Issue 1: App in Development Mode
**Symptoms**: 400 error, OAuth doesn't work for other users
**Fix**: Switch app to "Live" mode in App Review section

### Issue 2: Missing Redirect URI
**Symptoms**: 400 error with redirect_uri_mismatch
**Fix**: Add exact redirect URI in Threads API settings

### Issue 3: Invalid App Domain
**Symptoms**: 400 error, domain not allowed
**Fix**: Add domain to App Settings → Basic → App Domains

### Issue 4: Scope Not Approved
**Symptoms**: 400 error with invalid_scope
**Fix**: Request approval for required scopes in App Review

## Quick Verification Checklist

- [ ] App is in "Live" mode (not Development)
- [ ] Redirect URI exactly matches: `https://schedule.oddomens.com/auth/threads/callback`
- [ ] App Domain includes: `schedule.oddomens.com`
- [ ] Client ID is correct: `753393784148937`
- [ ] Scopes are approved: `threads_basic,threads_content_publish`
- [ ] Environment variables are set correctly in Coolify
- [ ] Latest code is deployed with URL encoding fix

## Alternative OAuth URL Format

If the issue persists, try this alternative format:
```javascript
const authUrl = `https://graph.threads.net/oauth/authorize` +
  `?client_id=${clientId}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&scope=${encodeURIComponent(scope)}` +
  `&response_type=code` +
  `&state=${state}`
```

## Next Steps

1. **Deploy the updated code** with proper URL encoding
2. **Check Meta Developer Console** settings
3. **Test the OAuth flow** again
4. **Check browser console** for detailed logs
5. **Verify app is in Live mode** if still getting 400 errors

The most common cause of 400 errors is app configuration in Meta Developer Console, especially the app being in Development mode instead of Live mode.