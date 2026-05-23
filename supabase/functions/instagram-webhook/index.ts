import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Instagram webhook verify token - set this in your environment variables
const WEBHOOK_VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') || 'your_secure_token_here'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      // Webhook verification challenge
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      // Enhanced logging for debugging
      console.log('🔍 Instagram webhook verification attempt:', {
        url: req.url,
        method: req.method,
        mode,
        token: token ? token.substring(0, 10) + '...' : 'none',
        challenge: challenge ? challenge.substring(0, 10) + '...' : 'none',
        allParams: Object.fromEntries(url.searchParams.entries()),
        headers: Object.fromEntries(req.headers.entries())
      })

      console.log('🔑 Environment check:', {
        envTokenSet: !!WEBHOOK_VERIFY_TOKEN,
        envTokenLength: WEBHOOK_VERIFY_TOKEN ? WEBHOOK_VERIFY_TOKEN.length : 0,
        envTokenStart: WEBHOOK_VERIFY_TOKEN ? WEBHOOK_VERIFY_TOKEN.substring(0, 10) + '...' : 'not set'
      })

      if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Instagram webhook verified successfully')
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        })
      } else {
        console.error('❌ Instagram webhook verification failed:', {
          modeMatch: mode === 'subscribe',
          tokenMatch: token === WEBHOOK_VERIFY_TOKEN,
          expectedToken: WEBHOOK_VERIFY_TOKEN ? WEBHOOK_VERIFY_TOKEN.substring(0, 10) + '...' : 'not set',
          receivedToken: token ? token.substring(0, 10) + '...' : 'none',
          mode,
          tokenLength: token ? token.length : 0,
          expectedLength: WEBHOOK_VERIFY_TOKEN ? WEBHOOK_VERIFY_TOKEN.length : 0
        })
        return new Response('Forbidden - Invalid verification token', {
          status: 403,
          headers: corsHeaders
        })
      }
    }

    if (req.method === 'POST') {
      // Handle webhook events from Instagram
      const body = await req.json()

      console.log('📨 Instagram webhook event received:', {
        timestamp: new Date().toISOString(),
        object: body.object,
        entryCount: body.entry?.length || 0,
        fullPayload: JSON.stringify(body, null, 2),
        headers: Object.fromEntries(req.headers.entries())
      })

      // Process webhook events
      if (body.object === 'instagram') {
        for (const entry of body.entry || []) {
          console.log('Processing Instagram entry:', {
            id: entry.id,
            time: entry.time,
            changesCount: entry.changes?.length || 0
          })

          // Process each change in the entry
          for (const change of entry.changes || []) {
            await processInstagramChange(change, entry)
          }
        }
      }

      // Always return 200 OK to acknowledge receipt
      return new Response('OK', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('❌ Instagram webhook error:', error)

    // Still return 200 to prevent Instagram from retrying
    return new Response('Error processed', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
})

/**
 * Process individual Instagram webhook changes
 */
async function processInstagramChange(change: any, entry: any) {
  try {
    console.log('🔄 Processing Instagram change:', {
      field: change.field,
      value: change.value ? Object.keys(change.value) : 'none'
    })

    switch (change.field) {
      case 'comments':
        await handleCommentChange(change.value, entry)
        break

      case 'mentions':
        await handleMentionChange(change.value, entry)
        break

      case 'story_insights':
        await handleStoryInsights(change.value, entry)
        break

      default:
        console.log('ℹ️ Unhandled Instagram webhook field:', change.field)
    }

  } catch (error) {
    console.error('❌ Error processing Instagram change:', error)
  }
}

/**
 * Handle Instagram comment changes
 */
async function handleCommentChange(value: any, entry: any) {
  console.log('💬 Instagram comment change:', {
    mediaId: value.media_id,
    commentId: value.id,
    text: value.text?.substring(0, 50) + '...'
  })

  // Here you could:
  // - Store comment in database
  // - Send notification to user
  // - Trigger automated responses
  // - Update analytics
}

/**
 * Handle Instagram mention changes
 */
async function handleMentionChange(value: any, entry: any) {
  console.log('📢 Instagram mention change:', {
    mediaId: value.media_id,
    commentId: value.comment_id
  })

  // Here you could:
  // - Notify user of mention
  // - Store mention data
  // - Trigger engagement workflows
}

/**
 * Handle Instagram story insights
 */
async function handleStoryInsights(value: any, entry: any) {
  console.log('📊 Instagram story insights:', {
    mediaId: value.media_id,
    insights: Object.keys(value)
  })

  // Here you could:
  // - Update analytics dashboard
  // - Store performance metrics
  // - Generate reports
}