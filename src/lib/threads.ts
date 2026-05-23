
export const debugThreadsEnvironment = () => {
    return {
        VITE_THREADS_CLIENT_ID: import.meta.env.VITE_THREADS_CLIENT_ID,
        VITE_THREADS_CLIENT_SECRET: import.meta.env.VITE_THREADS_CLIENT_SECRET,
    };
};

export const testThreadsTokenExchange = async (code: string) => {
    const env = debugThreadsEnvironment();
    const clientId = env.VITE_THREADS_CLIENT_ID;
    const clientSecret = env.VITE_THREADS_CLIENT_SECRET;
    const redirectUri = `${window.location.origin}/auth/threads/callback`;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Threads Environment Variables');
    }

    const requestBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code
    });

    const response = await fetch('https://graph.threads.net/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody
    });

    const responseText = await response.text();
    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch {
        responseData = { raw: responseText };
    }

    return {
        success: response.ok,
        data: responseData,
    };
};
