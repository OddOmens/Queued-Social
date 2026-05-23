import { supabase } from '@/lib/supabase';
import { CommunityInteraction, ThreadConversation } from '@/types/data';

/**
 * Fetch threads and interactions for a specific platform and account
 */
export async function getThreadsInteractions(platform: string, platformAccountId?: string): Promise<ThreadConversation[]> {
    const { data, error } = await supabase.functions.invoke('threads-interactions', {
        body: {
            action: 'fetch',
            platform,
            platformAccountId
        }
    });

    if (error) throw error;
    
    // Transform timestamps string to Date objects
    return data.map((conv: any) => ({
        rootPost: transformInteraction(conv.rootPost),
        interactions: conv.interactions.map(transformInteraction)
    }));
}

/**
 * Reply to a thread/post
 */
export async function postReply(params: {
    platform: string;
    platformAccountId: string;
    parentId: string;
    text: string;
}): Promise<CommunityInteraction> {
    const { data, error } = await supabase.functions.invoke('threads-interactions', {
        method: 'POST',
        body: {
            action: 'reply',
            ...params
        }
    });

    if (error) throw error;
    
    return transformInteraction(data);
}

function transformInteraction(d: any): CommunityInteraction {
    return {
        ...d,
        timestamp: new Date(d.timestamp),
        replies: d.replies?.map(transformInteraction)
    };
}
