# Threads Integration Troubleshooting

## Common Issues and Solutions

### 1. "An unknown error has occurred" (Error Code 1)

This error typically occurs during the OAuth flow. Here are the most common causes and solutions:

#### **Check OAuth Configuration**
1. **Verify Redirect URI**: Make sure the redirect URI in your Meta Developer Console matches exactly:
   - Production: `https://schedule.oddomens.com/auth/threads/callback`
   - Local: `http://localhost:3000/auth/threads/callback`

2. **Check Client ID and Secret**: Ensure environment variables are set correctly:
   ```bash
   # In .env.production
   VITE_THREADS_CLIENT_ID=your_actual_client_id
   THREADS_CLIENT_ID=your_actual_client_id
   THREADS_CLIENT_SECRET=your_actual_client_secret
   ```

#### **Verify Meta Developer Console Settings**
1. Go to [Meta Developer Console](https://developers.facebook.com)
2. Select your app
3. Navigate to Threads API settings
4. Ensure:
   - App is in "Live" mode (not Development)
   - Redirect URIs are correctly configured
   - Required permissions are granted

#### **Check API Permissions**
Make sure your app has the following permissions:
- `threads_basic` - Basic profile access
- `threads_content_publish` - Ability to create and publish content

### 2. Token Exchange Failures

If the OAuth callback fails during token exchange:

#### **Check Network Requests**
1. Open browser Developer Tools
2. Go to Network tab
3. Attempt connection
4. Look for failed requests to `/api/auth/threads/token`

#### **Verify Serverless Function**
The token exchange uses a Netlify function. Ensure:
1. `netlify/functions/threads-token.js` is deployed
2. Environment variables are set in Netlify dashboard
3. Function logs show no errors

### 3. Environment Variable Issues

#### **Required Variables**
```env
# Client-side (VITE_ prefix for Vite)
VITE_THREADS_CLIENT_ID=753393784148937

# Server-side (for Netlify functions)
THREADS_CLIENT_ID=753393784148937
THREADS_CLIENT_SECRET=your_secret_here
```

#### **Verification Steps**
1. Check if variables are loaded:
   ```javascript
   console.log('Client ID:', import.meta.env.VITE_THREADS_CLIENT_ID)
   ```

2. In Netlify dashboard:
   - Go to Site Settings > Environment Variables
   - Verify all THREADS_* variables are set

### 4. CORS Issues

If you see CORS errors:

1. **Check Redirect URI**: Must match exactly in Meta Console
2. **Verify Domain**: Ensure your domain is whitelisted in Meta settings
3. **Protocol**: Use HTTPS in production

### 5. App Review Status

Threads API requires app review for production use:

1. **Development Mode**: Limited to app developers only
2. **Live Mode**: Available to all users after review
3. **Check Status**: In Meta Developer Console > App Review

### 6. Rate Limiting

Threads API has rate limits:

1. **OAuth**: 200 requests per hour per app
2. **Publishing**: 250 requests per hour per user
3. **Solution**: Implement exponential backoff

## Debugging Steps

### 1. Enable Debug Logging
```javascript
// In ConnectedAccounts.tsx
console.log('Connecting to Threads...')
console.log('Client ID:', import.meta.env.VITE_THREADS_CLIENT_ID)
console.log('Redirect URI:', `${window.location.origin}/auth/threads/callback`)
```

### 2. Test OAuth URL Manually
```javascript
const authUrl = `https://graph.threads.net/oauth/authorize?` +
  `client_id=YOUR_CLIENT_ID&` +
  `redirect_uri=${encodeURIComponent('https://schedule.oddomens.com/auth/threads/callback')}&` +
  `scope=threads_basic,threads_content_publish&` +
  `response_type=code&` +
  `state=test123`

console.log('Test this URL:', authUrl)
```

### 3. Check Token Exchange
```bash
# Test the serverless function directly
curl -X POST https://schedule.oddomens.com/api/auth/threads/token \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code"}'
```

### 4. Verify Meta API Response
```javascript
// In browser console after OAuth redirect
const urlParams = new URLSearchParams(window.location.search)
console.log('OAuth Code:', urlParams.get('code'))
console.log('OAuth Error:', urlParams.get('error'))
console.log('Error Description:', urlParams.get('error_description'))
```

## Quick Fixes

### 1. Clear Browser Cache
- Clear cookies and local storage
- Try incognito/private browsing mode

### 2. Regenerate Credentials
1. Go to Meta Developer Console
2. Generate new Client Secret
3. Update environment variables
4. Redeploy application

### 3. Test with Different Account
- Try connecting with a different Meta account
- Ensure account has Threads profile

### 4. Check Meta Status
- Visit [Meta Developer Status](https://developers.facebook.com/status/)
- Check for API outages or issues

## Contact Support

If issues persist:

1. **Meta Developer Support**: Use the support channels in Meta Developer Console
2. **Check Documentation**: [Threads API Docs](https://developers.facebook.com/docs/threads)
3. **Community Forums**: Meta Developer Community

## Production Checklist

Before going live:

- [ ] App approved by Meta
- [ ] All environment variables set
- [ ] Redirect URIs configured correctly
- [ ] HTTPS enabled
- [ ] Error handling implemented
- [ ] Rate limiting handled
- [ ] Monitoring and logging setup

---

**Note**: Threads API is currently in limited beta. Ensure your app has been approved for production use before deploying to users.