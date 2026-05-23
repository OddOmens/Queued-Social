import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { storeCredentials } from '@/services/credentials';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function InstagramDirectCallbackPage() {
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

            // Debug: Log full URL and all parameters
            console.log('📍 Full callback URL:', window.location.href);
            console.log('📍 Search params:', Object.fromEntries(searchParams.entries()));

            const code = searchParams.get('code');
            const errorParam = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            console.log('📍 Code:', code);
            console.log('📍 Error:', errorParam);

            if (errorParam) {
                setError(`Instagram Error: ${errorParam} - ${errorDescription || 'Authorization failed'}`);
                return;
            }

            if (!code) {
                setError(`No authorization code provided. URL: ${window.location.href}`);
                return;
            }

            try {
                const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                const redirectUri = `${appUrl}/auth/instagram-direct/callback`;

                setStatus('Exchanging tokens with Instagram...');
                console.log('📱 Invoking edge function for Instagram Direct login...');

                const { data: tokenData, error: functionError } = await supabase.functions.invoke('exchange-oauth-token', {
                    body: {
                        platform: 'instagram-direct',
                        code,
                        redirectUri
                    }
                });

                if (functionError) {
                    console.error('Edge function error:', functionError);
                    throw functionError;
                }

                if (tokenData.error) {
                    console.error('Token exchange error:', tokenData.error);
                    throw new Error(tokenData.error);
                }

                console.log('✅ Token exchange successful');

                // Instagram Direct returns user info directly
                const { access_token, user_id, username } = tokenData;

                if (!access_token || !user_id) {
                    throw new Error('Missing access token or user ID in response');
                }

                setStatus('Saving Instagram account...');

                // Store credentials
                await storeCredentials(
                    user.id,
                    'instagram',
                    {
                        accessToken: access_token,
                        userId: user_id,
                        username: username || user_id,
                        isDirect: true // Flag to indicate this is direct login
                    },
                    user_id, // platformAccountId
                    username || user_id, // accountUsername
                    username || `Instagram User ${user_id}` // accountName
                );

                console.log('✅ Instagram Direct account saved:', username || user_id);

                setStatus('Done!');
                setTimeout(() => navigate('/settings'), 1000);

            } catch (err: any) {
                console.error('Instagram Direct callback error:', err);
                setError(err.message || 'Failed to connect Instagram. Please try again.');
            }
        };

        handleCallback();
    }, [user, searchParams, navigate]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
                <h1 className="text-destructive font-bold text-xl">Connection Failed</h1>
                <p className="text-center max-w-md text-muted-foreground">{error}</p>
                <div className="flex gap-2">
                    <button
                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                        onClick={() => navigate('/settings')}
                    >
                        Return to Settings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">{status}</p>
        </div>
    );
}
