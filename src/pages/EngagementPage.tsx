import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import {
    Loader2,
    RefreshCw,
    Clock,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Info,
    TrendingUp,
    BarChart3,
    ChevronDown,
    ChevronUp,
    LayoutGrid,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import {
    PostAnalytics,
    calculateWeightedScore,
    normalizeAnalytics,
    formatRelativeTime,
    ENGAGEMENT_WEIGHTS,
    formatNumber,
} from '@/lib/analytics';
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const TIME_LABELS = [
    '12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am',
    '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'
];

// A single consistent accent color throughout the page
const ACCENT = '#4f46e5';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HourSlot {
    hour: number;
    label: string;
    postCount: number;
    totalEngagement: number;   // raw sum
    weightedScore: number;     // weighted avg
}

interface ChartDataPoint {
    hour: number;
    label: string;
    [key: string]: string | number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatHour(hour: number) {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
}

function buildHourSlots(posts: PostAnalytics[], dayFilter?: number): HourSlot[] {
    const slots: HourSlot[] = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: TIME_LABELS[h],
        postCount: 0,
        totalEngagement: 0,
        weightedScore: 0,
    }));

    posts.forEach(post => {
        if (!post.publishedAt) return;
        const d = new Date(post.publishedAt);
        if (dayFilter !== undefined && d.getDay() !== dayFilter) return;
        const h = d.getHours();
        slots[h].postCount++;
        slots[h].totalEngagement += post.engagement;
        slots[h].weightedScore += post.weightedEngagement;
    });

    // Convert sums to averages for slots with data
    return slots.map(s => ({
        ...s,
        weightedScore: s.postCount > 0 ? s.weightedScore / s.postCount : 0,
    }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CurrentTimeIndicator({ hour }: { hour: number }) {
    const isNow = hour === new Date().getHours();
    return (
        <div className="w-4 flex justify-center shrink-0">
            {isNow ? (
                <div className="relative flex h-2 w-2 items-center justify-center">
                    <span className="absolute h-full w-full rounded-full bg-emerald-500 animate-ping opacity-60" />
                    <span className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
            ) : null}
        </div>
    );
}

function ScoreBadge({ rank }: { rank: number }) {
    const emojis = ['🥇', '🥈', '🥉'];
    const hasMedal = rank >= 0 && rank <= 2;
    return (
        <div className="w-5 flex justify-center shrink-0">
            {hasMedal ? <span className="text-sm">{emojis[rank]}</span> : null}
        </div>
    );
}

interface HourRowProps {
    slot: HourSlot;
    maxScore: number;
    rank: number; // -1 if not top 3
    isCurrentHour: boolean;
}

function HourRow({ slot, maxScore, rank, isCurrentHour }: HourRowProps) {
    const barWidth = maxScore > 0 ? Math.max(2, (slot.weightedScore / maxScore) * 100) : 2;
    const hasData = slot.postCount > 0;

    return (
        <div
            className={`group relative flex items-center gap-4 px-4 py-2.5 rounded-lg transition-colors ${
                isCurrentHour
                    ? 'bg-emerald-950/20 border border-emerald-900/30'
                    : rank >= 0
                    ? 'bg-indigo-950/20 border border-indigo-900/30'
                    : 'hover:bg-muted/30 border border-transparent'
            }`}
        >
            {/* 1. Hour label */}
            <div className="w-14 shrink-0 text-[11px] font-bold text-muted-foreground tabular-nums text-right">
                {formatHour(slot.hour)}
            </div>

            {/* 2. Status Indicators (Fixed width to avoid jumping) */}
            <div className="flex items-center gap-1 w-11 shrink-0 justify-center">
                <CurrentTimeIndicator hour={slot.hour} />
                <ScoreBadge rank={rank} />
            </div>

            {/* 3. Bar */}
            <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                {hasData && (
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${barWidth}%`,
                            backgroundColor: isCurrentHour ? '#10b981' : ACCENT,
                            opacity: rank >= 0 ? 1 : 0.55,
                        }}
                    />
                )}
            </div>

            {/* 4. Activity Column */}
            <div className="w-20 shrink-0 text-right">
                {hasData ? (
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums opacity-80">
                        {slot.postCount} posts
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/20">—</span>
                )}
            </div>
        </div>
    );
}

interface TopTimeSectionProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    slots: HourSlot[]; // all 24h for today
    scoreFn: (s: HourSlot) => number;
    topCount?: number;
}

function TopTimeSection({ title, description, icon, slots, scoreFn, topCount = 3 }: TopTimeSectionProps) {
    const currentHour = new Date().getHours();
    const ranked = [...slots]
        .filter(s => s.postCount > 0)
        .sort((a, b) => scoreFn(b) - scoreFn(a));
    const topHours = new Set(ranked.slice(0, topCount).map(s => s.hour));

    // If no data yet, show placeholder cards
    if (ranked.length === 0) {
        return (
            <Card className="border-none shadow-md bg-card">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        {icon} {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        {[...Array(topCount)].map((_, i) => (
                            <div key={i} className="flex-1 rounded-xl border-2 border-dashed border-muted/60 p-4 flex flex-col items-center gap-1 opacity-40">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">No data yet</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground/70 text-center">
                        Post and sync to start building your engagement profile.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const topSlots = ranked.slice(0, topCount);
    const maxScore = scoreFn(ranked[0]);

    return (
        <Card className="border-none shadow-md bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    {icon} {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex gap-2">
                    {topSlots.map((slot, i) => {
                        const score = scoreFn(slot);
                        const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                        const isNow = slot.hour === currentHour;
                        return (
                            <div
                                key={slot.hour}
                                className={`flex-1 rounded-xl p-4 flex flex-col gap-2 border transition-all ${
                                    i === 0
                                        ? 'bg-indigo-600 border-indigo-500/50 text-white shadow-[0_0_30px_rgba(79,70,229,0.4)] relative z-10'
                                        : 'bg-muted/20 border-border/50 hover:bg-muted/30'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${ i === 0 ? 'text-indigo-100' : 'text-muted-foreground'}`}>
                                        Rank #{i + 1}
                                    </span>
                                    <div className="scale-75 origin-right">
                                        <CurrentTimeIndicator hour={slot.hour} />
                                    </div>
                                </div>
                                <div className={`text-2xl sm:text-3xl font-bold leading-none ${i === 0 ? 'text-white' : 'text-foreground'} my-1`}>
                                    {formatHour(slot.hour)}
                                </div>
                                <div className={`text-[11px] font-medium opacity-90 ${i === 0 ? 'text-indigo-100' : 'text-muted-foreground'}`}>
                                    {slot.postCount} posts · {pct}% potential
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[11px] text-muted-foreground/50 italic pt-2">
                    Based on {ranked.reduce((s, x) => s + x.postCount, 0)} posts published on this day of week.
                    {ranked.reduce((s, x) => s + x.postCount, 0) < 5 && ' (Limited data — results will refine with more posts.)'}
                </p>
            </CardContent>
        </Card>
    );
}

// ─── Daily Details Table ──────────────────────────────────────────────────────

function DailyDetails({ slots }: { slots: HourSlot[] }) {
    const [expanded, setExpanded] = useState(false);
    const currentHour = new Date().getHours();

    const slotsWithData = slots.filter(s => s.postCount > 0);
    const sorted = [...slotsWithData].sort((a, b) => b.weightedScore - a.weightedScore);
    const topHours = new Set(sorted.slice(0, 3).map(s => s.hour));
    const maxScore = sorted[0]?.weightedScore ?? 0;

    // Show hours 6am–11pm by default; everything when expanded
    const visibleSlots = expanded
        ? slots
        : slots.filter(s => s.hour >= 6 && s.hour <= 23);

    return (
        <Card className="border-none shadow-md bg-card">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-indigo-500" />
                            Hour-by-Hour Breakdown
                        </CardTitle>
                        <CardDescription>
                            All 24 hours for today — based on posts published on the same day of the week.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Column headers */}
                <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20">
                    <div className="w-14 text-[10px] font-bold uppercase text-muted-foreground text-right">Hour</div>
                    <div className="flex-1 text-[10px] font-bold uppercase text-muted-foreground">Engagement Score</div>
                    <div className="w-20 text-[10px] font-bold uppercase text-muted-foreground">Activity</div>
                </div>

                <div className="divide-y divide-border/30 px-2 py-1">
                    {visibleSlots.map(slot => {
                        const rankIdx = sorted.indexOf(slot);
                        const rank = topHours.has(slot.hour) ? rankIdx : -1;
                        return (
                            <HourRow
                                key={slot.hour}
                                slot={slot}
                                maxScore={maxScore}
                                rank={rank}
                                isCurrentHour={slot.hour === currentHour}
                            />
                        );
                    })}
                </div>

                <button
                    onClick={() => setExpanded(e => !e)}
                    className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors border-t"
                >
                    {expanded ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> Show fewer hours</>
                    ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> Show all 24 hours (including late night / early morning)</>
                    )}
                </button>
            </CardContent>
        </Card>
    );
}

// ─── Weekly Trends Section ────────────────────────────────────────────────────

interface WeeklyTrendCardProps {
    dayName: string;
    dayIndex: number;
    data: ChartDataPoint[];
    isToday: boolean;
}

function WeeklyTrendCard({ dayName, dayIndex, data, isToday }: WeeklyTrendCardProps) {
    const dayData = data.map(d => ({
        label: d.label,
        value: d[dayName] as number
    }));

    const maxVal = Math.max(...dayData.map(d => d.value), 1);
    const peakHour = dayData.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), dayData[0]);

    return (
        <Card className={`overflow-hidden transition-all bg-transparent ${
            isToday 
                ? 'border-2 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] bg-indigo-500/5 relative z-10' 
                : 'border-border/40 hover:border-border/80 shadow-none'
        }`}>
            <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0 relative z-20">
                <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                        {dayName}
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">
                        {peakHour.value > 0 ? `Peak at ${peakHour.label}` : 'No data yet'}
                    </p>
                </div>
                {peakHour.value > 0 && (
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-indigo-600 leading-none">{Math.round(peakHour.value)}</div>
                        <div className="text-[8px] text-muted-foreground uppercase font-medium">Score</div>
                    </div>
                )}
            </CardHeader>
            <div className="h-24 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dayData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`gradient-${dayName}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.2} />
                                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={ACCENT} 
                            strokeWidth={2} 
                            fill={`url(#gradient-${dayName})`}
                            isAnimationActive={true}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-popover border-border rounded p-1.5 shadow-sm text-[10px] text-popover-foreground">
                                            <span className="font-bold">{payload[0].payload.label}:</span> {Math.round(payload[0].value as number)}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

function WeeklyTrendsGrid({ data, todayIndex }: { data: ChartDataPoint[], todayIndex: number }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <LayoutGrid className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Weekly Overview</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {DAYS.map((day, idx) => (
                    <WeeklyTrendCard 
                        key={day} 
                        dayName={day} 
                        dayIndex={idx} 
                        data={data} 
                        isToday={idx === todayIndex} 
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Score Legend ─────────────────────────────────────────────────────────────

function ScoreLegend() {
    return (
        <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 sm:items-start">
                <div className="flex items-center gap-2 shrink-0">
                    <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How scores work</span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed space-y-4">
                    <p>Your engagement score is calculated by weighting interaction types:</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 py-1">
                        <div className="flex justify-between border-b border-muted/20 pb-1"><span>Views</span> <span className="font-bold text-foreground">×{ENGAGEMENT_WEIGHTS.views}</span></div>
                        <div className="flex justify-between border-b border-muted/20 pb-1"><span>Likes</span> <span className="font-bold text-foreground">×{ENGAGEMENT_WEIGHTS.likes}</span></div>
                        <div className="flex justify-between border-b border-muted/20 pb-1"><span>Replies</span> <span className="font-bold text-foreground">×{ENGAGEMENT_WEIGHTS.replies}</span></div>
                        <div className="flex justify-between border-b border-muted/20 pb-1"><span>Reposts</span> <span className="font-bold text-foreground">×{ENGAGEMENT_WEIGHTS.reposts}</span></div>
                        <div className="flex justify-between border-b border-muted/20 pb-1" style={{ gridColumn: 'span 2' }}><span>Quotes</span> <span className="font-bold text-foreground">×{ENGAGEMENT_WEIGHTS.quotes}</span></div>
                    </div>
                    <p className="italic opacity-70 border-l-2 border-indigo-200 pl-3">
                        Recommendations reflect historical data for this specific day of week.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EngagementPage() {
    const [posts, setPosts] = useState<PostAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const { user } = useAuthStore();

    // Today's day index (0=Sun…6=Sat)
    const todayIndex = new Date().getDay();
    const todayName = DAYS[todayIndex];

    const fetchPosts = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('scheduled_posts')
                .select('id, platform_post_id, content, platform, published_at, platform_account_id, account_name, analytics')
                .eq('user_id', user.id)
                .eq('status', 'published')
                .not('published_at', 'is', null);

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

    useEffect(() => {
        fetchPosts();
    }, [user]);

    // Build slots for today's day of week
    const todaySlots = useMemo(() => buildHourSlots(posts, todayIndex), [posts, todayIndex]);

    // Build chart data for all days
    const allDaysChartData = useMemo(() => {
        const data: ChartDataPoint[] = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            label: TIME_LABELS[hour],
        }));

        posts.forEach(post => {
            if (!post.publishedAt) return;
            const d = new Date(post.publishedAt);
            const day = d.getDay();
            const hour = d.getHours();
            const dayName = DAYS[day];

            const current = (data[hour][dayName] as number) || 0;
            const countKey = `${dayName}_count`;
            const currentCount = (data[hour][countKey] as number) || 0;

            data[hour][dayName] = current + post.weightedEngagement;
            data[hour][countKey] = currentCount + 1;
        });

        return data.map(point => {
            const avgPoint = { ...point };
            DAYS.forEach(dayName => {
                const count = (avgPoint[`${dayName}_count`] as number) || 0;
                if (count > 0) {
                    avgPoint[dayName] = Math.round((avgPoint[dayName] as number) / count / 10);
                } else {
                    avgPoint[dayName] = 0;
                }
            });
            return avgPoint;
        });
    }, [posts]);

    if (loading) {
        return (
            <div className="flex h-full min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Engagement Analysis</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Performance breakdown for {todayName} and weekly trends.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        variant="outline"
                        className="gap-2 self-start sm:self-auto shrink-0 shadow-sm"
                    >
                        {syncing
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <RefreshCw className="h-4 w-4" />}
                        {syncing ? 'Syncing…' : 'Sync Latest'}
                    </Button>
                    {lastSynced && (
                        <span className="text-[10px] text-muted-foreground">
                            Last synced {formatRelativeTime(lastSynced)}
                        </span>
                    )}
                </div>
            </div>

            {/* Top Recommendations for Today */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Today's Highlights ({todayName})</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TopTimeSection
                        title="Best Times to Post"
                        description="Based on your posting frequency today."
                        icon={<Clock className="h-4 w-4 text-indigo-500" />}
                        slots={todaySlots}
                        scoreFn={s => s.postCount}
                        topCount={3}
                    />
                    <TopTimeSection
                        title="Best Times for Engagement"
                        description="Times that yield the highest quality interactions."
                        icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
                        slots={todaySlots}
                        scoreFn={s => s.weightedScore}
                        topCount={3}
                    />
                </div>
            </div>

            {/* Weekly Overview Section */}
            <WeeklyTrendsGrid data={allDaysChartData} todayIndex={todayIndex} />

            {/* Hour-by-hour daily breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <DailyDetails slots={todaySlots} />
                </div>
                <div className="space-y-6">
                    <ScoreLegend />
                    <Card className="border-none shadow-sm bg-indigo-950/20">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xs font-bold uppercase text-indigo-400">Quick Tip</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs text-indigo-300/80 leading-relaxed">
                            Looking at the **Weekly Overview**, identify days with higher peaks. If your current day looks flat, consider shifting major announcements to your strongest engagement days.
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Sync toast */}
            {syncMessage && (
                <div className={`fixed bottom-6 right-6 transition-all duration-300 animate-in slide-in-from-right max-w-sm flex items-start gap-2.5 rounded-xl border p-4 shadow-lg z-50 ${
                    syncMessage.type === 'success'
                        ? 'border-green-900 bg-green-950 text-green-300'
                        : 'border-red-900 bg-red-950 text-red-300'
                }`}>
                    {syncMessage.type === 'success'
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                    <div className="grid gap-1">
                        <span className="text-sm font-semibold">{syncMessage.type === 'success' ? 'Success' : 'Error'}</span>
                        <span className="text-xs opacity-80">{syncMessage.text}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
