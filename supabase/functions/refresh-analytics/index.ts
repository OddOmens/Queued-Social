import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-scheduler-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SCHEDULER_SECRET = Deno.env.get('SCHEDULER_SECRET') ?? ''

// Only request fields that the Threads /me/threads endpoint actually supports.
// Engagement metrics (views, likes, etc.) are NOT available as direct post fields —
// they must be fetched per-post via the /insights endpoint.
const THREADS_POST_FIELDS = 'id,text,timestamp,media_type,media_url,permalink,is_reply'

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function decryptCredentials(encryptedText: string, encryptionKey: string): Promise<string> {
    const combined = new Uint8Array(
        atob(encryptedText).split('').map(c => c.charCodeAt(0))
    )
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    )
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyMaterial, encrypted)
    return new TextDecoder().decode(decrypted)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncResult {
    userId: string
    synced: number
    updated: number
    skipped: number   // posts older than 90 days — analytics preserved as-is
    errors: string[]
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

async function resolveCredential(
    cred: any,
    encryptionKey: string
): Promise<any | null> {
    let decrypted: any = cred.credentials

    if (cred.credentials?.encrypted) {
        if (!encryptionKey) return null
        try {
            decrypted = JSON.parse(
                await decryptCredentials(cred.credentials.encrypted, encryptionKey)
            )
        } catch (e) {
            return null
        }
    }

    const accessToken = decrypted.accessToken || decrypted.access_token
    if (!accessToken) return null

    return {
        accessToken,
        userId: decrypted.userId || decrypted.user_id || cred.platform_account_id,
        accountName: cred.account_name || decrypted.username || 'Account',
        platformAccountId: String(cred.platform_account_id),
    }
}

async function syncUser(supabase: any, userId: string, encryptionKey: string): Promise<SyncResult> {
    const result: SyncResult = { userId, synced: 0, updated: 0, skipped: 0, errors: [] }
    
    const { data: creds } = await supabase
        .from('platform_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

    if (!creds) return result

    for (const cred of creds) {
        try {
            const resolved = await resolveCredential(cred, encryptionKey)
            if (!resolved) continue

            if (cred.platform === 'threads') {
                await syncThreads(supabase, userId, resolved, result)
            } else if (cred.platform === 'instagram') {
                await syncInstagram(supabase, userId, resolved, result)
            } else if (cred.platform === 'linkedin') {
                await syncLinkedIn(supabase, userId, resolved, result)
            }
        } catch (e: any) {
            result.errors.push(`${cred.platform}: ${e.message}`)
        }
    }
    return result
}

async function fetchThreadsInsights(postId: string, accessToken: string) {
    const url = `https://graph.threads.net/v1.0/${postId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${accessToken}`
    const resp = await fetch(url)
    if (!resp.ok) {
        const errBody = await resp.text().catch(() => '(unreadable)')
        console.error(`[insights] ${postId} HTTP ${resp.status}: ${errBody}`)
        return { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 }
    }

    const json = await resp.json()
    const { data } = json
    if (!data) {
        console.error(`[insights] ${postId} unexpected response:`, JSON.stringify(json))
    }
    const getVal = (name: string): number =>
        (data || []).find((m: any) => m.name === name)?.values?.[0]?.value ?? 0

    return {
        views:   getVal('views'),
        likes:   getVal('likes'),
        replies: getVal('replies'),
        reposts: getVal('reposts'),
        quotes:  getVal('quotes'),
    }
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

async function syncThreadsPost(supabase: any, userId: string, cred: any, post: any, result: SyncResult) {
    const now        = new Date().toISOString()
    const postAgeMs  = Date.now() - new Date(post.timestamp).getTime()
    const isOld      = postAgeMs > NINETY_DAYS_MS

    // 1. Try to find by platform_post_id (most common case)
    const { data: byId } = await supabase
        .from('scheduled_posts')
        .select('id, analytics')
        .eq('user_id', userId)
        .eq('platform_post_id', post.id)
        .limit(1)

    if (byId?.[0]) {
        if (isOld) {
            // Post is older than 90 days — preserve existing analytics, never overwrite with stale data
            result.skipped = (result.skipped ?? 0) + 1
            return
        }

        const metrics   = await fetchThreadsInsights(post.id, cred.accessToken)
        const analytics = {
            ...metrics,
            is_reply:     post.is_reply === true,
            media_type:   post.media_type || 'TEXT',
            permalink:    post.permalink ?? null,
            refreshed_at: now,
        }

        // Update ALL matching rows (cleans up any pre-existing duplicates)
        await supabase
            .from('scheduled_posts')
            .update({ analytics, updated_at: now })
            .eq('user_id', userId)
            .eq('platform_post_id', post.id)
        result.updated++
        return
    }

    // Old post not in DB yet — skip it entirely, no point inserting with stale data
    if (isOld) {
        result.skipped = (result.skipped ?? 0) + 1
        return
    }

    // Fetch fresh insights for this new (< 90 day) post
    const metrics   = await fetchThreadsInsights(post.id, cred.accessToken)
    const analytics = {
        ...metrics,
        is_reply:     post.is_reply === true,
        media_type:   post.media_type || 'TEXT',
        permalink:    post.permalink ?? null,
        refreshed_at: now,
    }

    // 2. Try to match a row published via the app that doesn't have platform_post_id yet
    const postTime = new Date(post.timestamp)
    const { data: byTime } = await supabase
        .from('scheduled_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', 'threads')
        .eq('platform_account_id', cred.userId)
        .is('platform_post_id', null)
        .gte('published_at', new Date(postTime.getTime() - 5 * 60_000).toISOString())
        .lte('published_at', new Date(postTime.getTime() + 5 * 60_000).toISOString())
        .limit(1)

    if (byTime?.[0]) {
        await supabase
            .from('scheduled_posts')
            .update({ platform_post_id: post.id, analytics, updated_at: now })
            .eq('id', byTime[0].id)
        result.updated++
        return
    }

    // 3. Not found at all — insert as a newly-discovered post
    const { error: insertErr } = await supabase.from('scheduled_posts').insert({
        user_id:             userId,
        platform:            'threads',
        platform_account_id: cred.userId,
        account_name:        cred.accountName,
        content: {
            text:      post.text || '',
            mediaUrls: post.media_url ? [post.media_url] : [],
            type:      ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].includes(post.media_type) ? 'media' : 'single',
        },
        status:           'published',
        published_at:     post.timestamp,
        platform_post_id: post.id,
        analytics,
        created_at:  now,
        updated_at:  now,
    })

    if (!insertErr || insertErr.message.includes('duplicate') || insertErr.message.includes('unique')) {
        result.synced++
    }
}

async function syncThreads(supabase: any, userId: string, cred: any, result: SyncResult) {
    const resp = await fetch(
        `https://graph.threads.net/v1.0/me/threads?fields=${THREADS_POST_FIELDS}&limit=50&access_token=${cred.accessToken}`
    )
    if (!resp.ok) throw new Error(await resp.text())
    const { data: posts } = await resp.json()
    if (!posts?.length) return

    // Process in batches of 10 to stay well within Threads API rate limits
    const BATCH = 10
    for (let i = 0; i < posts.length; i += BATCH) {
        await Promise.all(
            posts.slice(i, i + BATCH).map((post: any) =>
                syncThreadsPost(supabase, userId, cred, post, result)
            )
        )
        if (i + BATCH < posts.length) await new Promise(r => setTimeout(r, 300))
    }
}

async function syncInstagram(supabase: any, userId: string, cred: any, result: SyncResult) {
    const resp = await fetch(`https://graph.facebook.com/v22.0/me/media?fields=id,like_count,comments_count,timestamp,permalink,media_type,media_url&limit=50&access_token=${cred.accessToken}`)
    if (!resp.ok) throw new Error(await resp.text())
    const { data } = await resp.json()

    for (const post of (data || [])) {
        const analytics = {
            likes: Number(post.like_count || 0),
            replies: Number(post.comments_count || 0),
            views: 0,
            refreshed_at: new Date().toISOString()
        }
        await updatePostAnalytics(supabase, userId, post.id, analytics, result)
    }
}

async function syncLinkedIn(supabase: any, userId: string, cred: any, result: SyncResult) {
    const { data: posts } = await supabase
        .from('scheduled_posts')
        .select('id, platform_post_id')
        .eq('user_id', userId)
        .eq('platform', 'linkedin')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(50)

    if (!posts || posts.length === 0) return

    const shareIds = posts.map((p: any) => p.platform_post_id).filter(Boolean)
    const urns = shareIds.map((id: string) => `urn:li:share:${id}`).join(',')
    
    const resp = await fetch(`https://api.linkedin.com/v2/socialMetadata?ids=List(${urns})`, {
        headers: { 'Authorization': `Bearer ${cred.accessToken}` }
    })
    
    if (!resp.ok) return

    const { results } = await resp.json()
    for (const platformPostId of shareIds) {
        const meta = results[`urn:li:share:${platformPostId}`]
        if (!meta) continue

        const stats = meta.totalShareStatistics
        const analytics = {
            likes: stats.likeCount || 0,
            replies: stats.commentCount || 0,
            reposts: stats.shareCount || 0,
            views: stats.impressionCount || 0,
            refreshed_at: new Date().toISOString()
        }
        await updatePostAnalytics(supabase, userId, platformPostId, analytics, result)
    }
}

async function updatePostAnalytics(supabase: any, userId: string, platformPostId: string, analytics: any, result: SyncResult) {
    const { data } = await supabase
        .from('scheduled_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('platform_post_id', platformPostId)
        .limit(1)

    if (data?.[0]) {
        await supabase.from('scheduled_posts').update({ analytics, updated_at: new Date().toISOString() }).eq('id', data[0].id)
        result.updated++
    }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

    try {
        const schedulerSecret = req.headers.get('x-scheduler-secret')
        const authHeader = req.headers.get('Authorization')
        const isSchedulerCall = schedulerSecret === SCHEDULER_SECRET

        if (!isSchedulerCall && !authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const encryptionKey = Deno.env.get('VITE_CREDENTIAL_ENCRYPTION_KEY') || Deno.env.get('ENCRYPTION_KEY') || ''

        let userIds: string[]
        if (isSchedulerCall) {
            const { data: rows } = await supabaseClient.from('platform_credentials').select('user_id').eq('is_active', true)
            userIds = [...new Set((rows ?? []).map((r: any) => String(r.user_id)))]
        } else {
            const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader!.replace('Bearer ', ''))
            if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
            userIds = [user.id]
        }

        const syncResults = await Promise.all(userIds.map(uid => syncUser(supabaseClient, uid, encryptionKey)))
        const totalUpdated = syncResults.reduce((sum, r) => sum + r.updated, 0)
        const totalSynced  = syncResults.reduce((sum, r) => sum + r.synced,  0)
        const totalSkipped = syncResults.reduce((sum, r) => sum + r.skipped, 0)

        return new Response(
            JSON.stringify({
                success: true,
                total_updated: totalUpdated,
                total_synced:  totalSynced,
                total_skipped: totalSkipped,
                message: `Updated ${totalUpdated}, added ${totalSynced}, skipped ${totalSkipped} posts older than 90 days.`,
            }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        )
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS })
    }
})
