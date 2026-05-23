import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    // Use getSession but for Edge Functions we often just verify the JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const { platform, platformAccountId, action } = body

    if (platform !== 'threads') {
      throw new Error('Currently only Threads is supported for Community view')
    }

    // Get credentials
    const { data: credentialRow, error: credError } = await supabaseClient
      .from('platform_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .eq('platform_account_id', platformAccountId)
      .single()

    if (credError || !credentialRow) throw new Error('Credentials not found')

    let credentials = credentialRow.credentials
    if (credentials.encrypted) {
      credentials = await decryptCredentials(credentials.encrypted)
    }

    const accessToken = credentials.accessToken || credentials.access_token

    if (req.method === 'GET' || (req.method === 'POST' && action === 'fetch')) {
      // Fetch interactions
      const threads = await fetchThreadsData(accessToken, platformAccountId)
      return new Response(JSON.stringify(threads), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (req.method === 'POST' && action === 'reply') {
      const { parentId, text } = body
      const result = await postThreadsReply(accessToken, platformAccountId, parentId, text)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

async function decryptCredentials(encryptedText: string): Promise<any> {
  const encryptionKey = Deno.env.get('VITE_CREDENTIAL_ENCRYPTION_KEY')
  if (!encryptionKey) throw new Error('Missing encryption key')

  const combined = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyMaterial, encrypted)
  return JSON.parse(new TextDecoder().decode(decrypted))
}

async function fetchThreadsData(accessToken: string, userId: string) {
  // 1. Fetch my threads
  const myThreadsResp = await fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp,permalink,media_url,media_type,shortcode,username&access_token=${accessToken}`)
  const myThreads = await myThreadsResp.json()

  // 2. Fetch mentions
  // Note: /me/mentions is available in the Threads API
  const mentionsResp = await fetch(`https://graph.threads.net/v1.0/me/mentions?fields=id,text,timestamp,permalink,media_url,media_type,username&access_token=${accessToken}`)
  const mentions = await mentionsResp.json()

  const allRootPosts = [...(myThreads.data || []), ...(mentions.data || [])]
  
  // Deduplicate and sort
  const uniquePosts = Array.from(new Map(allRootPosts.map(p => [p.id, p])).values())
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // 3. For each post, fetch its conversation
  const results = await Promise.all(uniquePosts.map(async (post: any) => {
    const convResp = await fetch(`https://graph.threads.net/v1.0/${post.id}/conversation?fields=id,text,timestamp,username,permalink,media_url,media_type,replied_to&access_token=${accessToken}`)
    const convData = await convResp.json()
    
    return {
      rootPost: mapInteraction(post, userId),
      interactions: (convData.data || []).map((i: any) => mapInteraction(i, userId))
    }
  }))

  return results
}


async function waitForThreadsContainerProcessing(containerId: string, accessToken: string): Promise<void> {
  const maxAttempts = 15 // 30 seconds max for replies
  const delayMs = 2000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const statusUrl = `https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${accessToken}`
      const statusResponse = await fetch(statusUrl)
      if (statusResponse.ok) {
        const result = await statusResponse.json()
        if (!result.status || result.status === 'FINISHED') return
        if (result.status === 'ERROR') throw new Error(result.error_message || 'Processing failed')
      }
    } catch (e) { console.warn(e) }
    await new Promise(r => setTimeout(r, delayMs))
  }
}

async function postThreadsReply(accessToken: string, userId: string, parentId: string, text: string) {
  const postParams = new URLSearchParams({
    media_type: 'TEXT',
    text: text,
    reply_to_id: parentId,
    access_token: accessToken
  });

  const resp = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: postParams
  });

  if (!resp.ok) throw new Error(`Threads reply create failed: ${await resp.text()}`);
  const { id: creationId } = await resp.json();

  await waitForThreadsContainerProcessing(creationId, accessToken);

  const publishResp = await fetch(`https://graph.threads.net/v1.0/me/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: creationId, access_token: accessToken })
  });

  if (!publishResp.ok) throw new Error(`Threads reply publish failed: ${await publishResp.text()}`);
  return await publishResp.json();
}

function mapInteraction(i: any, myUserId: string) {
  return {
    id: i.id,
    platform: 'threads',
    authorUsername: i.username,
    text: i.text,
    timestamp: i.timestamp,
    mediaUrl: i.media_url,
    mediaType: i.media_type,
    parentId: i.replied_to?.id ?? i.parent_id,
    permalink: i.permalink,
    platformPostId: i.id,
    isOwn: i.username === 'me' || i.user_id === myUserId
  }
}

