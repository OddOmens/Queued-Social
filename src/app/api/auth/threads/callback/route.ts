import { NextRequest, NextResponse } from 'next/server';
import { credentialManager } from '../../../../../services/credentialManager';
import { createServerSupabaseClient } from '../../../../../services/supabase-server';

// GET /api/auth/threads/callback - Handle Threads OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'OAuth authorization failed';
      console.error('Threads OAuth error:', error, errorDescription);
      
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=oauth_failed&message=${encodeURIComponent(errorDescription)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_callback&message=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Extract user ID from state
    const [userId, timestamp] = state.split(':');
    if (!userId || !timestamp) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_state&message=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    // Check if state is not too old (10 minutes)
    const stateAge = Date.now() - parseInt(timestamp);
    if (stateAge > 10 * 60 * 1000) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=expired_state&message=${encodeURIComponent('Authorization request expired')}`
      );
    }

    // Verify user exists and is authenticated
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user || user.id !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=authentication_required&message=${encodeURIComponent('Please sign in to connect your account')}`
      );
    }

    // Exchange code for tokens
    const tokens = await credentialManager.exchangeCodeForTokens('threads', code, state);
    
    // Store credentials
    await credentialManager.storeCredentials(userId, 'threads', tokens);
    
    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=platform_connected&platform=threads`
    );

  } catch (error) {
    console.error('Error in Threads OAuth callback:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=connection_failed&message=${encodeURIComponent(errorMessage)}`
    );
  }
}