# Threads API Integration Setup

## Prerequisites

1. **Meta Developer Account**: Sign up at [developers.facebook.com](https://developers.facebook.com)
2. **Threads API Access**: Request access to Threads API (currently in limited beta)
3. **App Registration**: Create a new app in Meta Developer Console

## Step 1: Configure Callback URLs in Meta Developer Console

In your Threads API settings, add these callback URLs:

### For Local Development:
```
Redirect Callback URL: http://localhost:3000/api/auth/threads/callback
Uninstall Callback URL: http://localhost:3000/api/auth/threads/uninstall
Delete Callback URL: http://localhost:3000/api/auth/threads/delete
```

### For Production:
```
Redirect Callback URL: https://yourdomain.com/api/auth/threads/callback
Uninstall Callback URL: https://yourdomain.com/api/auth/threads/uninstall
Delete Callback URL: https://yourdomain.com/api/auth/threads/delete
```

## Step 2: Environment Configuration

Add these variables to your `.env.local`:

```env
# Threads API Configuration
THREADS_APP_ID=your_app_id_here
THREADS_APP_SECRET=your_app_secret_here
THREADS_WEBHOOK_VERIFY_TOKEN=your_secure_webhook_verify_token_here

# App Configuration
NEXTAUTH_URL=http://localhost:3000  # Change to your domain in production
```

## Step 2: OAuth Flow Implementation

Create the OAuth callback handler:

```typescript
// src/app/api/auth/threads/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  if (!code) {
    return NextResponse.redirect('/settings/platforms?error=oauth_failed')
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.THREADS_APP_ID!,
        client_secret: process.env.THREADS_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: process.env.THREADS_REDIRECT_URI!,
        code
      })
    })
    
    const tokens = await tokenResponse.json()
    
    // Store tokens securely (implement your storage logic)
    // await storeUserTokens(userId, tokens)
    
    return NextResponse.redirect('/settings/platforms?success=threads_connected')
  } catch (error) {
    console.error('Threads OAuth error:', error)
    return NextResponse.redirect('/settings/platforms?error=oauth_failed')
  }
}
```

## Step 3: Update Threads Plugin

Update `src/services/platforms/threadsPlugin.ts`:

```typescript
export class ThreadsPlugin implements PlatformPlugin {
  private accessToken: string
  
  constructor(credentials: ThreadsCredentials) {
    this.accessToken = credentials.credentials.accessToken
  }
  
  async publishPost(content: PostContent): Promise<PublishResult> {
    try {
      // For text posts
      if (content.type === 'single') {
        const response = await fetch('https://graph.threads.net/v1.0/me/threads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            media_type: 'TEXT',
            text: content.text
          })
        })
        
        const result = await response.json()
        
        if (response.ok) {
          return {
            success: true,
            platformPostId: result.id,
            publishedAt: new Date(),
            platformUrl: `https://threads.net/@username/post/${result.id}`
          }
        } else {
          throw new Error(result.error?.message || 'Failed to publish')
        }
      }
      
      // Handle other content types (threads, media)
      throw new Error('Content type not yet implemented')
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
```

## Step 4: Update Platform Settings Page

Update the connect button in `/settings/platforms`:

```typescript
const handleConnectThreads = () => {
  const authUrl = new URL('https://graph.threads.net/oauth/authorize')
  authUrl.searchParams.set('client_id', import.meta.env.VITE_THREADS_APP_ID!)
  authUrl.searchParams.set('redirect_uri', import.meta.env.VITE_THREADS_REDIRECT_URI!)
  authUrl.searchParams.set('scope', 'threads_basic,threads_content_publish')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', generateRandomState())
  
  window.location.href = authUrl.toString()
}
```

## Step 5: Job Scheduler Integration

Update `src/services/jobScheduler.ts` to actually publish posts:

```typescript
async function processScheduledPost(post: ScheduledPost) {
  try {
    // Get user's platform credentials
    const credentials = await getThreadsCredentials(post.userId)
    if (!credentials) {
      throw new Error('No Threads credentials found')
    }
    
    // Create platform plugin
    const plugin = new ThreadsPlugin(credentials)
    
    // Publish the post
    const result = await plugin.publishPost(post.content)
    
    if (result.success) {
      // Update post status to published
      await updatePostStatus(post.id, 'published', {
        platformPostId: result.platformPostId,
        publishedAt: result.publishedAt,
        platformUrl: result.platformUrl
      })
    } else {
      // Update post status to failed
      await updatePostStatus(post.id, 'failed', {
        errorMessage: result.error
      })
    }
  } catch (error) {
    console.error('Failed to process scheduled post:', error)
    await updatePostStatus(post.id, 'failed', {
      errorMessage: error.message
    })
  }
}
```

## Step 6: Testing

1. **Test OAuth Flow**: 
   - Go to `/settings/platforms`
   - Click "Connect Threads"
   - Complete OAuth flow
   - Verify tokens are stored

2. **Test Publishing**:
   - Create a test post
   - Schedule it for immediate publishing
   - Check that it appears on Threads
   - Verify post status updates in your app

## Step 7: Production Considerations

1. **Token Refresh**: Implement automatic token refresh
2. **Rate Limiting**: Handle Threads API rate limits
3. **Error Handling**: Robust error handling and retry logic
4. **Webhooks**: Set up webhooks for real-time status updates
5. **Security**: Secure token storage and transmission

## Threads API Endpoints

- **OAuth**: `https://graph.threads.net/oauth/authorize`
- **Token Exchange**: `https://graph.threads.net/oauth/access_token`
- **Create Post**: `https://graph.threads.net/v1.0/me/threads`
- **Publish Post**: `https://graph.threads.net/v1.0/{creation-id}/publish`

## Resources

- [Threads API Documentation](https://developers.facebook.com/docs/threads)
- [Meta Developer Console](https://developers.facebook.com)
- [Threads API Reference](https://developers.facebook.com/docs/threads/reference)

Once you complete these steps, your app will be fully integrated with the Threads API and ready for production use!