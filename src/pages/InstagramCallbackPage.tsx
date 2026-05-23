import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { storeCredentials } from '@/services/credentials';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function InstagramCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Connecting to Instagram...');
    const processed = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            if (!user) return;
            if (processed.current) return;
            processed.current = true;

            const code = searchParams.get('code');
            if (!code) {
                setError('No code provided');
                return;
            }

            try {
                // Determine redirect URI - must match SettingsPage exactly
                const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                const redirectUri = `${appUrl}/auth/instagram/callback`;

                setStatus('Exchanging tokens...');
                const { data: tokenData, error: functionError } = await supabase.functions.invoke('exchange-oauth-token', {
                    body: {
                        platform: 'instagram',
                        code,
                        redirectUri
                    }
                });

                if (functionError) throw functionError;
                if (tokenData.error) throw new Error(tokenData.error);

                // Check for connected accounts
                if (tokenData.connected_accounts && tokenData.connected_accounts.length > 0) {
                    setStatus(`Found ${tokenData.connected_accounts.length} business accounts. Saving...`);

                    // Save each account separately
                    // The tokenData.access_token is the User Token (long-lived) which works for all these pages usually
                    const accessToken = tokenData.access_token;
                    const refreshToken = ''; // Facebook doesn't use refresh tokens like OAuth2 standard, it uses long-lived tokens

                    for (const account of tokenData.connected_accounts) {
                        try {

                            // Normalize credentials for storage
                            // CRITICAL: Ensure we have the Page Token
                            const finalAccessToken = account.pageAccessToken || accessToken;

                            if (!account.pageAccessToken) {
                                console.warn(`⚠️ Warning: No Page Access Token found for ${account.name}. Falling back to User Token.`);
                                setStatus(prev => prev + `\nWarning: No Page Token for ${account.name} (Check permissions)`);
                            } else {
                                console.log(`✅ Using Page Access Token for ${account.name}`);
                            }

                            const normalizedCredentials = {
                                accessToken: finalAccessToken,
                                refreshToken: refreshToken || '',
                                userId: account.id,
                                username: account.username,
                                name: account.name,
                                accountType: 'business',
                                // Store expiration if available
                                expiresIn: tokenData.expires_in
                            };

                            await storeCredentials(
                                user.id,
                                'instagram',
                                normalizedCredentials,
                                account.id, // platformAccountId
                                account.username, // accountUsername
                                account.name // accountName
                            );
                            console.log(`Saved account: ${account.name}`);
                        } catch (saveError) {
                            console.error(`Failed to save account ${account.name}:`, saveError);
                        }
                    }
                } else {
                    // Fallback if no specific business accounts found (rare if scope `instagram_content_publish` was granted?)
                    // Or maybe it's just a raw connection without specific pages yet?
                    // We probably shouldn't encourage this state for a scheduler app.
                    console.warn('No Instagram Business Accounts returned. The user might have a creator account or personal account not linked to a page?');
                    // We could try to query "me?fields=id,username" if it was just a raw user auth?
                    // But our goal is business publishing.
                    // Let's just finish and let the user see no accounts were added if so.
                    throw new Error('No Instagram Business Accounts found connected to your Facebook user. Please ensure you have an Instagram Business or Creator account linked to a Facebook Page.');
                }

                setStatus('Done!');
                setTimeout(() => navigate('/settings'), 1000);

            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to connect Instagram');
            }
        };
        handleCallback();
    }, [user, searchParams, navigate]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <h1 className="text-destructive font-bold text-xl">Connection Failed</h1>
                <p className="text-center max-w-md text-muted-foreground">{error}</p>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90" onClick={() => navigate('/settings')}>Return to Settings</button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">{status}</p>
        </div>
    );
}
