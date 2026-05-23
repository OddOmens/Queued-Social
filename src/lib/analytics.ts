// ─── Types ───────────────────────────────────────────────────────────────────

export interface PostAnalytics {
    id: string;
    platformPostId: string | null;
    platform: string;
    content: { text: string; mediaUrls?: string[]; type?: string };
    publishedAt: string;
    platformAccountId: string;
    accountName: string;
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    /** Total of views + likes + replies + reposts + quotes */
    engagement: number;
    /** Weighted score favoring active interactions over passive views */
    weightedEngagement: number;
    permalink?: string;
    mediaType?: string;
    isReply?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ENGAGEMENT_WEIGHTS = {
    views: 1,
    likes: 8,
    replies: 12,
    reposts: 15,
    quotes: 20,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function calculateWeightedScore(p: Partial<PostAnalytics>): number {
    return (
        (p.views ?? 0) * ENGAGEMENT_WEIGHTS.views +
        (p.likes ?? 0) * ENGAGEMENT_WEIGHTS.likes +
        (p.replies ?? 0) * ENGAGEMENT_WEIGHTS.replies +
        (p.reposts ?? 0) * ENGAGEMENT_WEIGHTS.reposts +
        (p.quotes ?? 0) * ENGAGEMENT_WEIGHTS.quotes
    );
}

export function normalizeAnalytics(a: Record<string, unknown> | null) {
    if (!a || typeof a !== 'object') {
        return { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, permalink: undefined, mediaType: undefined, refreshedAt: undefined };
    }
    return {
        views: Number(a.views ?? a.view_count ?? 0),
        likes: Number(a.likes ?? a.like_count ?? 0),
        replies: Number(a.replies ?? a.reply_count ?? 0),
        reposts: Number(a.reposts ?? a.repost_count ?? 0),
        quotes: Number(a.quotes ?? a.quote_count ?? 0),
        permalink: typeof a.permalink === 'string' ? a.permalink : undefined,
        mediaType: typeof a.media_type === 'string' ? a.media_type : undefined,
        refreshedAt: typeof a.refreshed_at === 'string' ? a.refreshed_at : undefined,
        isReply: a.is_reply === true,
    };
}

export function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

export function formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
