import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { storeCredentials } from '@/services/credentials';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function ThreadsCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [error, setError] = useState('');
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
                // Invoke the secure Edge Function for token exchange
                // Must match the redirect_uri used in the authorization request in SettingsPage.tsx
                const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                const redirectUri = `${appUrl}/auth/threads/callback`;

                const { data: tokenData, error: functionError } = await supabase.functions.invoke('exchange-oauth-token', {
                    body: {
                        platform: 'threads',
                        code,
                        redirectUri
                    }
                });

                if (functionError) throw functionError;
                if (tokenData.error) throw new Error(tokenData.error);

                // tokenData now contains the API response (access_token, user_id)
                // AND potentially name/username if the exchange function enhanced it
                const userId = tokenData.id || tokenData.user_id;

                await storeCredentials(
                    user.id,
                    'threads',
                    tokenData,
                    userId,
                    tokenData.username, // username from profile
                    tokenData.name || 'Threads Account' // name from profile or default
                );

                navigate('/settings');
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to connect Threads');
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
            <p className="text-muted-foreground">Connecting Threads account...</p>
        </div>
    );
}
