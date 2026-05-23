import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { platform, code, redirectUri } = body

        if (!code) throw new Error('Missing code')
        if (!redirectUri) throw new Error('Missing redirectUri')
        if (!platform) throw new Error('Missing platform')

        console.log(`Processing ${platform} OAuth exchange...`)
        console.log(`Examples: REDIRECT_URI=${redirectUri}`)

        let clientId, clientSecret, tokenUrl, fetchOptions;

        if (platform === 'threads') {
            clientId = Deno.env.get('VITE_THREADS_CLIENT_ID')
            // Secure server-side secret (not exposed to Vite/Client)
            clientSecret = Deno.env.get('THREADS_CLIENT_SECRET')

            console.log(`Auth Config: ClientID=${clientId ? '***' + clientId.slice(-4) : 'MISSING'}, ClientSecret=${clientSecret ? 'PRESENT' : 'MISSING'}`)

            if (!clientId || !clientSecret) throw new Error('Missing Threads Environment Variables on Server (VITE_THREADS_CLIENT_ID or THREADS_CLIENT_SECRET)')

            tokenUrl = 'https://graph.threads.net/oauth/access_token'
            const params = new URLSearchParams()
            params.append('client_id', clientId)
            params.append('client_secret', clientSecret)
            params.append('grant_type', 'authorization_code')
            params.append('redirect_uri', redirectUri)
            params.append('code', code)

            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            }

        } else if (platform === 'linkedin') {
            clientId = Deno.env.get('VITE_LINKEDIN_CLIENT_ID')
            // Secure server-side secret
            clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET')

            console.log(`Auth Config: ClientID=${clientId ? '***' + clientId.slice(-4) : 'MISSING'}, ClientSecret=${clientSecret ? 'PRESENT' : 'MISSING'}`)

            if (!clientId || !clientSecret) throw new Error('Missing LinkedIn Environment Variables on Server (VITE_LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET)')

            tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken'
            const params = new URLSearchParams()
            params.append('grant_type', 'authorization_code')
            params.append('code', code)
            params.append('redirect_uri', redirectUri)
            params.append('client_id', clientId)
            params.append('client_secret', clientSecret)

            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            }
        } else if (platform === 'instagram') {
            // Facebook Login for Instagram (Standard Flow)
            clientId = Deno.env.get('VITE_INSTAGRAM_CLIENT_ID')
            clientSecret = Deno.env.get('INSTAGRAM_CLIENT_SECRET')

            if (!clientId || !clientSecret) throw new Error('Missing Instagram Env Vars')

            tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token'
            const params = new URLSearchParams()
            params.append('client_id', clientId)
            params.append('client_secret', clientSecret)
            params.append('redirect_uri', redirectUri)
            params.append('code', code)

            fetchOptions = {
                method: 'GET'
            }
            tokenUrl += '?' + params.toString()

        } else if (platform === 'instagram-direct') {
            // Instagram Business Login (via Meta Developer Portal)
            clientId = Deno.env.get('VITE_INSTAGRAM_CLIENT_ID')
            clientSecret = Deno.env.get('INSTAGRAM_CLIENT_SECRET')

            tokenUrl = 'https://api.instagram.com/oauth/access_token'
            const formData = new URLSearchParams()
            formData.append('client_id', clientId!)
            formData.append('client_secret', clientSecret!)
            formData.append('grant_type', 'authorization_code')
            formData.append('redirect_uri', redirectUri)
            formData.append('code', code)

            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            }

        } else {
            throw new Error('Unsupported platform')
        }

        console.log(`Sending request to ${tokenUrl}...`)
        const response = await fetch(tokenUrl, fetchOptions)
        const responseText = await response.text()
        console.log(`Provider Response Status: ${response.status}`)

        // Log truncated response for debugging
        console.log(`Provider Body: ${responseText.substring(0, 500)}`)

        if (!response.ok) {
            throw new Error(`Provider Error (${response.status}): ${responseText}`)
        }

        let data;
        try {
            // Enhanced Hotfix: Prevent precision loss for ANY large integer IDs (Threads, Instagram, etc)
            // JSON spec says numbers can be arbitrary precision, but JS limits to 2^53.
            // We convert any unquoted integer sequence of 15+ digits into a string before parsing.
            // Regex interpretation:
            // : Look for colon
            // \s* optional whitespace
            // (\d{15,}) capture 15 or more digits
            // (?=[,\}\s]) lookahead to ensure it ends with comma, closing brace, or whitespace (end of value)

            // Note: We need to be careful not to match inside strings, but simple regex on JSON text is risky if strictly valid structure isn't guaranteed.
            // However for OAuth responses, structure is usually simple depth-1 or -2 objects.

            // safer regex that checks for boundaries more explicitly
            const safeJsonText = responseText.replace(/:\s*(\d{15,})/g, ': "$1"');

            data = JSON.parse(safeJsonText)

            // Double check validation
            if (typeof data.user_id === 'number') {
                console.warn('⚠️ user_id was parsed as number despite safeguard! content:', data.user_id);
                // Last ditch effort if regex failed but number is still "safe" (unlikely for 17 digits)
                data.user_id = String(data.user_id);
            }
        } catch (e) {
            console.error('JSON Parse Error on provider response:', e);
            data = { raw: responseText, error: 'Failed to parse provider response' }
        }

        // Check for error field in 200 responses (common in some APIs)
        if (data.error) {
            throw new Error(`Provider returned error: ${JSON.stringify(data.error)}`)
        }

        // Post-processing: Exchange for Long-Lived Token (Threads)
        if (platform === 'threads' && data.access_token) {
            console.log('Exchanging short-lived Threads token for long-lived token...')
            try {
                // We need client_secret again, which was defined in the scope above but we can grab it from env again or reuse variable if scope allows
                // The variable `clientSecret` is defined in the outer scope, so we can use it.

                const exchangeUrl = new URL('https://graph.threads.net/access_token');
                exchangeUrl.searchParams.append('grant_type', 'th_exchange_token');
                exchangeUrl.searchParams.append('client_secret', clientSecret!);
                exchangeUrl.searchParams.append('access_token', data.access_token);

                const exchangeResp = await fetch(exchangeUrl.toString());
                const exchangeText = await exchangeResp.text();

                if (exchangeResp.ok) {
                    const exchangeData = JSON.parse(exchangeText);
                    console.log('✅ Successfully exchanged for long-lived token');

                    // Update the data object with the long-lived token
                    data.access_token = exchangeData.access_token;
                    data.expires_in = exchangeData.expires_in; // Usually 60 days

                    // Now fetch the User Profile to get the Name/Username/Correct ID
                    // This is critical because the initial ID might be from the short-lived token or we want to ensure we have the Profile ID (which is the same)
                    // but also the NAME to match our auto-heal logic.
                    console.log('Fetching Threads User Profile...');
                    const profileUrl = `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${data.access_token}`;

                    const profileResp = await fetch(profileUrl);
                    const profileText = await profileResp.text();

                    if (profileResp.ok) {
                        // Apply the same safe-parsing logic to the profile response because 'id' is large
                        const safeProfileText = profileText.replace(/:\s*(\d{15,})/g, ': "$1"');
                        const profileData = JSON.parse(safeProfileText);

                        console.log('✅ Fetched Threads Profile:', {
                            username: profileData.username,
                            name: profileData.name,
                            id: profileData.id
                        });

                        // Update our main data object with the profile info
                        // This ensures the frontend gets the correct Name and ID
                        data.id = profileData.id; // Correct large integer string
                        data.user_id = profileData.id; // Normalize
                        data.name = profileData.name || profileData.username;
                        data.username = profileData.username;
                        data.profile_picture_url = profileData.threads_profile_picture_url;

                    } else {
                        console.error('❌ Failed to fetch Threads profile:', profileText);
                    }

                } else {
                    console.error('❌ Failed to exchange token:', exchangeText);
                }
            } catch (err) {
                console.error('Error during Threads post-processing:', err);
            }
        }

        // Post-processing: Fetch Profile for LinkedIn
        if (platform === 'linkedin' && data.access_token) {
            console.log('Fetching LinkedIn Profile...');
            try {
                const profileResp = await fetch('https://api.linkedin.com/v2/userinfo', {
                    headers: { 'Authorization': `Bearer ${data.access_token}` }
                });
                const profileText = await profileResp.text();

                if (profileResp.ok) {
                    const profile = JSON.parse(profileText);
                    console.log('LinkedIn Profile Fetched for:', profile.sub);
                    // Merge profile info into the return object.
                    // 'sub' is the user ID in OpenID Connect.
                    data.id = profile.sub;
                    data.name = profile.name;
                    data.email = profile.email;
                    // Also attach the full profile for debugging or storage
                    data._profile = profile;
                } else {
                    console.error('Failed to fetch LinkedIn Profile:', profileText);
                    // Don't throw, just log. We can still return the token.
                    // But maybe flag it.
                }
            } catch (err) {
                console.error('Error fetching LinkedIn Profile:', err);
            }
        }

        // Post-processing: Instagram Direct (Exchange for Long-Lived)
        // Post-processing: Instagram (Facebook Flow) - Get Long-Lived Token + Discover Accounts
        if (platform === 'instagram' && data.access_token) {
            console.log('Exchanging short-lived Facebook token for long-lived token...');
            try {
                const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
                longLivedUrl.searchParams.append('grant_type', 'fb_exchange_token');
                longLivedUrl.searchParams.append('client_id', clientId!);
                longLivedUrl.searchParams.append('client_secret', clientSecret!);
                longLivedUrl.searchParams.append('fb_exchange_token', data.access_token);

                const longLivedResp = await fetch(longLivedUrl.toString());
                const longLivedData = await longLivedResp.json();

                if (longLivedData.access_token) {
                    console.log('✅ Successfully obtained long-lived Facebook token');
                    data.access_token = longLivedData.access_token; // Update with long-lived
                    if (longLivedData.expires_in) data.expires_in = longLivedData.expires_in;

                    // Now fetch the Instagram Business Accounts this user manages
                    const accountsUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${data.access_token}`;

                    const accountsResp = await fetch(accountsUrl);
                    const accountsData = await accountsResp.json();

                    if (accountsData.data) {
                        // Filter only pages that have an IG Business Account linked
                        const igAccounts = accountsData.data
                            .filter((page: any) => page.instagram_business_account)
                            .map((page: any) => ({
                                id: page.instagram_business_account.id,
                                username: page.instagram_business_account.username,
                                name: page.name + ' (Instagram)',
                                profilePictureUrl: page.instagram_business_account.profile_picture_url,
                                pageAccessToken: page.access_token // Include the Page Access Token!
                            }));

                        console.log(`Found ${igAccounts.length} Instagram Business Accounts`);
                        data.connected_accounts = igAccounts;
                    }
                } else {
                    console.error('❌ Failed to get long-lived token:', longLivedData);
                }
            } catch (err) {
                console.error('Error during Instagram token post-processing:', err);
            }
        }

        // Post-processing: Instagram Direct (Classic IG Token Exchange) - DEPRECATED for Publishing
        if (platform === 'instagram-direct' && data.access_token) {
            const igExchangeUrl = new URL('https://graph.instagram.com/access_token');
            igExchangeUrl.searchParams.append('grant_type', 'ig_exchange_token');
            igExchangeUrl.searchParams.append('client_secret', clientSecret!);
            igExchangeUrl.searchParams.append('access_token', data.access_token);

            try {
                const igResp = await fetch(igExchangeUrl.toString());
                const igData = await igResp.json();
                if (igData.access_token) {
                    data.access_token = igData.access_token;
                    if (igData.expires_in) data.expires_in = igData.expires_in;
                }
            } catch (e) {
                console.error('IG Direct exchange failed', e);
            }
        }


        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error('Exchange Logic Error:', error)
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            details: 'Check function logs for more info'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
