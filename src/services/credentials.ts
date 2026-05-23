import { supabase } from '@/lib/supabase';
import { PlatformCredentials } from '@/types/data';

/**
 * Store credentials in the database
 */
export async function storeCredentials(
    userId: string,
    platform: 'threads' | 'linkedin' | 'instagram',
    tokens: any,
    platformAccountId: string,
    accountUsername?: string,
    accountName?: string
) {
    // Check if credentials already exist for this platform account
    const { data: existing } = await supabase
        .from('platform_credentials')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', platform)
        .eq('platform_account_id', platformAccountId)
        .single();

    // Encrypting tokens typically happens on the server or via a Postgres function 
    // BUT legacy app seemed to just store JSON. We will assume the column handles it or we send as is.
    // Ideally this is done via edge function to keep secrets off client, but porting legacy behavior directly:

    const validTokens = { ...tokens };
    // Remove undefined values to avoid JSONB errors
    Object.keys(validTokens).forEach(key => validTokens[key] === undefined && delete validTokens[key]);

    const payload = {
        user_id: userId,
        platform,
        platform_account_id: platformAccountId,
        credentials: validTokens,
        account_username: accountUsername,
        account_name: accountName,
        is_active: true,
        updated_at: new Date().toISOString()
    };

    if (existing) {
        const { error } = await supabase
            .from('platform_credentials')
            .update(payload)
            .eq('id', existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('platform_credentials')
            .insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
    }
}

/**
 * Get connected platforms
 */
export async function getConnectedPlatforms(userId: string): Promise<PlatformCredentials[]> {
    const { data, error } = await supabase
        .from('platform_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

    if (error) throw error;

    return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        platform: d.platform,
        platformAccountId: d.platform_account_id,
        accountName: d.account_name,
        accountUsername: d.account_username,
        credentials: d.credentials,
        isActive: d.is_active,
        expiresAt: d.expires_at ? new Date(d.expires_at) : undefined,
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at)
    }));
}

/**
 * Remove credentials (disconnect account)
 */
export async function removeCredentials(id: string): Promise<void> {
    const { error } = await supabase
        .from('platform_credentials')
        .update({ is_active: false })
        .eq('id', id);

    if (error) throw error;
}

/**
 * Update account display name
 */
export async function updateAccountName(id: string, newName: string): Promise<void> {
    const { error } = await supabase
        .from('platform_credentials')
        .update({ account_name: newName })
        .eq('id', id);

    if (error) throw error;
}
