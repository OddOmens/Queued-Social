import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LinkedInTokenResponse {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    scope: string
}

interface LinkedInProfileResponse {
    // OpenID Connect userinfo endpoint format
    sub?: string
    name?: string
    given_name?: string
    family_name?: string
    email?: string
    
    // Legacy v2/me endpoint format
    id?: string
    localizedFirstName?: string
    localizedLastName?: string
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('📥 LinkedIn OAuth request received')

        const body = await req.json()
        const { code, state, codeVerifier } = body

        // Get LinkedIn app credentials from environment variables
        // Set these via: supabase secrets set LINKEDIN_CLIENT_ID=... LINKEDIN_CLIENT_SECRET=... LINKEDIN_REDIRECT_URI=...
        const clientId = Deno.env.get('LINKEDIN_CLIENT_ID') ?? Deno.env.get('VITE_LINKEDIN_CLIENT_ID') ?? ''
        const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET') ?? Deno.env.get('VITE_LINKEDIN_CLIENT_SECRET') ?? ''
        const redirectUri = Deno.env.get('LINKEDIN_REDIRECT_URI') ?? Deno.env.get('VITE_APP_URL') ? `${Deno.env.get('VITE_APP_URL')}/auth/linkedin/callback` : ''

        console.log('🔧 Environment check:')
        console.log('Client ID:', clientId ? `${clientId.substring(0, 6)}...` : 'MISSING')
        console.log('Client Secret:', clientSecret ? `${clientSecret.substring(0, 10)}...` : 'MISSING')
        console.log('Client Secret Length:', clientSecret ? clientSecret.length : 0)
        console.log('Redirect URI:', redirectUri)

        if (!code) {
            console.error('❌ No authorization code provided')
            return new Response(
                JSON.stringify({
                    error: 'Authorization code is required',
                    debug: {
                        clientId: clientId ? 'SET' : 'MISSING',
                        clientSecret: clientSecret ? 'SET' : 'MISSING',
                        redirectUri: redirectUri || 'MISSING'
                    }
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        console.log('🔄 Processing LinkedIn OAuth token exchange...')
        console.log('Code received:', code.substring(0, 10) + '...')

        // Step 1: Exchange authorization code for access token
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
        })

        // Add code verifier for PKCE if provided
        // if (codeVerifier) {
        //     tokenParams.set('code_verifier', codeVerifier)
        //     console.log('🔐 Using PKCE code verifier for token exchange')
        // }
        console.log('🔐 PKCE disabled for testing')

        console.log('📡 Exchanging code for tokens...')
        console.log('Token request parameters:', {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret ? 'SET' : 'MISSING',
            redirect_uri: redirectUri,
            code_length: code.length
        })

        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenParams,
        })

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text()
            console.error('❌ Token exchange failed:', errorText)
            throw new Error(`LinkedIn token exchange failed: ${tokenResponse.status} ${errorText}`)
        }

        const tokenData: LinkedInTokenResponse = await tokenResponse.json()
        console.log('✅ Token exchange successful')

        // Step 2: Get user profile information using the correct LinkedIn API v2 endpoint
        console.log('👤 Fetching user profile...')
        
        // Use the userinfo endpoint which works with openid scope
        const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
            },
        })

        if (!profileResponse.ok) {
            const errorText = await profileResponse.text()
            console.error('❌ Profile fetch failed:', errorText)
            
            // Try alternative endpoint if userinfo fails
            console.log('🔄 Trying alternative profile endpoint...')
            const altProfileResponse = await fetch('https://api.linkedin.com/v2/people/~', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                },
            })
            
            if (!altProfileResponse.ok) {
                const altErrorText = await altProfileResponse.text()
                console.error('❌ Alternative profile fetch also failed:', altErrorText)
                throw new Error(`LinkedIn profile fetch failed: ${profileResponse.status} ${errorText}`)
            }
            
            const altProfileData = await altProfileResponse.json()
            console.log('✅ Alternative profile fetch successful')
            
            // Handle alternative profile data format
            const result = {
                tokens: {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
                    tokenType: tokenData.token_type || 'Bearer',
                    scope: tokenData.scope,
                },
                profile: {
                    id: altProfileData.id || 'unknown',
                    username: altProfileData.localizedFirstName && altProfileData.localizedLastName 
                        ? `${altProfileData.localizedFirstName} ${altProfileData.localizedLastName}`
                        : 'LinkedIn User',
                    name: altProfileData.localizedFirstName && altProfileData.localizedLastName 
                        ? `${altProfileData.localizedFirstName} ${altProfileData.localizedLastName}`
                        : 'LinkedIn User',
                }
            }
            
            console.log('🎉 LinkedIn OAuth completed successfully (alternative endpoint)')
            
            return new Response(
                JSON.stringify(result),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                },
            )
        }

        const profileData = await profileResponse.json()
        console.log('✅ Profile fetch successful')

        // Step 3: Return the tokens and profile data
        // Handle different response formats from LinkedIn API
        const result = {
            tokens: {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
                tokenType: tokenData.token_type || 'Bearer',
                scope: tokenData.scope,
            },
            profile: {
                id: profileData.sub || profileData.id || 'unknown',
                username: profileData.name || 
                         (profileData.given_name && profileData.family_name 
                             ? `${profileData.given_name} ${profileData.family_name}`
                             : profileData.localizedFirstName && profileData.localizedLastName
                             ? `${profileData.localizedFirstName} ${profileData.localizedLastName}`
                             : 'LinkedIn User'),
                name: profileData.name || 
                     (profileData.given_name && profileData.family_name 
                         ? `${profileData.given_name} ${profileData.family_name}`
                         : profileData.localizedFirstName && profileData.localizedLastName
                         ? `${profileData.localizedFirstName} ${profileData.localizedLastName}`
                         : 'LinkedIn User'),
            }
        }

        console.log('🎉 LinkedIn OAuth completed successfully')

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error) {
        console.error('❌ LinkedIn OAuth error:', error)

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})