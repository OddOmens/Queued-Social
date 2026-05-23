import { useEffect, useState, useMemo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
    Loader2,
    Eye,
    RefreshCw,
    MessageCircle,
    Repeat2,
    Heart,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    TrendingUp,
    TrendingDown,
    BarChart2,
    BadgeCheck,
    Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import {
    PostAnalytics,
    normalizeAnalytics,
    formatNumber,
    formatRelativeTime,
    calculateWeightedScore
} from '@/lib/analytics';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = '7' | '14' | '30' | '90';
type PostView = 'posts' | 'replies';
type PageTab = 'posts' | 'followers';
type FollowerPeriod = '7' | '30' | '90';

interface SyncMessage {
    type: 'success' | 'error';
    text: string;
}

interface ProfileSnapshot {
    id: string;
    platform_account_id: string;
    account_name: string | null;
    username: string | null;
    display_name: string | null;
    profile_picture_url: string | null;
    biography: string | null;
    is_verified: boolean;
    follower_count: number;
    follower_net_change: number;
    likes_count: number;
    quotes_count: number;
    replies_count: number;
    reposts_count: number;
    views_count: number;
    snapshot_date: string;
    recorded_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
    '7': 'Last 7 Days',
    '14': 'Last 14 Days',
    '30': 'Last 30 Days',
    '90': 'Last 90 Days',
};

const FOLLOWER_PERIOD_LABELS: Record<FollowerPeriod, string> = {
    '7': '7 Days',
    '30': '30 Days',
    '90': '90 Days',
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const [posts, setPosts] = useState<PostAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<SyncMessage | null>(null);
    const [period, setPeriod] = useState<Period>('30');
    const [postView, setPostView] = useState<PostView>('posts');
    const [pageTab, setPageTab] = useState<PageTab>('posts');
    const [lengthStatMode, setLengthStatMode] = useState<'average' | 'total'>('average');
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    // Profile / Followers state
    const [profileSnapshot, setProfileSnapshot] = useState<ProfileSnapshot | null>(null);
    const [profileHistory, setProfileHistory] = useState<ProfileSnapshot[]>([]);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSyncing, setProfileSyncing] = useState(false);
    const [profileSyncMessage, setProfileSyncMessage] = useState<SyncMessage | null>(null);
    const [followerPeriod, setFollowerPeriod] = useState<FollowerPeriod>('30');

    const { user } = useAuthStore();

    const fetchPosts = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('scheduled_posts')
                .select('id, platform_post_id, content, platform, published_at, platform_account_id, account_name, analytics')
                .eq('user_id', user.id)
                .eq('status', 'published')
                .not('published_at', 'is', null)
                .order('published_at', { ascending: false });

            if (error) throw error;

            let maxRefreshedAt: Date | null = null;
            const mapped: PostAnalytics[] = (data ?? []).map(row => {
                const a = normalizeAnalytics(row.analytics as Record<string, unknown> | null);
                if (a.refreshedAt) {
                    const d = new Date(a.refreshedAt);
                    if (!maxRefreshedAt || d > maxRefreshedAt) maxRefreshedAt = d;
                }
                return {
                    id: row.id as string,
                    platformPostId: (row.platform_post_id as string) ?? null,
                    platform: row.platform as string,
                    content: (row.content as any) ?? { text: '' },
                    publishedAt: row.published_at as string,
                    platformAccountId: (row.platform_account_id as string) ?? '',
                    accountName: (row.account_name as string) ?? 'Account',
                    views: a.views,
                    likes: a.likes,
                    replies: a.replies,
                    reposts: a.reposts,
                    quotes: a.quotes,
                    engagement: a.views + a.likes + a.replies + a.reposts + a.quotes,
                    weightedEngagement: calculateWeightedScore(a),
                    permalink: a.permalink,
                    mediaType: a.mediaType,
                    isReply: a.isReply ?? false,
                };
            });

            const deduped = new Map<string, PostAnalytics>();
            for (const post of mapped) {
                const key = post.platformPostId ?? post.id;
                const existing = deduped.get(key);
                if (!existing || post.engagement > existing.engagement) {
                    deduped.set(key, post);
                }
            }
            setPosts(Array.from(deduped.values()));
            setLastSynced(maxRefreshedAt);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfileData = async () => {
        if (!user) return;
        setProfileLoading(true);
        try {
            // Latest snapshot
            const { data: latest } = await supabase
                .from('threads_profile_snapshots')
                .select('*')
                .eq('user_id', user.id)
                .order('snapshot_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            setProfileSnapshot(latest ?? null);

            // Last 90 days for the followers tab
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);

            const { data: history } = await supabase
                .from('threads_profile_snapshots')
                .select('*')
                .eq('user_id', user.id)
                .gte('snapshot_date', cutoff)
                .order('snapshot_date', { ascending: true });

            setProfileHistory(history ?? []);
        } catch (err) {
            console.error('Failed to fetch profile data:', err);
        } finally {
            setProfileLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncMessage(null);
        try {
            const { data, error } = await supabase.functions.invoke('refresh-analytics');
            if (error) throw error;
            setSyncMessage({
                type: 'success',
                text: (data as { message?: string })?.message ?? 'Analytics synced successfully.',
            });
            await fetchPosts();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Sync failed. Please try again.';
            setSyncMessage({ type: 'error', text: msg });
        } finally {
            setSyncing(false);
        }
    };

    const handleProfileSync = async () => {
        setProfileSyncing(true);
        setProfileSyncMessage(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const resp = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-threads-followers`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session!.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ source: 'manual' }),
                }
            );
            const data = await resp.json();
            if (!resp.ok) throw new Error(data?.error || data?.message || 'Sync failed');
            setProfileSyncMessage({
                type: data.success ? 'success' : 'error',
                text: data.message ?? (data.success ? 'Profile synced successfully.' : 'Sync failed.'),
            });
            if (data.success) {
                await fetchProfileData();
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Profile sync failed. Please try again.';
            setProfileSyncMessage({ type: 'error', text: msg });
        } finally {
            setProfileSyncing(false);
        }
    };

    useEffect(() => {
        fetchPosts();
        fetchProfileData();
    }, [user]);

    // ── Posts tab computed ────────────────────────────────────────────────────

    const periodCutoff = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - Number(period));
        return d;
    }, [period]);

    const periodPosts = useMemo(
        () => posts.filter(p => p.publishedAt && new Date(p.publishedAt) >= periodCutoff),
        [posts, periodCutoff],
    );

    const originalPosts = useMemo(() => periodPosts.filter(p => !p.isReply), [periodPosts]);
    const replyPosts = useMemo(() => periodPosts.filter(p => p.isReply), [periodPosts]);

    const summary = useMemo(() => ({
        views: originalPosts.reduce((s, p) => s + p.views, 0),
        likes: originalPosts.reduce((s, p) => s + p.likes, 0),
        replies: originalPosts.reduce((s, p) => s + p.replies, 0),
        reposts: originalPosts.reduce((s, p) => s + p.reposts, 0),
        quotes: originalPosts.reduce((s, p) => s + p.quotes, 0),
        postCount: originalPosts.length,
    }), [originalPosts]);

    const topPosts = useMemo(
        () => [...(postView === 'replies' ? replyPosts : originalPosts)]
            .sort((a, b) => b.weightedEngagement - a.weightedEngagement)
            .slice(0, 10),
        [originalPosts, replyPosts, postView],
    );

    const replySummary = useMemo(() => ({
        count: replyPosts.length,
        avgViews: replyPosts.length ? Math.round(replyPosts.reduce((s, p) => s + p.views, 0) / replyPosts.length) : 0,
        avgLikes: replyPosts.length ? Math.round(replyPosts.reduce((s, p) => s + p.likes, 0) / replyPosts.length) : 0,
    }), [replyPosts]);

    const conversationRate = useMemo(() => {
        if (!originalPosts.length) return 0;
        const withReplies = originalPosts.filter(p => p.replies > 0).length;
        return Math.round((withReplies / originalPosts.length) * 100);
    }, [originalPosts]);

    // Post length vs. performance: Short (≤100), Medium (101–280), Long (>280)
    const postLengthStats = useMemo(() => {
        const buckets = [
            { label: 'Short', sublabel: '≤ 100 chars', posts: originalPosts.filter(p => (p.content?.text?.length ?? 0) <= 100) },
            { label: 'Medium', sublabel: '101–280 chars', posts: originalPosts.filter(p => { const l = p.content?.text?.length ?? 0; return l > 100 && l <= 280; }) },
            { label: 'Long', sublabel: '> 280 chars', posts: originalPosts.filter(p => (p.content?.text?.length ?? 0) > 280) },
        ];
        return buckets.map(b => ({
            label: b.label,
            sublabel: b.sublabel,
            count: b.posts.length,
            avgViews: b.posts.length ? Math.round(b.posts.reduce((s, p) => s + p.views, 0) / b.posts.length) : 0,
            avgLikes: b.posts.length ? Math.round(b.posts.reduce((s, p) => s + p.likes, 0) / b.posts.length) : 0,
            avgReplies: b.posts.length ? Math.round(b.posts.reduce((s, p) => s + p.replies, 0) / b.posts.length) : 0,
            avgScore: b.posts.length ? Math.round(b.posts.reduce((s, p) => s + p.weightedEngagement, 0) / b.posts.length) : 0,
            totalViews: b.posts.reduce((s, p) => s + p.views, 0),
            totalLikes: b.posts.reduce((s, p) => s + p.likes, 0),
            totalReplies: b.posts.reduce((s, p) => s + p.replies, 0),
            totalScore: b.posts.reduce((s, p) => s + p.weightedEngagement, 0),
        }));
    }, [originalPosts]);


    // ── Followers tab computed ────────────────────────────────────────────────

    const filteredFollowerHistory = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - Number(followerPeriod));
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        return profileHistory.filter(s => s.snapshot_date >= cutoffStr);
    }, [profileHistory, followerPeriod]);

    const followerChartData = filteredFollowerHistory.map(row => ({
        date: new Date(row.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: row.follower_count,
        change: row.follower_net_change,
    }));

    const followerSummary = useMemo(() => {
        if (filteredFollowerHistory.length < 2) return null;
        const first = filteredFollowerHistory[0];
        const last = filteredFollowerHistory[filteredFollowerHistory.length - 1];
        const netChange = last.follower_count - first.follower_count;
        const gained = filteredFollowerHistory.reduce((s, r) => s + Math.max(0, r.follower_net_change), 0);
        const lost = filteredFollowerHistory.reduce((s, r) => s + Math.abs(Math.min(0, r.follower_net_change)), 0);
        return {
            netChange,
            gained,
            lost,
            avgPerDay: +(netChange / filteredFollowerHistory.length).toFixed(1),
            currentCount: last.follower_count,
        };
    }, [filteredFollowerHistory]);

    // Profile avatar fallback initials
    const profileInitials = profileSnapshot
        ? (profileSnapshot.display_name || profileSnapshot.username || '?')
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : '?';

    if (loading) {
        return (
            <div className="flex h-full min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Best performing post length bucket (by score, depending on mode, only if count >= 1)
    const bestLengthBucket = postLengthStats.reduce<typeof postLengthStats[0] | null>((best, b) => {
        if (b.count === 0) return best;
        const score = lengthStatMode === 'average' ? b.avgScore : b.totalScore;
        const bestScore = best ? (lengthStatMode === 'average' ? best.avgScore : best.totalScore) : 0;
        if (!best || score > bestScore) return b;
        return best;
    }, null);

    return (
        <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Social Analytics</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {lastSynced
                            ? `Last synced ${formatRelativeTime(lastSynced)} · Auto-syncs daily at 7 AM EST`
                            : 'Sync to pull the latest data from all platforms'}
                    </p>
                </div>
                <Button onClick={handleSync} disabled={syncing} className="gap-2 self-start sm:self-auto shrink-0">
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {syncing ? 'Syncing…' : 'Sync Now'}
                </Button>
            </div>

            {syncMessage && (
                <div className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
                    syncMessage.type === 'success'
                        ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
                        : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
                }`}>
                    {syncMessage.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>{syncMessage.text}</span>
                </div>
            )}

            {/* ── Page Tabs ────────────────────────────────────────────────── */}
            <div className="flex border-b -mb-2">
                {(['posts', 'followers'] as PageTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setPageTab(tab)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                            pageTab === tab
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab === 'posts' ? 'Posts' : 'Followers'}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* POSTS TAB                                                      */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {pageTab === 'posts' && (
                <>
                    {/* Period selector */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">Period</span>
                        <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
                            {(['7', '14', '30', '90'] as Period[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => { setPeriod(p); setSyncMessage(null); }}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                                        period === p ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {p}d
                                </button>
                            ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                            {summary.postCount} post{summary.postCount !== 1 ? 's' : ''}
                            {replyPosts.length > 0 && ` · ${replyPosts.length} repl${replyPosts.length !== 1 ? 'ies' : 'y'}`}
                        </span>
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <MetricCard icon={<Eye className="h-4 w-4" />} label="Views" value={summary.views} colorClass="text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400" />
                        <MetricCard icon={<Heart className="h-4 w-4" />} label="Likes" value={summary.likes} colorClass="text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400" />
                        <MetricCard icon={<MessageCircle className="h-4 w-4" />} label="Replies" value={summary.replies} colorClass="text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400" />
                        <MetricCard icon={<Repeat2 className="h-4 w-4" />} label="Reposts" value={summary.reposts} colorClass="text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400" />
                        <MetricCard icon={<MessageSquare className="h-4 w-4" />} label="Quotes" value={summary.quotes} colorClass="text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400" />
                    </div>

                    {/* Reply Activity */}
                    {(conversationRate > 0 || replyPosts.length > 0) && (
                        <Card>
                            <CardContent className="p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reply Activity</p>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xl font-bold">{conversationRate}%</span>
                                        <span className="text-xs text-muted-foreground">Conversation rate</span>
                                        <span className="text-[10px] text-muted-foreground">Posts that got ≥1 reply</span>
                                    </div>
                                    {replyPosts.length > 0 && (
                                        <>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xl font-bold">{replyPosts.length}</span>
                                                <span className="text-xs text-muted-foreground">Comments made</span>
                                                <span className="text-[10px] text-muted-foreground">Reply posts by you</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xl font-bold">{formatNumber(replySummary.avgViews)}</span>
                                                <span className="text-xs text-muted-foreground">Avg views / reply</span>
                                                <span className="text-[10px] text-muted-foreground">vs {formatNumber(summary.postCount ? Math.round(summary.views / summary.postCount) : 0)} on posts</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xl font-bold">{formatNumber(replySummary.avgLikes)}</span>
                                                <span className="text-xs text-muted-foreground">Avg likes / reply</span>
                                                <span className="text-[10px] text-muted-foreground">vs {formatNumber(summary.postCount ? Math.round(summary.likes / summary.postCount) : 0)} on posts</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── Post Length vs. Performance ───────────────────────── */}
                    {originalPosts.length >= 3 && (
                        <div>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <BarChart2 className="h-5 w-5 text-muted-foreground" />
                                    <h2 className="text-lg font-semibold">Post Length vs. Performance</h2>
                                    {bestLengthBucket && (
                                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                                            {bestLengthBucket.label} posts perform best
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
                                    {(['average', 'total'] as const).map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setLengthStatMode(m)}
                                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all capitalize ${
                                                lengthStatMode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {postLengthStats.map(bucket => {
                                    const isBest = bestLengthBucket?.label === bucket.label;
                                    return (
                                        <Card key={bucket.label} className={cn(isBest && 'ring-2 ring-primary/30')}>
                                            <CardContent className="p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold">{bucket.label}</p>
                                                        <p className="text-xs text-muted-foreground">{bucket.sublabel}</p>
                                                    </div>
                                                    <span className={cn(
                                                        'rounded-full px-2 py-0.5 text-xs font-medium',
                                                        isBest ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                                    )}>
                                                        {bucket.count} post{bucket.count !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                {bucket.count === 0 ? (
                                                    <p className="text-sm text-muted-foreground">No posts in this range</p>
                                                ) : (
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="flex flex-col items-center gap-0.5 text-center">
                                                            <Eye className="h-3.5 w-3.5 text-blue-500" />
                                                            <span className="text-sm font-semibold">{formatNumber(lengthStatMode === 'average' ? bucket.avgViews : bucket.totalViews)}</span>
                                                            <span className="text-[10px] text-muted-foreground">{lengthStatMode === 'average' ? 'Avg Views' : 'Total Views'}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-0.5 text-center">
                                                            <Heart className="h-3.5 w-3.5 text-red-500" />
                                                            <span className="text-sm font-semibold">{formatNumber(lengthStatMode === 'average' ? bucket.avgLikes : bucket.totalLikes)}</span>
                                                            <span className="text-[10px] text-muted-foreground">{lengthStatMode === 'average' ? 'Avg Likes' : 'Total Likes'}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-0.5 text-center">
                                                            <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                                                            <span className="text-sm font-semibold">{formatNumber(lengthStatMode === 'average' ? bucket.avgReplies : bucket.totalReplies)}</span>
                                                            <span className="text-[10px] text-muted-foreground">{lengthStatMode === 'average' ? 'Avg Replies' : 'Total Replies'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Top Posts ─────────────────────────────────────────── */}
                    <div>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <BarChart2 className="h-5 w-5 text-muted-foreground" />
                                <h2 className="text-lg font-semibold">
                                    Top 10 {postView === 'replies' ? 'Replies' : 'Posts'} · {PERIOD_LABELS[period]}
                                </h2>
                            </div>
                            <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
                                {(['posts', 'replies'] as PostView[]).map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setPostView(v)}
                                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all capitalize ${
                                            postView === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {v === 'posts' ? `Posts (${originalPosts.length})` : `My Replies (${replyPosts.length})`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {topPosts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
                                <TrendingUp className="mb-3 h-12 w-12 opacity-25" />
                                <p className="font-medium">
                                    {postView === 'replies' ? 'No replies found for this period' : 'No posts found for this period'}
                                </p>
                                <p className="mt-1 text-sm">
                                    {postView === 'replies'
                                        ? 'Sync your analytics — reply data is populated on the next sync after this feature is enabled.'
                                        : 'Try syncing your analytics or selecting a longer time range.'}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {topPosts.map((post, i) => (
                                    <PostCard key={post.id} post={post} rank={i + 1} />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* FOLLOWERS TAB                                                  */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {pageTab === 'followers' && (
                <>
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-semibold">Followers</h2>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleProfileSync}
                            disabled={profileSyncing}
                            className="gap-1.5"
                        >
                            {profileSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            {profileSyncing ? 'Syncing…' : 'Sync Profile'}
                        </Button>
                    </div>

                    {profileSyncMessage && (
                        <div className={cn(
                            'flex items-start gap-2.5 rounded-lg border p-3 text-sm',
                            profileSyncMessage.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
                                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
                        )}>
                            {profileSyncMessage.type === 'success'
                                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                            <span>{profileSyncMessage.text}</span>
                        </div>
                    )}

                    {profileLoading ? (
                        <Card>
                            <CardContent className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </CardContent>
                        </Card>
                    ) : profileSnapshot === null ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                                <Users className="h-10 w-10 text-muted-foreground opacity-40" />
                                <div>
                                    <p className="font-medium">No follower data yet</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Sync your Threads profile to start tracking follower growth.
                                    </p>
                                </div>
                                <Button onClick={handleProfileSync} disabled={profileSyncing} className="gap-2">
                                    {profileSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    {profileSyncing ? 'Syncing…' : 'Sync Profile'}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Profile identity card */}
                            <Card>
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="shrink-0">
                                            {profileSnapshot.profile_picture_url ? (
                                                <img
                                                    src={profileSnapshot.profile_picture_url}
                                                    alt={profileSnapshot.display_name ?? profileSnapshot.username ?? 'Profile'}
                                                    className="h-14 w-14 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                                                    {profileInitials}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-base font-semibold leading-tight">
                                                    {profileSnapshot.display_name || profileSnapshot.username || profileSnapshot.account_name || 'Threads Account'}
                                                </span>
                                                {profileSnapshot.is_verified && (
                                                    <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" aria-label="Verified" />
                                                )}
                                            </div>
                                            {profileSnapshot.username && (
                                                <p className="text-sm text-muted-foreground">@{profileSnapshot.username}</p>
                                            )}
                                            {profileSnapshot.biography && (
                                                <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                                                    {profileSnapshot.biography}
                                                </p>
                                            )}
                                        </div>
                                        {/* Current follower count prominently */}
                                        <div className="shrink-0 text-right">
                                            <p className="text-2xl font-bold">{formatNumber(profileSnapshot.follower_count)}</p>
                                            <p className="text-xs text-muted-foreground">followers</p>
                                        </div>
                                    </div>

                                    {/* 7d profile stats */}
                                    <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                                        <ProfileStat label="7d Views" value={formatNumber(profileSnapshot.views_count)} />
                                        <ProfileStat label="7d Likes" value={formatNumber(profileSnapshot.likes_count)} />
                                        <ProfileStat label="7d Reposts" value={formatNumber(profileSnapshot.reposts_count)} />
                                        <ProfileStat label="7d Quotes" value={formatNumber(profileSnapshot.quotes_count)} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ── Follower Period Selector ────────────────── */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-muted-foreground">Period</span>
                                <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
                                    {(['7', '30', '90'] as FollowerPeriod[]).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setFollowerPeriod(p)}
                                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                                                followerPeriod === p ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {FOLLOWER_PERIOD_LABELS[p]}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {filteredFollowerHistory.length} snapshot{filteredFollowerHistory.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* ── Summary Stats ───────────────────────────── */}
                            {followerSummary ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {/* Net Change */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className={cn(
                                                'mb-3 inline-flex rounded-lg p-2',
                                                followerSummary.netChange >= 0
                                                    ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
                                                    : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                                            )}>
                                                {followerSummary.netChange >= 0
                                                    ? <TrendingUp className="h-4 w-4" />
                                                    : <TrendingDown className="h-4 w-4" />}
                                            </div>
                                            <div className={cn(
                                                'text-2xl font-bold',
                                                followerSummary.netChange > 0 ? 'text-green-600 dark:text-green-400' : followerSummary.netChange < 0 ? 'text-red-600 dark:text-red-400' : ''
                                            )}>
                                                {followerSummary.netChange > 0 ? '+' : ''}{formatNumber(followerSummary.netChange)}
                                            </div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">Net change</div>
                                        </CardContent>
                                    </Card>
                                    {/* Gained */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="mb-3 inline-flex rounded-lg p-2 bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
                                                <TrendingUp className="h-4 w-4" />
                                            </div>
                                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">+{formatNumber(followerSummary.gained)}</div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">Gained</div>
                                        </CardContent>
                                    </Card>
                                    {/* Lost */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="mb-3 inline-flex rounded-lg p-2 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
                                                <TrendingDown className="h-4 w-4" />
                                            </div>
                                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">-{formatNumber(followerSummary.lost)}</div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">Lost</div>
                                        </CardContent>
                                    </Card>
                                    {/* Avg/day */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="mb-3 inline-flex rounded-lg p-2 bg-muted text-muted-foreground">
                                                <Users className="h-4 w-4" />
                                            </div>
                                            <div className={cn(
                                                'text-2xl font-bold',
                                                followerSummary.avgPerDay > 0 ? 'text-green-600 dark:text-green-400' : followerSummary.avgPerDay < 0 ? 'text-red-600 dark:text-red-400' : ''
                                            )}>
                                                {followerSummary.avgPerDay > 0 ? '+' : ''}{followerSummary.avgPerDay}
                                            </div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">Avg per day</div>
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : filteredFollowerHistory.length < 2 ? (
                                <Card>
                                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                        Not enough data for this period — sync your profile daily to build history.
                                    </CardContent>
                                </Card>
                            ) : null}

                            {/* ── Follower Trend Chart ─────────────────────── */}
                            {followerChartData.length > 1 && (
                                <Card>
                                    <CardContent className="p-5">
                                        <p className="mb-4 text-sm font-medium text-muted-foreground">
                                            Follower trend · {FOLLOWER_PERIOD_LABELS[followerPeriod]}
                                        </p>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <AreaChart data={followerChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(v: number) => formatNumber(v)}
                                                    width={52}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: 'hsl(var(--card))',
                                                        border: '1px solid hsl(var(--border))',
                                                        borderRadius: '8px',
                                                        fontSize: 12,
                                                    }}
                                                    formatter={(value: number, name: string) => [
                                                        formatNumber(value),
                                                        name === 'followers' ? 'Followers' : 'Daily change',
                                                    ]}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="followers"
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={2}
                                                    fill="url(#followerGradient)"
                                                    dot={false}
                                                    activeDot={{ r: 4 }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            )}

                            {/* ── Daily Breakdown ──────────────────────────── */}
                            {filteredFollowerHistory.length > 0 && (
                                <div>
                                    <div className="mb-3 flex items-center gap-2">
                                        <h3 className="text-base font-semibold">Daily Breakdown</h3>
                                        <span className="text-sm text-muted-foreground">· most recent first</span>
                                    </div>
                                    <Card>
                                        <CardContent className="p-0">
                                            <div className="divide-y">
                                                {[...filteredFollowerHistory].reverse().slice(0, 30).map(row => {
                                                    const change = row.follower_net_change;
                                                    const dateLabel = new Date(row.snapshot_date).toLocaleDateString('en-US', {
                                                        weekday: 'short', month: 'short', day: 'numeric',
                                                    });
                                                    return (
                                                        <div key={row.snapshot_date} className="flex items-center justify-between px-4 py-3">
                                                            <span className="text-sm text-muted-foreground">{dateLabel}</span>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-sm">{formatNumber(row.follower_count)} followers</span>
                                                                <span className={cn(
                                                                    'w-16 text-right text-sm font-medium',
                                                                    change > 0 ? 'text-green-600 dark:text-green-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                                                                )}>
                                                                    {change > 0 ? '+' : ''}{change !== 0 ? formatNumber(change) : '—'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function ProfileStat({
    label,
    value,
    sub,
    subColor,
}: {
    label: string;
    value: string;
    sub?: string;
    subColor?: string;
}) {
    return (
        <div className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-lg font-bold leading-none">{value}</span>
            {sub && <span className={cn('text-xs font-medium', subColor ?? 'text-muted-foreground')}>{sub}</span>}
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

function MetricCard({ icon, label, value, colorClass }: { icon: ReactNode; label: string; value: number; colorClass: string }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className={`mb-3 inline-flex rounded-lg p-2 ${colorClass}`}>{icon}</div>
                <div className="text-2xl font-bold">{formatNumber(value)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
            </CardContent>
        </Card>
    );
}

function PostCard({ post, rank }: { post: PostAnalytics; rank: number }) {
    const text = post.content?.text ?? '';
    const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
    const publishedDate = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
    const rankBg = rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : rank === 2 ? 'bg-muted text-muted-foreground dark:bg-slate-800 dark:text-slate-300' : rank === 3 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300' : 'bg-muted text-muted-foreground';

    return (
        <Card className="transition-shadow hover:shadow-sm">
            <CardContent className="p-4">
                <div className="flex gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankBg}`}>{rank}</div>
                    <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-xs font-semibold">{post.accountName}</span>
                            {publishedDate && <span className="text-xs text-muted-foreground">· {publishedDate}</span>}
                            {post.mediaType && post.mediaType !== 'TEXT' && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">{post.mediaType}</span>}
                            {post.permalink && <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="View on Threads"><ExternalLink className="h-3 w-3" /></a>}
                        </div>
                        <p className="text-sm leading-relaxed">{preview || <span className="italic text-muted-foreground">[No text content]</span>}</p>
                    </div>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 border-t pt-3">
                    <InlineMetric icon={<Eye className="h-3.5 w-3.5 text-blue-500" />} value={post.views} label="Views" />
                    <InlineMetric icon={<Heart className="h-3.5 w-3.5 text-red-500" />} value={post.likes} label="Likes" />
                    <InlineMetric icon={<MessageCircle className="h-3.5 w-3.5 text-green-500" />} value={post.replies} label="Replies" />
                    <InlineMetric icon={<Repeat2 className="h-3.5 w-3.5 text-purple-500" />} value={post.reposts} label="Reposts" />
                    <InlineMetric icon={<MessageSquare className="h-3.5 w-3.5 text-amber-500" />} value={post.quotes} label="Quotes" />
                </div>
            </CardContent>
        </Card>
    );
}

function InlineMetric({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
                {icon}
                <span className="text-sm font-semibold">{formatNumber(value)}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
    );
}
