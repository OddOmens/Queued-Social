import { supabase } from '@/lib/supabase';

interface PublishRequest {
    postId: string;
    platform: string;
    platformAccountId: string;
    content: {
        text: string;
        mediaUrls?: string[];
        type: 'single' | 'thread' | 'media';
        firstComment?: string;
    };
    cleanupMedia?: boolean;
}

export async function publishPostInstant(request: PublishRequest) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('publish-post', {
        body: request
    });

    if (error) {
        throw new Error(error.message || 'Failed to invoke publish function');
    }

    if (!data.success) {
        throw new Error(data.error || 'Publishing failed on server');
    }

    return data;
}
