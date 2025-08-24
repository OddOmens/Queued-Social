import { NextRequest, NextResponse } from 'next/server'

/**
 * Threads App Uninstall Webhook Handler
 * Called when a user uninstalls/deauthorizes the app from their Threads account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log the uninstall event
    console.log('Threads app uninstall webhook received:', body)

    // Extract user information from the webhook payload
    const { user_id, timestamp } = body

    if (!user_id) {
      console.error('Missing user_id in uninstall webhook')
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // TODO: Handle app uninstall
    // 1. Remove stored access tokens for this user
    // 2. Cancel any scheduled posts for this user's Threads account
    // 3. Update user's platform connection status
    // 4. Optionally notify the user via email
    // 5. Clean up any related data

    console.log(`Processing Threads uninstall for user ${user_id} at ${timestamp}`)

    // Example cleanup operations:
    /*
    await Promise.all([
      // Remove access tokens from database
      db.threadsTokens.deleteMany({ where: { threadsUserId: user_id } }),
      
      // Cancel scheduled posts
      db.scheduledPosts.updateMany({
        where: { 
          platform: 'threads',
          threadsUserId: user_id,
          status: 'scheduled'
        },
        data: { status: 'cancelled' }
      }),
      
      // Update platform connection
      db.platformConnections.updateMany({
        where: { 
          platform: 'threads',
          externalUserId: user_id
        },
        data: { 
          isActive: false,
          disconnectedAt: new Date()
        }
      })
    ])
    */

    // Respond with success
    return NextResponse.json({ 
      success: true, 
      message: 'Uninstall processed successfully',
      user_id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing Threads uninstall webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for webhook verification (if required by Threads)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Verify webhook subscription (if Threads requires it)
  if (mode === 'subscribe' && token === process.env.THREADS_WEBHOOK_VERIFY_TOKEN) {
    console.log('Threads uninstall webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}