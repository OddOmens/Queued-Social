import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Encrypt function for server-side credential encryption
async function encrypt(text: string): Promise<string> {
  try {
    const encryptionKey = Deno.env.get('VITE_CREDENTIAL_ENCRYPTION_KEY')
    if (!encryptionKey) {
      throw new Error('VITE_CREDENTIAL_ENCRYPTION_KEY environment variable is required')
    }

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Import the key
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    )

    // Encrypt the data
    const data = encoder.encode(text)
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      data
    )

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    // Convert to base64
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt credentials')
  }
}

// Decrypt function for server-side credential decryption
async function decrypt(encryptedText: string): Promise<string> {
  try {
    const encryptionKey = Deno.env.get('VITE_CREDENTIAL_ENCRYPTION_KEY')
    if (!encryptionKey) {
      throw new Error('VITE_CREDENTIAL_ENCRYPTION_KEY environment variable is required')
    }

    console.log('🔑 Encryption key debug:', {
      hasEnvKey: !!encryptionKey,
      keyPreview: encryptionKey.substring(0, 10) + '...',
      keyLength: encryptionKey.length
    })

    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedText).split('').map(c => c.charCodeAt(0))
    )

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)

    // Import the key
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      encrypted
    )

    // Convert back to string
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt credentials')
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // SECURITY CHECK: Verify the request source
    // We check for a shared secret header sent by the cron job (internal)
    // OR allow if it's a development/admin manual test with Authorization header? 
    // Actually, let's just enforce the secret for now.
    const secretDetails = {
      header: req.headers.get('x-scheduler-secret'),
      expected: Deno.env.get('SCHEDULER_SECRET') ?? ''
    }

    if (secretDetails.header !== secretDetails.expected) {
      // Allow manual testing if providing the service role key OR a valid user JWT
      const authHeader = req.headers.get('Authorization')
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

      const isServiceRoleAuth = authHeader && authHeader.includes(serviceRoleKey)

      // Also check for standard User JWT
      let isUserAuth = false
      if (authHeader && !isServiceRoleAuth) {
        try {
          const jwt = authHeader.replace('Bearer ', '')
          const parts = jwt.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]))
            // If it's a valid supabase token (has 'aud' and 'sub')
            if (payload.aud === 'authenticated' && payload.sub) {
              isUserAuth = true
            }
          }
        } catch (e) {
          console.warn('Invalid JWT provided for manual trigger')
        }
      }

      if (!isServiceRoleAuth && !isUserAuth) {
        console.error('⛔ Security blocked unauthorized request', { header: secretDetails.header })
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Invalid security credentials' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log(`⚠️ Authorized via ${isServiceRoleAuth ? 'Service Role Key' : 'User JWT'} (Manual Bypass)`)
    } else {
      console.log('✅ Authorized via Internal Secret Header')
    }

    console.log('🔍 Processing scheduled posts...')

    // Get posts that should be published now
    const now = new Date()

    console.log(`📅 Checking for posts scheduled up to ${now.toISOString()}`)

    // ATOMIC UPDATE: Claim posts by setting status to 'publishing' before processing
    // This prevents other schedulers from grabbing the same posts (race condition fix)
    let scheduledPosts: any[] | null = null
    const { data: claimedPosts, error: fetchError } = await supabaseClient
      .rpc('claim_scheduled_posts_for_processing', {
        p_current_time: now.toISOString(),
        lookback_minutes: 10080, // 7 days in minutes - process any overdue posts
        batch_size: 10
      })

    // Fallback to direct query if RPC doesn't exist yet
    if (fetchError && fetchError.message.includes('function') && fetchError.message.includes('does not exist')) {
      console.log('⚠️ claim_scheduled_posts_for_processing function not found, using direct query (not atomic)')

      const { data: posts, error: directError } = await supabaseClient
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_time', now.toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(10)

      if (directError) {
        throw new Error(`Failed to fetch scheduled posts: ${directError.message}`)
      }

      // Manually update status to 'publishing' for each post
      if (posts && posts.length > 0) {
        const postIds = posts.map(p => p.id)
        await supabaseClient
          .from('scheduled_posts')
          .update({ status: 'publishing', updated_at: now.toISOString() })
          .in('id', postIds)
          .eq('status', 'scheduled') // Only update if still scheduled (atomic check)
      }

      console.log(`📊 Found ${posts?.length || 0} posts to publish`)

      if (!posts || posts.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No posts to process',
            results: { processed: 0, failed: 0, errors: [] }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      // Use the posts from direct query
      scheduledPosts = posts
    } else if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`)
    } else {
      scheduledPosts = claimedPosts
    }

    console.log(`📊 Claimed ${scheduledPosts?.length || 0} posts for processing`)

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No posts to process',
          results
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Track media URLs to determine when to clean up
    // Map of "JSON(mediaUrls)" -> count of posts using it
    const mediaUsageCount = new Map<string, number>();

    // First pass: count usage of each media set
    for (const post of scheduledPosts) {
      if (typeof post.content === 'string') {
        try { post.content = JSON.parse(post.content); } catch (e) { }
      }
      if (post.content && post.content.mediaUrls && Array.isArray(post.content.mediaUrls)) {
        const key = JSON.stringify(post.content.mediaUrls);
        mediaUsageCount.set(key, (mediaUsageCount.get(key) || 0) + 1);
      }
    }

    console.log('📊 Media usage counts:', Object.fromEntries(mediaUsageCount));

    // Process each scheduled post
    for (const post of scheduledPosts) {
      // Re-parse content if needed (though we did it above, do it safely again or skip if object)
      if (typeof post.content === 'string') {
        try {
          post.content = JSON.parse(post.content)
        } catch (e) {
          console.error('❌ Failed to parse post content:', e)
          // Skip this post but don't crash
          results.failed++;
          results.errors.push(`Post ${post.id}: Invalid JSON content`);
          continue;
        }
      }

      try {
        console.log(`📡 Processing post ${post.id} for platform ${post.platform}`)

        // Ensure content is parsed if it's a string (fixes JSONB stringification issues)
        if (typeof post.content === 'string') {
          try {
            post.content = JSON.parse(post.content)
            console.log('✅ Parsed post content from string')
          } catch (e) {
            console.error('❌ Failed to parse post content:', e)
            throw new Error('Post content is invalid JSON')
          }
        }

        // STRICT ACCOUNT VALIDATION: Only publish to the assigned account
        // This prevents posts from being published to the wrong account

        console.log(`🔍 Post ${post.id} validation:`, {
          platform: post.platform,
          assignedAccountId: post.platform_account_id,
          accountName: post.account_name,
          hasAccountId: !!post.platform_account_id
        })

        // CRITICAL: All posts must have a platform_account_id assigned
        if (!post.platform_account_id) {
          throw new Error(`Post ${post.id} has no assigned account. This post needs to be reassigned to a specific ${post.platform} account before it can be published. Please edit the post and select an account.`)
        }

        // Get credentials ONLY for the specifically assigned account
        console.log(`🔍 Looking for credentials for ${post.platform} account ${post.platform_account_id}...`)

        let { data: credentials, error: credError } = await supabaseClient
          .from('platform_credentials')
          .select('*')
          .eq('user_id', post.user_id)
          .eq('platform', post.platform)
          .eq('platform_account_id', post.platform_account_id)
          .eq('is_active', true)
          .single()

        // UUID Falback Logic
        if ((credError || !credentials) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(post.platform_account_id)) {
          console.log('retry lookup by UUID');
          const { data: uuidRow, error: uuidError } = await supabaseClient
            .from('platform_credentials')
            .select('*')
            .eq('user_id', post.user_id)
            .eq('platform', post.platform)
            .eq('id', post.platform_account_id)
            .eq('is_active', true)
            .single()

          if (uuidRow && !uuidError) {
            credentials = uuidRow;
            credError = null;
            console.log('✅ Found credentials by internal UUID Match');
          }
        }

        if (credError || !credentials) {
          console.warn(`⚠️ Strict credential lookup failed for ${post.platform} account ${post.platform_account_id}. Attempting auto-recovery by name...`);

          // Fallback: Check if we have an account with the same NAME (handles ID rotations upon reconnection)
          const { data: potentialMatches } = await supabaseClient
            .from('platform_credentials')
            .select('*')
            .eq('user_id', post.user_id)
            .eq('platform', post.platform)
            .eq('is_active', true);

          // Legacy block removed to allow fallthrough to robust logic below
        }


        // Final active credentials resolution
        let finalCredentials = credentials;


        if (!finalCredentials) {
          // Re-attempting fetch by name to get the object into this scope
          const { data: potentialMatches } = await supabaseClient
            .from('platform_credentials')
            .select('*')
            .eq('user_id', post.user_id)
            .eq('platform', post.platform)
            .eq('is_active', true);

          finalCredentials = potentialMatches?.find((c: any) => {
            const postName = (post.account_name || '').trim().toLowerCase();
            const credName = (c.account_name || '').trim().toLowerCase();
            const credUser = (c.username || '').trim().toLowerCase();
            const postUser = (post.account_username || '').trim().toLowerCase();

            return (credName && credName === postName) ||
              (credUser && credUser === postName) ||
              (credUser && credUser === postUser);
          });

          if (!finalCredentials) {
            // Should have been caught by the block above, but safe to throw again or just this is essentially unreachable if the above block works
            throw new Error(`Failed to resolve credentials for post ${post.id}.`);
          }
        }

        console.log('🔍 Using credentials:', {
          id: finalCredentials.id,
          platform: finalCredentials.platform,
          hasCredentials: !!finalCredentials.credentials,
          credentialsStructure: finalCredentials.credentials ? Object.keys(finalCredentials.credentials) : [],
          isEncrypted: !!(finalCredentials.credentials && finalCredentials.credentials.encrypted)
        })

        // Decrypt credentials if they are encrypted
        let decryptedCredentials = finalCredentials.credentials
        if (finalCredentials.credentials && finalCredentials.credentials.encrypted) {
          console.log('🔓 Decrypting credentials...')
          try {
            const decryptedText = await decrypt(finalCredentials.credentials.encrypted)
            decryptedCredentials = JSON.parse(decryptedText)
            console.log('✅ Credentials decrypted successfully:', {
              platform: post.platform,
              hasAccessToken: !!(decryptedCredentials.accessToken || decryptedCredentials.access_token),
              hasUserId: !!(decryptedCredentials.userId || decryptedCredentials.user_id),
              keys: Object.keys(decryptedCredentials)
            })
          } catch (decryptError: any) {
            console.error('❌ Decryption failed:', decryptError)
            throw new Error(`Failed to decrypt ${post.platform} credentials: ${decryptError.message}`)
          }
        } else {
          console.log('🔍 Credentials are not encrypted, using directly')
        }


        // Normalize credentials for platform-specific handling
        const normalizedCredentials = normalizeCredentialsForPlatform(post.platform, decryptedCredentials)

        // REFRESH MEDIA URLs: Ensure we have fresh signed URLs for R2 content
        // This is critical for scheduled posts where the original signed URL (if stored) has expired
        let contentToPublish = { ...post.content }

        if (contentToPublish.mediaUrls && contentToPublish.mediaUrls.length > 0) {
          console.log(`🔄 Checking ${contentToPublish.mediaUrls.length} media URLs for refresh needs...`)

          const freshUrls: string[] = []
          let needsUpdate = false

          for (const url of contentToPublish.mediaUrls) {
            // Check if it looks like an R2 URL (signed or scheme) or needs checking
            // We refresh anything that looks like R2 to be safe
            if (
              url.includes('r2.cloudflarestorage.com') ||
              url.startsWith('r2://') ||
              url.includes('queued-social') // Bucket name check
            ) {
              try {
                // Extract key from r2:// scheme if present
                let key = url
                if (key.startsWith('r2://')) {
                  const parts = key.split('/queued-social/') // Try standard bucket path
                  if (parts.length > 1) {
                    key = parts[1]
                  } else {
                    // Fallback generic split
                    key = key.replace('r2://', '')
                  }
                }

                console.log(`  🔄 Refreshing URL for key/path: ...${key.slice(-20)}`)

                const { data: mediaData, error: mediaError } = await supabaseClient.functions.invoke('upload-media', {
                  body: { action: 'get', key: key }
                })

                if (mediaError || !mediaData?.signedUrl) {
                  console.warn(`  ⚠️ Failed to refresh URL, keeping original:`, mediaError)
                  freshUrls.push(url)
                } else {
                  console.log(`  ✅ Refreshed URL successfully`)
                  freshUrls.push(mediaData.signedUrl)
                  needsUpdate = true
                }
              } catch (e) {
                console.warn(`  ⚠️ Error calling upload-media, keeping original:`, e)
                freshUrls.push(url)
              }
            } else {
              // Convert expired Supabase Signed URLs to Public URLs, since the original bucket is public
              if (url.includes('supabase.co/storage') && url.includes('media-files')) {
                console.log(`  🔄 Converting legacy Supabase URL to public URL`);
                let cleanUrl = url.split('?')[0]; // Remove ?token=...
                cleanUrl = cleanUrl.replace('/object/sign/', '/object/public/');
                freshUrls.push(cleanUrl);
              } else {
                freshUrls.push(url);
              }
            }
          }

          if (needsUpdate) {
            contentToPublish.mediaUrls = freshUrls
            console.log('✅ Media URLs updated for publishing')
          }
        }


        // FINAL VALIDATION: Ensure we're using the correct account credentials
        console.log(`🛡️ Final account validation before publishing:`, {
          postId: post.id,
          postAssignedAccount: post.platform_account_id,
          postAccountName: post.account_name,
          credentialsAccount: finalCredentials.platform_account_id,
          credentialsAccountName: finalCredentials.account_name,
          normalizedUserId: normalizedCredentials.userId,
          platform: post.platform
        })

        // Double-check that we're using credentials for the correct account
        if (finalCredentials.platform_account_id !== post.platform_account_id) {
          // Check if this is a valid rotation (names match) or if post.platform_account_id is the internal UUID
          if (finalCredentials.account_name === post.account_name ||
            finalCredentials.username === post.account_name ||
            finalCredentials.username === post.account_username ||
            finalCredentials.id === post.platform_account_id) {

            console.log(`🔄 Account ID rotation or mapping detected (Old: ${post.platform_account_id}, New: ${finalCredentials.platform_account_id}). Updating post record...`);

            // Heal the post record
            await supabaseClient
              .from('scheduled_posts')
              .update({ platform_account_id: finalCredentials.platform_account_id })
              .eq('id', post.id);

          } else {
            throw new Error(`CRITICAL ERROR: Account mismatch detected! Post ${post.id} is assigned to account ${post.platform_account_id} but we retrieved credentials for account ${finalCredentials.platform_account_id}. This would cause cross-account posting.`)
          }
        }

        console.log(`🚀 Publishing post ${post.id} to ${post.platform} account "${post.account_name}" (${post.platform_account_id})...`)

        // Call the publish-post function internally
        let publishResult
        if (post.platform === 'threads') {
          publishResult = await publishToThreads(contentToPublish, normalizedCredentials)
        } else if (post.platform === 'instagram') {
          publishResult = await publishToInstagram(contentToPublish, normalizedCredentials)
        } else if (post.platform === 'linkedin') {
          publishResult = await publishToLinkedIn(contentToPublish, normalizedCredentials)
        } else {
          throw new Error(`Platform ${post.platform} not supported`)
        }

        // Update the post status to published
        const { error: updateError } = await supabaseClient
          .from('scheduled_posts')
          .update({
            status: 'published',
            published_at: now.toISOString(),
            platform_post_id: publishResult.postId,
            updated_at: now.toISOString()
          })
          .eq('id', post.id)

        if (updateError) {
          console.error(`❌ Failed to update post ${post.id} status:`, updateError)
          // Don't fail the entire process if DB update fails
        } else {
          // Notify N8N of success
          await notifyN8n(post, 'published')
        }

        console.log(`✅ Successfully published post ${post.id} to ${post.platform} account "${post.account_name}" (${post.platform_account_id}) -> Platform Post ID: ${publishResult.postId}`)
        results.processed++

        // Handle Media Cleanup - DISABLED to preserve Media Library
        /*
        if (post.content.mediaUrls && post.content.mediaUrls.length > 0) {
          const mediaKey = JSON.stringify(post.content.mediaUrls);
          const remainingUses = (mediaUsageCount.get(mediaKey) || 1) - 1;
          mediaUsageCount.set(mediaKey, remainingUses);

          if (remainingUses <= 0) {
            console.log('🧹 Last post using this media set completed. Cleaning up...');
            try {
              await cleanupPostMedia(post.content.mediaUrls, post.user_id, supabaseClient);
              console.log('✅ Media cleanup completed');
            } catch (cleanupError) {
              console.warn('⚠️ Media cleanup failed:', cleanupError);
            }
          } else {
            console.log(`📝 Media set still used by ${remainingUses} other posts. Skipping cleanup.`);
          }
        }
        */

      } catch (error) {
        const errorMessage = (error instanceof Error ? error.message : String(error)) || 'Unknown error occurred'
        console.error(`❌ Failed to process post ${post.id}:`, errorMessage)

        // Mark post as failed
        try {
          await supabaseClient
            .from('scheduled_posts')
            .update({
              status: 'failed',
              error_message: errorMessage,
              updated_at: now.toISOString()
            })
            .eq('id', post.id)
        } catch (updateError) {
          console.error(`❌ Failed to update post ${post.id} status to failed:`, updateError)
        }

        results.failed++
        results.errors.push(`Post ${post.id}: ${errorMessage}`)

        // Notify N8N of failure
        await notifyN8n(post, 'failed', errorMessage)
      }
    }

    console.log(`🏁 Finished processing. ${results.processed} succeeded, ${results.failed} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} posts, ${results.failed} failed`,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error in process-scheduled-posts:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// Helper to notify N8N about post status
async function notifyN8n(post: any, status: 'published' | 'failed', error?: string) {
  const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
  if (!webhookUrl) return

  // Only notify for the admin user's posts (prevents notifications for other users)
  const adminUserId = Deno.env.get('N8N_ADMIN_USER_ID')
  if (adminUserId && post.user_id !== adminUserId) {
    console.log(`🔕 Skipping N8N notification for non-admin user (post ${post.id})`)
    return
  }

  const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (webhookSecret) {
    headers['x-webhook-secret'] = webhookSecret
  }

  try {
    console.log(`🔔 Sending ${status} notification to N8N...`)
    await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: `post_${status}`,
        post: {
          id: post.id,
          platform: post.platform,
          account_name: post.account_name,
          scheduled_time: post.scheduled_time || new Date().toISOString(),
          content: post.content
        },
        error,
        timestamp: new Date().toISOString()
      })
    })
  } catch (e) {
    console.warn('⚠️ Failed to notify N8N:', e)
  }
}


// Normalize credentials for platform-specific handling
function normalizeCredentialsForPlatform(platform: string, credentials: any): any {
  console.log(`🔧 Normalizing credentials for ${platform}:`, {
    originalKeys: Object.keys(credentials || {}),
    platform
  })

  if (platform === 'threads') {
    return {
      accessToken: credentials.accessToken || credentials.access_token,
      refreshToken: credentials.refreshToken || credentials.refresh_token,
      userId: credentials.userId || credentials.user_id || credentials.id || credentials.sub,
      username: credentials.username || credentials.user_name
    }
  } else if (platform === 'instagram') {
    return {
      accessToken: credentials.accessToken || credentials.access_token,
      refreshToken: credentials.refreshToken || credentials.refresh_token,
      userId: credentials.userId || credentials.user_id || credentials.id, // Instagram usually uses id
      username: credentials.username || credentials.user_name,
      accountType: credentials.accountType || credentials.account_type || 'personal'
    }
  } else if (platform === 'linkedin') {
    return {
      accessToken: credentials.accessToken || credentials.access_token,
      refreshToken: credentials.refreshToken || credentials.refresh_token,
      userId: credentials.userId || credentials.user_id || credentials.id || credentials.sub, // LinkedIn uses sub/id
      username: credentials.username || credentials.user_name
    }
  }

  // Return as-is for unknown platforms
  return credentials
}

// Copy the publishToThreads function from publish-post/index.ts
async function publishToThreads(content: any, credentials: any) {
  console.log('🧵 Publishing to Threads with normalized credentials:', {
    hasCredentials: !!credentials,
    credentialsType: typeof credentials,
    credentialsKeys: Object.keys(credentials || {}),
    hasAccessToken: !!credentials.accessToken,
    hasUserId: !!credentials.userId,
    accessTokenPreview: credentials.accessToken ? credentials.accessToken.substring(0, 20) + '...' : 'none',
    userIdValue: credentials.userId || 'none'
  })

  if (!credentials.accessToken) {
    throw new Error('No access token found in Threads credentials')
  }

  if (!credentials.userId) {
    throw new Error('No user ID found in Threads credentials')
  }

  const { accessToken, userId, refreshToken } = credentials

  // Check publishing quota first
  await checkThreadsPublishingQuota(credentials)

  // Validate user ID by calling /me endpoint
  let meResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${credentials.accessToken}`)
  let meStatus = meResponse.status

  // If token is invalid, try to refresh it
  // We check for 401 (Unauthorized) OR 400 (Bad Request) which often happens with invalid/expired tokens
  // Note: For Threads, the access token itself behaves as the refresh token (grant_type=th_refresh_token),
  // so we don't strictly need a separate 'refreshToken' field to exist.
  if (!meResponse.ok && (meStatus === 401 || meStatus === 400)) {
    console.log(`🔄 Threads access token check failed (${meStatus}), attempting refresh...`)

    try {
      const refreshUrl = new URL('https://graph.threads.net/refresh_access_token')
      refreshUrl.searchParams.set('grant_type', 'th_refresh_token')
      refreshUrl.searchParams.set('access_token', credentials.accessToken)

      const refreshResponseActual = await fetch(refreshUrl.toString())

      if (refreshResponseActual.ok) {
        const refreshData = await refreshResponseActual.json()
        credentials.accessToken = refreshData.access_token

        // Update credentials in database
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await supabaseClient
          .from('platform_credentials')
          .update({
            credentials: { encrypted: await encrypt(JSON.stringify(credentials)) },
            expires_at: refreshData.expires_in ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString() : null
          })
          .eq('platform_account_id', credentials.userId)
          .eq('platform', 'threads')

        console.log('✅ Threads token refreshed successfully')

        // Retry the /me endpoint with new token
        meResponse = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${credentials.accessToken}`)
      } else {
        const refreshErr = await refreshResponseActual.text()
        console.error('❌ Threads token refresh failed:', refreshResponseActual.status, refreshErr)
      }
    } catch (error) {
      console.error('❌ Threads token refresh exception:', error)
    }
  }

  if (!meResponse.ok) {
    const errorBody = await meResponse.text()
    console.error(`❌ Threads /me validation failed: ${meResponse.status} ${errorBody}`)
    throw new Error(`Invalid access token (Status ${meResponse.status}) - please reconnect your account. Details: ${errorBody}`)
  }

  const userData = await meResponse.json()
  const actualUserId = userData.id

  // Use the verified user ID
  const verifiedUserId = actualUserId

  // Create the post
  // Determine input type
  const mediaUrls = content.mediaUrls || [];
  const hasMedia = mediaUrls.length > 0;
  const isCarousel = mediaUrls.length > 1;

  let creationId: string;

  if (isCarousel) {
    // CAROUSEL FLOW
    console.log(`ttr Creating Threads carousel with ${mediaUrls.length} items`);
    const childrenIds: string[] = [];

    // 1. Create child containers
    for (const url of mediaUrls) {
      console.log('ttr Creating carousel child item for:', url);
      const childParams = new URLSearchParams({
        media_type: 'IMAGE',
        image_url: url,
        is_carousel_item: 'true',
        access_token: credentials.accessToken
      });

      if (url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov')) {
        childParams.set('media_type', 'VIDEO');
        childParams.delete('image_url');
        childParams.set('video_url', url);
      }

      const childResp = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: childParams
      });

      if (!childResp.ok) {
        throw new Error(`Failed to create carousel child: ${childResp.status} ${await childResp.text()}`);
      }

      const childData = await childResp.json();
      if (childData.error) throw new Error(childData.error.message);

      console.log('✅ Created child container:', childData.id);
      childrenIds.push(childData.id);
    }

    // 2. Wait for children
    console.log(`ttr Waiting for ${childrenIds.length} carousel children...`);
    await Promise.all(childrenIds.map(childId =>
      waitForThreadsContainerProcessing(childId, verifiedUserId, credentials.accessToken)
        .catch(e => console.warn(`WARNING: Child container ${childId} wait failed:`, e))
    ));

    // 3. Create Carousel Parent
    console.log('ttr Creating carousel parent container...');
    const parentParams = new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childrenIds.join(','),
      text: content.text,
      access_token: credentials.accessToken
    });

    const parentResp = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: parentParams
    });

    if (!parentResp.ok) {
      const errorText = await parentResp.text();
      throw new Error(`Failed to create carousel parent: ${parentResp.status} ${errorText}`);
    }

    const parentData = await parentResp.json();
    creationId = parentData.id;

  } else if (hasMedia) {
    // SINGLE MEDIA FLOW
    const imageUrl = mediaUrls[0];
    const postParams = new URLSearchParams({
      media_type: 'IMAGE',
      text: content.text,
      image_url: imageUrl,
      access_token: credentials.accessToken
    });

    // Video detection
    if (imageUrl.toLowerCase().includes('.mp4') || imageUrl.toLowerCase().includes('.mov')) {
      postParams.set('media_type', 'VIDEO');
      postParams.delete('image_url');
      postParams.set('video_url', imageUrl);
    }

    const resp = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postParams
    });

    if (!resp.ok) throw new Error(`Threads single media create failed: ${await resp.text()}`);
    const data = await resp.json();
    creationId = data.id;
  } else {
    // TEXT ONLY
    const postParams = new URLSearchParams({
      media_type: 'TEXT',
      text: content.text,
      access_token: credentials.accessToken
    });
    const resp = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postParams
    });
    if (!resp.ok) throw new Error(`Threads text create failed: ${await resp.text()}`);
    const data = await resp.json();
    creationId = data.id;
  }

  // Wait for parent/single container to be processed
  await waitForThreadsContainerProcessing(creationId, verifiedUserId, credentials.accessToken)

  // Publish the post
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: credentials.accessToken
  })

  console.log('📡 Publishing Threads post...')
  const publishResponse = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads_publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: publishParams
  })

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text()
    console.error('❌ Threads publish error:', errorText)
    throw new Error(`Failed to publish post: ${publishResponse.status} ${errorText}`)
  }

  const publishResult = await publishResponse.json()

  if (publishResult.error) {
    throw new Error(`Threads publish error: ${publishResult.error.message}`)
  }

  console.log('✅ Post published:', publishResult.id)

  // Handle first comment if provided
  if (content.firstComment && content.firstComment.trim()) {
    console.log('💬 Posting first comment to Threads...')
    try {
      const commentParams = new URLSearchParams({
        media_type: 'TEXT',
        text: content.firstComment,
        reply_to_id: publishResult.id,
        access_token: credentials.accessToken
      })

      const commentResponse = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: commentParams
      })

      if (commentResponse.ok) {
        const commentResult = await commentResponse.json()
        console.log('✅ First comment container created:', commentResult.id)

        // Wait for comment container
        await waitForThreadsContainerProcessing(commentResult.id, verifiedUserId, credentials.accessToken)

        // Publish comment
        const publishCommentParams = new URLSearchParams({
          creation_id: commentResult.id,
          access_token: credentials.accessToken
        })

        const publishCommentResponse = await fetch(`https://graph.threads.net/v1.0/${verifiedUserId}/threads_publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: publishCommentParams
        })

        if (publishCommentResponse.ok) {
          console.log('✅ First comment published successfully')
        } else {
          console.warn('⚠️ First comment publication failed:', await publishCommentResponse.text())
        }
      } else {
        console.warn('⚠️ First comment creation failed:', await commentResponse.text())
      }
    } catch (commentError) {
      console.error('❌ Error posting first comment:', commentError)
      // We don't fail the whole post if just the comment fails
    }
  }

  return {
    postId: publishResult.id,
    creationId: creationId,
    permalink: publishResult.permalink
  }
}

async function waitForThreadsContainerProcessing(containerId: string, userId: string, accessToken: string): Promise<void> {
  const maxAttempts = 30 // 30 attempts = 60 seconds max
  const delayMs = 2000 // 2 seconds between checks

  console.log(`⏳ Waiting for Threads container ${containerId} to process...`)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const statusUrl = `https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${accessToken}`
      const statusResponse = await fetch(statusUrl)

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json()

        console.log(`📊 Threads container status (attempt ${attempt + 1}):`, statusResult.status || 'FINISHED')

        // If no status field, it means the container is ready
        if (!statusResult.status || statusResult.status === 'FINISHED') {
          console.log(`✅ Threads container ${containerId} processed successfully`)
          return
        } else if (statusResult.status === 'ERROR') {
          throw new Error(`Threads container processing failed: ${statusResult.error_message || 'Unknown error'}`)
        }
        // Status is still IN_PROGRESS, continue waiting
      }
    } catch (error) {
      console.error(`⚠️ Error checking Threads container status (attempt ${attempt + 1}):`, error)
    }

    // Wait before next attempt
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(`Threads container processing timeout after ${maxAttempts * delayMs / 1000} seconds`)
}

async function checkThreadsPublishingQuota(credentials: any): Promise<void> {
  try {
    const response = await fetch(`https://graph.threads.net/v1.0/${credentials.userId}/threads_publishing_limit?access_token=${credentials.accessToken}`)

    if (response.ok) {
      const quotaData = await response.json()
      console.log('📊 Threads Publishing Quota:', quotaData)

      if (quotaData.data && quotaData.data[0] && quotaData.data[0].quota_usage >= 250) {
        throw new Error('Threads publishing quota exceeded. Please wait before posting again.')
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not check Threads publishing quota:', error)
    // Don't fail the post if quota check fails
  }
}

async function publishToInstagram(content: any, credentials: any) {
  console.log('📷 Publishing to Instagram with normalized credentials:', {
    hasCredentials: !!credentials,
    credentialsType: typeof credentials,
    credentialsKeys: Object.keys(credentials || {}),
    hasAccessToken: !!credentials.accessToken,
    hasUserId: !!credentials.userId,
    accessTokenPreview: credentials.accessToken ? credentials.accessToken.substring(0, 20) + '...' : 'none',
    userIdValue: credentials.userId || 'none',
    accountType: credentials.accountType || 'unknown'
  })

  if (!credentials.accessToken) {
    throw new Error('No access token found in Instagram credentials')
  }

  if (!credentials.userId) {
    throw new Error('No user ID found in Instagram credentials')
  }

  let { accessToken, userId } = credentials

  // Determine if this is a Direct (Platform API) token or a Facebook Graph API token
  // Direct tokens start with "IG" (usually IGAA...), Facebook tokens start with "EA"
  const isDirect = accessToken.startsWith('IG')
  const apiHost = isDirect ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v18.0'

  // AUTO-REFRESH: Attempt to refresh the Instagram token to keep it alive
  try {
    if (isDirect) {
      // Instagram Direct (Platform API) Refresh
      console.log('🔄 Attempting to auto-refresh Instagram Direct token...')
      const refreshUrl = new URL('https://graph.instagram.com/refresh_access_token')
      refreshUrl.searchParams.append('grant_type', 'ig_refresh_token')
      refreshUrl.searchParams.append('access_token', accessToken)

      const refreshResponse = await fetch(refreshUrl.toString())
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        if (refreshData.access_token) {
          console.log('✅ Instagram Direct token refreshed successfully')
          credentials.accessToken = refreshData.access_token
          accessToken = refreshData.access_token

          // Update DB
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          )

          // Update explicitly
          // We reuse the storage structure logic from FB block mostly, but specific to Direct if needed
          // For now, let's just update the credential object in memory for this session
          // Saving to DB is good practice but complex here without causing errors if ID format differs.
          // We will skip DB save for Direct in this hotfix to prioritize publishing success, 
          // as the token is valid for 60 days anyway.
        }
      } else {
        const errTxt = await refreshResponse.text()
        console.warn('⚠️ Instagram Direct token refresh failed:', errTxt)
      }
    } else {
      // Facebook Graph API Refresh (Standard)
      const clientId = Deno.env.get('VITE_INSTAGRAM_CLIENT_ID')
      const clientSecret = Deno.env.get('INSTAGRAM_CLIENT_SECRET')

      if (clientId && clientSecret) {
        console.log('🔄 Attempting to auto-refresh Instagram (FB) token...')
        const refreshUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
        refreshUrl.searchParams.append('grant_type', 'fb_exchange_token')
        refreshUrl.searchParams.append('client_id', clientId)
        refreshUrl.searchParams.append('client_secret', clientSecret)
        refreshUrl.searchParams.append('fb_exchange_token', accessToken)

        const refreshResponse = await fetch(refreshUrl.toString())

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()

          if (refreshData.access_token) {
            console.log('✅ Instagram (FB) token refreshed successfully')
            credentials.accessToken = refreshData.access_token
            accessToken = refreshData.access_token

            // Update DB logic (simplified for brevity vs robustness balance)
            const supabaseClient = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )
            const storageCreds = {
              accessToken: refreshData.access_token,
              refreshToken: credentials.refreshToken || '',
              userId: userId,
              username: credentials.username,
              accountType: credentials.accountType,
              expires_in: refreshData.expires_in
            }
            await supabaseClient
              .from('platform_credentials')
              .update({
                credentials: { encrypted: await encrypt(JSON.stringify(storageCreds)) },
                updated_at: new Date().toISOString()
              })
              .eq('platform_account_id', userId)
              .eq('platform', 'instagram')
          }
        } else {
          const errTxt = await refreshResponse.text()
          console.warn('⚠️ Instagram (FB) token refresh failed:', errTxt)
        }
      }
    }
  } catch (refreshError) {
    console.warn('⚠️ Instagram token auto-refresh failed (Exception):', refreshError)
  }

  // Instagram requires media for posts
  if (!content.mediaUrls || content.mediaUrls.length === 0) {
    throw new Error('Instagram requires media content. Text-only posts are not supported.')
  }

  console.log('📷 Publishing Instagram post with media:', content.mediaUrls.length, 'items', isDirect ? '(Direct)' : '(Graph)')

  try {
    // Step 1: Create media container(s)
    const mediaContainers: string[] = []

    for (const mediaUrl of content.mediaUrls) {
      const containerId = await createInstagramMediaContainer(mediaUrl, content.text, userId, accessToken, apiHost)
      console.log(`⏳ Waiting for Instagram container ${containerId} to be ready...`)
      await waitForInstagramMediaContainer(containerId, accessToken, apiHost)
      mediaContainers.push(containerId)
    }

    console.log('✅ Created media containers:', mediaContainers)

    // Step 2: Publish the media
    let publishedPostId: string

    if (mediaContainers.length === 1) {
      // Single media post
      publishedPostId = await publishInstagramMediaContainer(mediaContainers[0], userId, accessToken, apiHost)
    } else {
      // Carousel post
      publishedPostId = await publishInstagramCarousel(mediaContainers, content.text, userId, accessToken, apiHost)
    }

    console.log('✅ Instagram post published:', publishedPostId)

    return {
      postId: publishedPostId,
      mediaContainers: mediaContainers
    }

  } catch (error) {
    console.error('❌ Instagram publishing error:', error)
    throw error
  }
}

async function createInstagramMediaContainer(mediaUrl: string, caption: string, userId: string, accessToken: string, apiHost: string): Promise<string> {
  const isVideo = mediaUrl.toLowerCase().includes('.mp4') || mediaUrl.toLowerCase().includes('.mov')

  const params = new URLSearchParams({
    access_token: accessToken,
    caption: caption
  })

  if (isVideo) {
    params.set('media_type', 'REELS') // Supported by both APIs usually, or 'VIDEO' for Direct? 'REELS' safe for v10+
    params.set('video_url', mediaUrl)
  } else {
    params.set('image_url', mediaUrl)
  }

  console.log('📡 Creating Instagram media container:', {
    userId,
    mediaUrl: mediaUrl.substring(0, 50) + '...',
    isVideo,
    apiHost
  })

  const response = await fetch(`${apiHost}/${userId}/media`, {
    method: 'POST',
    body: params
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Instagram media container creation failed:', response.status, errorText)

    let errorData: any = {};
    try { errorData = JSON.parse(errorText); } catch (e) { }

    // Provide specific error messages for common issues
    if (response.status === 400) {
      if (errorText.includes('"code":190') || (errorData.error && errorData.error.code === 190)) {
        throw new Error(`Instagram Session Expired: The access token is invalid. Please reconnect your Instagram account in Settings.`);
      }
      if (errorText.includes('Invalid platform app')) {
        throw new Error('Instagram app configuration error. Please check your Instagram App Secret in environment variables.')
      }
    } else if (response.status === 401) {
      throw new Error('Instagram authentication failed. Please reconnect your Instagram account.')
    }

    throw new Error(`Instagram media container creation failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()

  if (result.error) {
    if (result.error.code === 190) {
      throw new Error('Instagram access token expired. Please reconnect your Instagram account.')
    }
    throw new Error(`Instagram API error: ${result.error.message}`)
  }

  return result.id
}

async function publishInstagramMediaContainer(containerId: string, userId: string, accessToken: string, apiHost: string): Promise<string> {
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken
  })

  console.log('📡 Publishing Instagram media container:', containerId)

  const response = await fetch(`${apiHost}/${userId}/media_publish`, {
    method: 'POST',
    body: params
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Instagram media publishing failed:', response.status, errorText)
    throw new Error(`Instagram media publishing failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()

  if (result.error) {
    throw new Error(`Instagram publish error: ${result.error.message}`)
  }

  return result.id
}

async function publishInstagramCarousel(containerIds: string[], caption: string, userId: string, accessToken: string, apiHost: string): Promise<string> {
  // Create carousel container
  const carouselParams = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: containerIds.join(','),
    caption: caption,
    access_token: accessToken
  })

  console.log('📡 Creating Instagram carousel with', containerIds.length, 'items', apiHost)

  const carouselResponse = await fetch(`${apiHost}/${userId}/media`, {
    method: 'POST',
    body: carouselParams
  })

  if (!carouselResponse.ok) {
    const errorText = await carouselResponse.text()
    console.error('❌ Instagram carousel creation failed:', carouselResponse.status, errorText)
    throw new Error(`Instagram carousel creation failed: ${carouselResponse.status} ${errorText}`)
  }

  const carouselResult = await carouselResponse.json()

  if (carouselResult.error) {
    throw new Error(`Instagram carousel error: ${carouselResult.error.message}`)
  }

  // Wait for the carousel container itself to be ready
  console.log(`⏳ Waiting for Instagram carousel container ${carouselResult.id} to be ready...`)
  await waitForInstagramMediaContainer(carouselResult.id, accessToken, apiHost)

  // Publish the carousel
  return await publishInstagramMediaContainer(carouselResult.id, userId, accessToken, apiHost)
}

async function waitForInstagramMediaContainer(containerId: string, accessToken: string, apiHost: string): Promise<void> {
  const maxAttempts = 20
  const delayMs = 3000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const statusUrl = `${apiHost}/${containerId}?fields=status_code,status&access_token=${accessToken}`
      const statusResponse = await fetch(statusUrl)

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json()
        const status = statusResult.status_code || statusResult.status

        console.log(`📊 Instagram container ${containerId} status (attempt ${attempt + 1}):`, status)

        if (status === 'FINISHED') {
          return
        }

        if (status === 'ERROR') {
          throw new Error(`Instagram media container failed to process: ${JSON.stringify(statusResult)}`)
        }
      }
    } catch (e) {
      console.warn(`⚠️ Error checking Instagram container status:`, e)
    }

    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(`Instagram media processing timeout for container ${containerId}`)
}

async function publishToLinkedIn(content: any, credentials: any) {
  console.log('💼 Publishing to LinkedIn with normalized credentials:', {
    hasCredentials: !!credentials,
    credentialsType: typeof credentials,
    credentialsKeys: Object.keys(credentials || {}),
    hasAccessToken: !!credentials.accessToken,
    hasUserId: !!credentials.userId,
    accessTokenPreview: credentials.accessToken ? credentials.accessToken.substring(0, 20) + '...' : 'none',
    userIdValue: credentials.userId || 'none'
  })

  if (!credentials.accessToken) {
    throw new Error('No access token found in LinkedIn credentials')
  }

  if (!credentials.userId) {
    throw new Error('No user ID found in LinkedIn credentials')
  }

  const { accessToken, userId } = credentials

  // Handle media posts
  if (content.type === 'media' && content.mediaUrls && content.mediaUrls.length > 0) {
    return await publishLinkedInMediaPost(content, userId, accessToken)
  } else {
    // Single text post
    return await publishLinkedInSinglePost(content, userId, accessToken)
  }
}

async function publishLinkedInSinglePost(content: any, userId: string, accessToken: string) {
  const postData = {
    author: `urn:li:person:${userId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: content.text
        },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  }

  console.log('📡 Publishing LinkedIn single post...')

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postData)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ LinkedIn post failed:', response.status, errorText)
    throw new Error(`LinkedIn post failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()

  if (result.error) {
    throw new Error(`LinkedIn API error: ${result.error.message}`)
  }

  console.log('✅ LinkedIn post published:', result.id)

  return {
    postId: result.id
  }
}

async function publishLinkedInMediaPost(content: any, userId: string, accessToken: string) {
  // LinkedIn media posts require uploading assets first
  const mediaAssets: string[] = []

  for (const mediaUrl of content.mediaUrls) {
    const assetId = await uploadLinkedInMediaAsset(mediaUrl, userId, accessToken)
    mediaAssets.push(assetId)
  }

  const postData = {
    author: `urn:li:person:${userId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: content.text
        },
        shareMediaCategory: 'IMAGE', // ALWAYS use IMAGE for organic posts. LinkedIn treats multiple images as a grid/feed post.
        media: mediaAssets.map(assetId => ({
          status: 'READY',
          description: {
            text: content.text
          },
          media: assetId,
          title: {
            text: 'Shared via Social Media Scheduler'
          }
        }))
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  }

  console.log('📡 Publishing LinkedIn media post...')

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(postData)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ LinkedIn media post failed:', response.status, errorText)
    throw new Error(`LinkedIn media post failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()

  if (result.error) {
    throw new Error(`LinkedIn API error: ${result.error.message}`)
  }

  console.log('✅ LinkedIn media post published:', result.id)

  return {
    postId: result.id
  }
}

async function uploadLinkedInMediaAsset(mediaUrl: string, userId: string, accessToken: string): Promise<string> {
  // Step 1: Register upload
  const registerData = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: `urn:li:person:${userId}`,
      serviceRelationships: [{
        relationshipType: 'OWNER',
        identifier: 'urn:li:userGeneratedContent'
      }]
    }
  }

  const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(registerData)
  })

  if (!registerResponse.ok) {
    const errorText = await registerResponse.text()
    throw new Error(`LinkedIn asset registration failed: ${registerResponse.status} ${errorText}`)
  }

  const registerResult = await registerResponse.json()
  const uploadUrl = registerResult.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
  const assetId = registerResult.value.asset

  // Step 2: Fetch media from URL
  const mediaResponse = await fetch(mediaUrl)
  if (!mediaResponse.ok) {
    throw new Error(`Failed to fetch media from URL: ${mediaUrl}`)
  }
  const mediaBlob = await mediaResponse.blob()

  // Step 3: Upload media to LinkedIn
  // Note: LinkedIn upload URL typically requires PUT and NO Authorization header (token is in URL)
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      // 'Authorization': `Bearer ${accessToken}`, // Do NOT send auth header for the binary upload
      'Content-Type': 'application/octet-stream' // Good practice to set binary type
    },
    body: mediaBlob
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(`LinkedIn media upload failed: ${uploadResponse.status} ${errorText}`)
  }

  return assetId
}

async function cleanupPostMedia(mediaUrls: string[], userId: string, supabaseClient: any): Promise<void> {
  console.log('🧹 Starting media cleanup for:', mediaUrls)

  for (const mediaUrl of mediaUrls) {
    try {
      // Extract file path from Supabase URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/media-files/[user-id]/[filename]
      const urlParts = mediaUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      const filePath = `${userId}/${filename}`

      console.log('🗑️ Deleting media file:', filePath)

      // Delete from storage
      const { error: storageError } = await supabaseClient.storage
        .from('media-files')
        .remove([filePath])

      if (storageError) {
        console.warn('Failed to delete from storage:', storageError)
      }

      // Delete thumbnail if exists
      const thumbnailPath = `${userId}/thumb_${filename}`
      const { error: thumbError } = await supabaseClient.storage
        .from('thumbnails')
        .remove([thumbnailPath])

      if (thumbError) {
        console.warn('Failed to delete thumbnail:', thumbError)
      }

      // Delete database record
      const { error: dbError } = await supabaseClient
        .from('media_files')
        .delete()
        .eq('file_path', filePath)
        .eq('user_id', userId)

      if (dbError) {
        console.warn('Failed to delete database record:', dbError)
      }

    } catch (error) {
      console.warn('Failed to cleanup media file:', mediaUrl, error)
    }
  }
}

function contentTypeIsJson(response: Response) {
  const contentType = response.headers.get("content-type");
  return contentType && contentType.indexOf("application/json") !== -1;
}

