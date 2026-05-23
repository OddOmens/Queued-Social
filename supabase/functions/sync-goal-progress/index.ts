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

async function resolveCredential(cred: any, encryptionKey: string): Promise<any | null> {
    let decrypted: any = cred.credentials

    if (cred.credentials?.encrypted) {
        if (!encryptionKey) return null
        try {
            decrypted = JSON.parse(
                await decryptCredentials(cred.credentials.encrypted, encryptionKey)
            )
        } catch (_e) {
            return null
        }
    }

    const accessToken = decrypted.accessToken || decrypted.access_token
    if (!accessToken) return null

    return {
        accessToken,
        userId: decrypted.userId || decrypted.user_id || cred.platform_account_id,
    }
}

// ─── Threads replies sync ─────────────────────────────────────────────────────

// Groups a list of ISO timestamps by their UTC date string (YYYY-MM-DD).
function groupByDate(timestamps: string[]): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const ts of timestamps) {
        const date = ts.slice(0, 10) // "YYYY-MM-DD"
        counts[date] = (counts[date] ?? 0) + 1
    }
    return counts
}

async function syncThreadsGoalProgress(
    supabase: any,
    userId: string,
    accessToken: string,
): Promise<void> {
    // Fetch the user's replies (comments on other threads) for the last 30 days.
    // The /me/replies endpoint returns threads where the user replied to someone.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const url = `https://graph.threads.net/v1.0/me/replies?fields=id,timestamp&limit=100&since=${since}&access_token=${accessToken}`
    const resp = await fetch(url)

    let timestamps: string[] = []

    if (resp.ok) {
        const json = await resp.json()
        const items: any[] = json.data || []
        timestamps = items
            .map((item: any) => item.timestamp)
            .filter(Boolean)

        // Follow pagination if present (up to 3 pages to stay within limits)
        let nextUrl: string | null = json.paging?.next ?? null
        let page = 1
        while (nextUrl && page < 3) {
            const nextResp = await fetch(nextUrl)
            if (!nextResp.ok) break
            const nextJson = await nextResp.json()
            const nextItems: any[] = nextJson.data || []
            timestamps.push(...nextItems.map((i: any) => i.timestamp).filter(Boolean))
            nextUrl = nextJson.paging?.next ?? null
            page++
        }
    }
    // If the endpoint returns an error (e.g. permission not granted), we upsert 0s
    // for today so the UI still shows a synced_at timestamp.

    const byDate = groupByDate(timestamps)

    // Always upsert today even if count is 0, to record that a sync happened.
    const today = new Date().toISOString().slice(0, 10)
    if (!(today in byDate)) byDate[today] = 0

    const rows = Object.entries(byDate).map(([date, count]) => ({
        user_id:        userId,
        platform:       'threads',
        date,
        comments_count: count,
        synced_at:      new Date().toISOString(),
    }))

    if (rows.length > 0) {
        await supabase
            .from('goal_progress')
            .upsert(rows, { onConflict: 'user_id,platform,date' })
    }
}

async function syncUser(supabase: any, userId: string, encryptionKey: string): Promise<void> {
    const { data: creds } = await supabase
        .from('platform_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'threads')
        .eq('is_active', true)
        .limit(1)

    if (!creds?.length) return

    const resolved = await resolveCredential(creds[0], encryptionKey)
    if (!resolved) return

    await syncThreadsGoalProgress(supabase, userId, resolved.accessToken)
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

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const encryptionKey = Deno.env.get('VITE_CREDENTIAL_ENCRYPTION_KEY') || Deno.env.get('ENCRYPTION_KEY') || ''

        let userIds: string[]
        if (isSchedulerCall) {
            const { data: rows } = await supabase
                .from('platform_credentials')
                .select('user_id')
                .eq('platform', 'threads')
                .eq('is_active', true)
            userIds = [...new Set((rows ?? []).map((r: any) => String(r.user_id)))]
        } else {
            const { data: { user }, error: authError } = await supabase.auth.getUser(
                authHeader!.replace('Bearer ', '')
            )
            if (authError || !user) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
            }
            userIds = [user.id]
        }

        await Promise.all(userIds.map(uid => syncUser(supabase, uid, encryptionKey)))

        return new Response(
            JSON.stringify({ success: true, users_synced: userIds.length }),
            { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        )
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS })
    }
})
