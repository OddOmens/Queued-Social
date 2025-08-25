# Environment Variables Solution - Threads Integration

## 🔍 Issue Discovered

The debug output revealed that **only `VITE_` prefixed environment variables are available in the frontend**:

```
✅ VITE_THREADS_CLIENT_ID: 753393784148937
✅ VITE_THREADS_CLIENT_SECRET: 4cf0c65d...
❌ THREADS_CLIENT_ID: undefined
❌ THREADS_CLIENT_SECRET: undefined
```

## 🧠 Why This Happens

**Vite Security Feature**: Vite only exposes environment variables prefixed with `VITE_` to the client-side code for security reasons. Regular environment variables are only available server-side.

## ✅ Solution Applied

Updated all code to use **only** the `VITE_` prefixed variables:

### Before (Incorrect):
```javascript
const clientId = import.meta.env.VITE_THREADS_CLIENT_ID || import.meta.env.THREADS_CLIENT_ID
const clientSecret = import.meta.env.VITE_THREADS_CLIENT_SECRET || import.meta.env.THREADS_CLIENT_SECRET
```

### After (Correct):
```javascript
const clientId = import.meta.env.VITE_THREADS_CLIENT_ID
const clientSecret = import.meta.env.VITE_THREADS_CLIENT_SECRET
```

## 🚀 Current Status

Your Coolify environment variables are **correctly configured**:
- ✅ `VITE_THREADS_CLIENT_ID=753393784148937`
- ✅ `VITE_THREADS_CLIENT_SECRET=4cf0c65d88a7d192f89048d8c4d03c78`

## 🔧 What Was Fixed

1. **ConnectedAccounts.tsx**: Now uses only `VITE_THREADS_CLIENT_ID`
2. **threadsDebug.ts**: Updated to use only `VITE_` variables
3. **URL Encoding**: Fixed OAuth URL parameter encoding
4. **Validation**: Added Client ID format validation

## 📋 Next Steps

1. **Deploy the updated code** ✅ (Build successful)
2. **Test Threads OAuth flow** - should work now!
3. **Check Meta Developer Console** if still getting 400 errors:
   - Ensure app is in "Live" mode
   - Verify redirect URI: `https://schedule.oddomens.com/auth/threads/callback`
   - Add domain: `schedule.oddomens.com`

## 🎯 Expected Behavior

After deployment:

1. **OAuth URL Generation**: Should work without 400 errors
2. **Token Exchange**: Should successfully exchange code for access token
3. **Credential Storage**: Should save to Supabase database
4. **Connection Status**: Should show as "Connected" in settings

## 🔍 Debug Information

The console will now show:
```javascript
🔗 Threads OAuth Details: {
  clientId: "753393784148937",
  redirectUri: "https://schedule.oddomens.com/auth/threads/callback",
  scope: "threads_basic,threads_content_publish",
  state: "random_string",
  fullUrl: "properly_encoded_url"
}
```

## 🚨 Important Notes

- **Security**: Client secret is now exposed in frontend (temporary solution)
- **Production**: Should move to server-side token exchange later
- **Environment**: Only `VITE_` variables work in Vite frontend

The Threads integration should now work correctly! 🎉