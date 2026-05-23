import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-scheduler-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SCHEDULER_SECRET = Deno.env.get('SCHEDULER_SECRET') ?? ''

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

// ─── Core Logic ───────────────────────────────────────────────────────────────

async function resolveCredential(cred: any, encryptionKey: string): Promise<any | null> {
    let decrypted: any = cred.credentials

    if (cred.credentials?.encrypted) {
        if (!encryptionKey) return null
        try {
            decrypted = JSON.parse(
                await decryptCredentials(cred.credentials.encrypted, encryptionKey)
            )
        } catch {
            return null
        }
    }

    const accessToken = decrypted.accessToken || decrypted.access_token
    if (!accessToken) return null

    return {
        accessToken,
        platformAccountId: String(cred.platform_account_id),
        accountName: cred.account_name || decrypted.username || 'Account',
        credentialId: cred.id,
    }
}

// Fetch own profile using /me — works with threads_basic scope, no special
// permissions needed. Returns basic identity fields only (no follower count).
async function fetchThreadsMe(accessToken: string): Promise<Record<string, any>> {
    const fields = 'id,username,name,is_verified'
    const url = `https://graph.threads.net/v1.0/me?fields=${fields}&access_token=${accessToken}`
    const resp = await fetch(url)
    const json = await resp.json()

    if (!resp.ok) {
        throw new Error(
            `me fetch failed (HTTP ${resp.status}): ${json?.error?.message || JSON.stringify(json).slice(0, 200)}`
        )
    }

    return json
}

// Fetch user-level insights including follower count.
// followers_count does not support period filtering — returns current total.
// Other engagement metrics use period=day for the current day's totals.
async function fetchThreadsUserInsights(threadsUserId: string, accessToken: string): Promise<{
    followers_count: number
    views_count: number
    likes_count: number
    replies_count: number
    reposts_count: number
    quotes_count: number
}> {
    const empty = { followers_count: 0, views_count: 0, likes_count: 0, replies_count: 0, reposts_count: 0, quotes_count: 0 }
    try {
        const url = `https://graph.threads.net/v1.0/${threadsUserId}/threads_insights?metric=followers_count,views,likes,replies,reposts,quotes&period=day&access_token=${accessToken}`
        const resp = await fetch(url)
        if (!resp.ok) return empty
        const json = await resp.json()
        const getVal = (name: string): number =>
            (json.data || []).find((m: any) => m.name === name)?.total_value?.value ?? 0
        return {
            followers_count: getVal('followers_count'),
            views_count: getVal('views'),
            likes_count: getVal('likes'),
            replies_count: getVal('replies'),
            reposts_count: getVal('reposts'),
            quotes_count: getVal('quotes'),
        }
    } catch {
        return empty
    }
}

async function syncUserProfile(
    supabase: any,
    userId: string,
    encryptionKey: string
): Promise<{ synced: number; errors: string[]; noCredentials: boolean }> {
    const result = { synced: 0, errors: [] as string[], noCredentials: false }

    const { data: creds, error: credsError } = await supabase
        .from('platform_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'threads')
        .eq('is_active', true)

    if (credsError) {
        result.errors.push(`DB error fetching credentials: ${credsError.message}`)
        return result
    }

    if (!creds?.length) {
        result.noCredentials = true
        return result
    }

    for (const cred of creds) {
        const label = cred.account_name || cred.platform_account_id || cred.id
        try {
            const resolved = await resolveCredential(cred, encryptionKey)
            if (!resolved) {
                result.errors.push(`${label}: could not decrypt credentials`)
                continue
            }

            // Fetch own profile via /me (no special permissions needed)
            const me = await fetchThreadsMe(resolved.accessToken)

            // Fetch 7-day aggregate insights (best-effort, zeros if scope missing)
            const insights = await fetchThreadsUserInsights(me.id, resolved.accessToken)

            const today = new Date().toISOString().slice(0, 10)

            // Look up yesterday's follower count to compute net change
            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 1)
            const yesterdayStr = yesterday.toISOString().slice(0, 10)

            const { data: prev } = await supabase
                .from('threads_profile_snapshots')
                .select('follower_count')
                .eq('user_id', userId)
                .eq('platform_account_id', resolved.platformAccountId)
                .eq('snapshot_date', yesterdayStr)
                .maybeSingle()

            const followerCount = typeof insights.followers_count === 'number' ? insights.followers_count : 0
            const netChange = prev ? followerCount - prev.follower_count : 0

            const { error: upsertError } = await supabase
                .from('threads_profile_snapshots')
                .upsert(
                    {
                        user_id: userId,
                        credential_id: resolved.credentialId,
                        platform_account_id: resolved.platformAccountId,
                        account_name: resolved.accountName,
                        username: me.username ?? null,
                        display_name: me.name ?? null,
                        profile_picture_url: me.profile_picture_url ?? null,
                        biography: me.biography ?? null,
                        is_verified: me.is_verified ?? false,
                        follower_count: followerCount,
                        follower_net_change: netChange,
                        likes_count: insights.likes_count,
                        quotes_count: insights.quotes_count,
                        replies_count: insights.replies_count,
                        reposts_count: insights.reposts_count,
                        views_count: insights.views_count,
                        snapshot_date: today,
                        recorded_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id,platform_account_id,snapshot_date' }
                )

            if (upsertError) {
                result.errors.push(`${label}: DB upsert failed — ${upsertError.message}`)
            } else {
                result.synced++
                console.log(
                    `[profile-sync] ${resolved.accountName} (@${me.username}): ${followerCount} followers (${netChange >= 0 ? '+' : ''}${netChange} today)`
                )
            }
        } catch (e: any) {
            result.errors.push(`${label}: ${e.message}`)
        }
    }

    return result
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

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const encryptionKey = Deno.env.get('VITE_CREDENTIAL_ENCRYPTION_KEY') || Deno.env.get('ENCRYPTION_KEY') || ''

        const serviceSupabase = createClient(supabaseUrl, serviceRoleKey)

        let results: Awaited<ReturnType<typeof syncUserProfile>>[]

        if (isSchedulerCall) {
            const { data: rows } = await serviceSupabase
                .from('platform_credentials')
                .select('user_id')
                .eq('platform', 'threads')
                .eq('is_active', true)
            const userIds = [...new Set((rows ?? []).map((r: any) => String(r.user_id)))]
            results = await Promise.all(
                userIds.map(uid => syncUserProfile(serviceSupabase, uid, encryptionKey))
            )
        } else {
            const userSupabase = createClient(supabaseUrl, anonKey, {
                global: { headers: { Authorization: authHeader! } },
            })
            const { data: { user }, error: authError } = await userSupabase.auth.getUser()
            if (authError || !user) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
            }
            results = [await syncUserProfile(userSupabase, user.id, encryptionKey)]
        }

        const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
        const allErrors = results.flatMap(r => r.errors)
        const noCredentials = results.every(r => r.noCredentials)

        let message: string
        if (noCredentials) {
            message = 'No active Threads account found. Connect your Threads account in Settings first.'
        } else if (totalSynced === 0 && allErrors.length > 0) {
            message = `Sync failed: ${allErrors[0]}`
        } else {
            message = `Synced profile for ${totalSynced} Threads account(s).`
        }

        return new Response(
            JSON.stringify({ success: totalSynced > 0, total_synced: totalSynced, errors: allErrors, message }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        )
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: CORS_HEADERS,
        })
    }
})
