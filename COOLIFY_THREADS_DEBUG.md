# Coolify Threads Integration Debug Guide

## Current Issue
Getting "Missing required field: client_secret" error during Threads OAuth flow.

## Debug Steps

### 1. Check Environment Variables in Coolify

In your Coolify dashboard:

1. Go to your app settings
2. Navigate to Environment Variables section
3. Ensure these variables are set:

```env
VITE_THREADS_CLIENT_ID=753393784148937
VITE_THREADS_CLIENT_SECRET=4cf0c65d88a7d192f89048d8c4d03c78
THREADS_CLIENT_ID=753393784148937
THREADS_CLIENT_SECRET=4cf0c65d88a7d192f89048d8c4d03c78
```

### 2. Use Debug Tools

After deploying the updated version:

1. **Environment Debug**: Go to Settings page, click "Debug Env" button (bottom right)
2. **Browser Console**: Check browser console for detailed logs during OAuth flow
3. **Global Debug**: In browser console, run:
   ```javascript
   // Check environment
   threadsDebug.debug()
   
   // Test with a real code (get from OAuth callback URL)
   threadsDebug.test('your_oauth_code_here')
   ```

### 3. Verify OAuth Flow

1. **Check OAuth URL**: Should be:
   ```
   https://graph.threads.net/oauth/authorize?client_id=753393784148937&redirect_uri=https%3A//schedule.oddomens.com/auth/threads/callback&scope=threads_basic%2Cthreads_content_publish&response_type=code&state=...
   ```

2. **Check Redirect URI**: Must match exactly in Meta Developer Console:
   ```
   https://schedule.oddomens.com/auth/threads/callback
   ```

### 4. Common Coolify Issues

#### Environment Variables Not Loading
- **Problem**: Coolify might not be loading .env files properly
- **Solution**: Set variables directly in Coolify UI, not in .env files

#### Build-time vs Runtime Variables
- **Problem**: VITE_ variables are build-time, others are runtime
- **Solution**: For Coolify, set both versions of each variable

#### Container Restart Required
- **Problem**: Environment changes need container restart
- **Solution**: Redeploy after changing environment variables

### 5. Manual Testing

Test the token exchange manually:

```bash
# Test with curl (replace YOUR_CODE with actual OAuth code)
curl -X POST https://graph.threads.net/oauth/access_token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=753393784148937" \
  -d "client_secret=4cf0c65d88a7d192f89048d8c4d03c78" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=https://schedule.oddomens.com/auth/threads/callback" \
  -d "code=YOUR_CODE"
```

### 6. Expected Responses

#### Success Response:
```json
{
  "access_token": "THREADS_ACCESS_TOKEN",
  "user_id": "USER_ID"
}
```

#### Error Response:
```json
{
  "error": {
    "message": "Missing required field: client_secret",
    "type": "OAuthException",
    "code": 1,
    "fbtrace_id": "..."
  }
}
```

### 7. Coolify Environment Variable Setup

In Coolify UI, add these **exactly**:

| Key | Value |
|-----|-------|
| `VITE_THREADS_CLIENT_ID` | `753393784148937` |
| `VITE_THREADS_CLIENT_SECRET` | `4cf0c65d88a7d192f89048d8c4d03c78` |
| `THREADS_CLIENT_ID` | `753393784148937` |
| `THREADS_CLIENT_SECRET` | `4cf0c65d88a7d192f89048d8c4d03c78` |

### 8. Verification Checklist

- [ ] Environment variables set in Coolify UI
- [ ] Container redeployed after env changes
- [ ] Debug component shows all variables loaded
- [ ] Browser console shows detailed request logs
- [ ] Meta Developer Console redirect URI matches exactly
- [ ] OAuth flow reaches callback page
- [ ] Token exchange request includes client_secret

### 9. If Still Failing

1. **Check Coolify Logs**: Look for environment variable loading errors
2. **Test Locally**: Verify it works in local development
3. **Meta Developer Console**: Check app status and permissions
4. **Network Tab**: Inspect the actual HTTP request being sent

### 10. Quick Fix Commands

```bash
# In Coolify terminal/logs, check if env vars are loaded:
echo $VITE_THREADS_CLIENT_SECRET
echo $THREADS_CLIENT_SECRET

# Check if variables are available in the built app:
grep -r "THREADS" /app/dist/assets/
```

---

**Next Steps**: Deploy this debug version and use the tools to identify exactly where the client_secret is getting lost in the request.