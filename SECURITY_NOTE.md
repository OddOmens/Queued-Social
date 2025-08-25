# Security Note: Client Secret Exposure

## ⚠️ Important Security Warning

Currently, the Threads client secret is exposed in the frontend environment variables (`VITE_THREADS_CLIENT_SECRET`). This is **NOT recommended for production** as it exposes sensitive credentials in the client-side bundle.

## Current Implementation

The OAuth token exchange is happening client-side because:
1. Coolify deployment doesn't support serverless functions
2. No backend API is currently implemented
3. Quick fix needed for immediate functionality

## Security Risks

- Client secret is visible in browser developer tools
- Anyone can inspect the source code and see the credentials
- Potential for credential misuse

## Recommended Solutions

### Option 1: Backend API (Recommended)
Create a proper backend API endpoint:

```typescript
// Backend route: /api/auth/threads/token
app.post('/api/auth/threads/token', async (req, res) => {
  const { code } = req.body
  
  const response = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.THREADS_CLIENT_ID,
      client_secret: process.env.THREADS_CLIENT_SECRET, // Server-side only
      grant_type: 'authorization_code',
      redirect_uri: process.env.THREADS_REDIRECT_URI,
      code
    })
  })
  
  const data = await response.json()
  res.json(data)
})
```

### Option 2: Proxy Server
Set up a proxy server to handle OAuth flows:

```nginx
location /api/auth/threads/token {
    proxy_pass https://your-backend-api.com/threads/token;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Option 3: Serverless Functions
If your deployment platform supports it:

```javascript
// Vercel/Netlify function
export default async function handler(req, res) {
  // Handle token exchange server-side
}
```

## Immediate Actions

1. **Monitor Usage**: Watch for unusual API usage patterns
2. **Rotate Credentials**: Regularly rotate client secret in Meta Developer Console
3. **Implement Backend**: Plan to move token exchange to server-side
4. **Environment Security**: Ensure production environment variables are secure

## Long-term Plan

1. Create proper backend API
2. Move OAuth flow to server-side
3. Remove `VITE_THREADS_CLIENT_SECRET` from frontend
4. Implement proper credential management
5. Add rate limiting and monitoring

## For Coolify Deployment

Since you're using Coolify, consider:

1. **Docker Backend**: Add a simple Express.js backend container
2. **Environment Variables**: Use Coolify's secure environment variable management
3. **Internal Network**: Keep API communication internal between containers

---

**This is a temporary solution. Please implement proper server-side OAuth handling as soon as possible.**