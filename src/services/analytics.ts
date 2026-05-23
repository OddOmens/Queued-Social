import { supabase } from '@/lib/supabase';
import { PostAnalytics, normalizeAnalytics, calculateWeightedScore } from '@/lib/analytics';

export interface BestTimeSlot {
    day: number; // 0-6 (Sun-Sat)
    hour: number; // 0-23
    score: number;
    count: number;
}

export async function getBestPostingTimes(userId: string): Promise<BestTimeSlot[]> {
    const { data, error } = await supabase
        .from('scheduled_posts')
        .select('id, platform_post_id, content, platform, published_at, platform_account_id, account_name, analytics')
        .eq('user_id', userId)
        .eq('status', 'published')
        .not('published_at', 'is', null);

    if (error) throw error;

    const posts: PostAnalytics[] = (data ?? []).map(row => {
        const a = normalizeAnalytics(row.analytics as Record<string, unknown> | null);
        return {
            id: row.id,
            platformPostId: row.platform_post_id,
            platform: row.platform,
            content: row.content as any,
            publishedAt: row.published_at,
            platformAccountId: row.platform_account_id,
            accountName: row.account_name,
            views: a.views,
            likes: a.likes,
            replies: a.replies,
            reposts: a.reposts,
            quotes: a.quotes,
            engagement: a.views + a.likes + a.replies + a.reposts + a.quotes,
            weightedEngagement: calculateWeightedScore(a),
        };
    });

    const deduped = new Map<string, PostAnalytics>();
    for (const post of posts) {
        const key = post.platformPostId ?? post.id;
        const existing = deduped.get(key);
        if (!existing || post.engagement > existing.engagement) {
            deduped.set(key, post);
        }
    }
    const finalPosts = Array.from(deduped.values());

    const grid: { score: number; count: number }[][] = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => ({ score: 0, count: 0 }))
    );

    finalPosts.forEach(post => {
        if (!post.publishedAt) return;
        const d = new Date(post.publishedAt);
        const day = d.getDay();
        const hour = d.getHours();
        grid[day][hour].score += post.weightedEngagement;
        grid[day][hour].count++;
    });

    const slots: BestTimeSlot[] = [];
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            // Minimum count 1 to show results immediately if there's any data
            if (grid[d][h].count >= 1) {
                slots.push({ 
                    day: d, 
                    hour: h, 
                    score: grid[d][h].score / grid[d][h].count, 
                    count: grid[d][h].count 
                });
            }
        }
    }

    return slots.sort((a, b) => b.score - a.score);
}

export function getBestTimeForDay(slots: BestTimeSlot[], day: number): BestTimeSlot | null {
    const daySlots = slots.filter(s => s.day === day);
    if (daySlots.length === 0) return null;
    return daySlots.sort((a, b) => b.score - a.score)[0];
}
