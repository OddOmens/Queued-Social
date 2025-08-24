# Using ngrok for HTTPS Development

## Install ngrok
```bash
# Install ngrok (macOS)
brew install ngrok/ngrok/ngrok

# Or download from https://ngrok.com/download
```

## Setup ngrok
```bash
# Sign up at https://ngrok.com and get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start your Next.js app
npm run dev

# In another terminal, create HTTPS tunnel
ngrok http 3000
```

## Update Environment Variables
When ngrok starts, it will give you a URL like `https://abc123.ngrok.io`

Update your `.env.local`:
```env
NEXTAUTH_URL=https://abc123.ngrok.io
```

## Update Meta Developer Console
Add the ngrok URL to your Threads app callback URLs:
```
Redirect Callback URL: https://abc123.ngrok.io/api/auth/threads/callback
Uninstall Callback URL: https://abc123.ngrok.io/api/auth/threads/uninstall
Delete Callback URL: https://abc123.ngrok.io/api/auth/threads/delete
```

## Test OAuth Flow
1. Visit your ngrok URL: `https://abc123.ngrok.io`
2. Go to Settings → Platforms
3. Click "Connect Threads"
4. OAuth should work over HTTPS