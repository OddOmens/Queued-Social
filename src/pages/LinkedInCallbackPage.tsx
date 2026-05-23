import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { storeCredentials } from '@/services/credentials';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LinkedInCallbackPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuthStore();
    const [error, setError] = useState('');
    const processed = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            if (!user) return;
            if (processed.current) return;
            processed.current = true;

            const code = searchParams.get('code');
            const state = searchParams.get('state');

            if (!code) {
                setError('No code provided.');
                return;
            }

            try {
                // Use consolidated Edge Function
                // Must match the redirect_uri used in the authorization request in SettingsPage.tsx
                const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                const redirectUri = `${appUrl}/auth/linkedin/callback`;

                const { data: tokenData, error: funcError } = await supabase.functions.invoke('exchange-oauth-token', {
                    body: {
                        platform: 'linkedin',
                        code,
                        redirectUri
                    }
                });

                if (funcError) throw funcError;
                if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

                const userId = tokenData.id || tokenData.sub || 'unknown';
                const name = tokenData.name || `${tokenData.given_name || ''} ${tokenData.family_name || ''}`.trim() || 'LinkedIn User';

                // Normalize credentials to match what the publishing code expects
                const normalizedCredentials = {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || '',
                    userId: userId, // Map id/sub to userId
                    expiresIn: tokenData.expires_in,
                    scope: tokenData.scope
                };

                await storeCredentials(
                    user.id,
                    'linkedin',
                    normalizedCredentials,
                    userId,
                    undefined,
                    name
                );

                navigate('/settings');

            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to exchange token');
            } finally {
                if (state) sessionStorage.removeItem(`linkedin_code_verifier_${state}`);
            }
        };
        handleCallback();
    }, [user, searchParams, navigate]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <h1 className="text-destructive font-bold text-xl">Connection Failed</h1>
                <p>{error}</p>
                <button className="text-primary underline" onClick={() => navigate('/settings')}>Return to Settings</button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Connecting LinkedIn account...</p>
        </div>
    );
}
