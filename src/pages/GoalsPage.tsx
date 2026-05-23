import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Save,
    Target,
    MessageCircle,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalSettings {
    daily_post_goal: number;
    daily_comment_goal: number;
}

interface DayProgress {
    date: string;           // "YYYY-MM-DD"
    label: string;          // "Mon Mar 25"
    posts_count: number;
    comments_count: number;
    post_goal: number;
    comment_goal: number;
    posts_hit: boolean;
    comments_hit: boolean;
    is_future: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLast30Days(): string[] {
    const days: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

function formatDayLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GoalStatusBadge({ hit, isToday, isFuture }: { hit: boolean; isToday: boolean; isFuture: boolean }) {
    if (isFuture) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MinusCircle className="h-3.5 w-3.5" />
            </span>
        );
    }
    if (hit) {
        return (
            <span className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                isToday ? "text-emerald-500" : "text-emerald-600"
            )}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Hit
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-500">
            <XCircle className="h-3.5 w-3.5" />
            Missed
        </span>
    );
}

function ProgressBar({ value, goal }: { value: number; goal: number }) {
    const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
    return (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
                className={cn(
                    "h-full rounded-full transition-all",
                    pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-primary" : "bg-muted"
                )}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GoalsPage() {
    const { user } = useAuthStore();

    const [goalSettings, setGoalSettings] = useState<GoalSettings>({
        daily_post_goal: 1,
        daily_comment_goal: 5,
    });
    const [draftSettings, setDraftSettings] = useState<GoalSettings>({
        daily_post_goal: 1,
        daily_comment_goal: 5,
    });
    const [days, setDays] = useState<DayProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    // ── Fetch data ────────────────────────────────────────────────────────────

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Load goal settings
            const { data: goalRow } = await supabase
                .from('goals')
                .select('daily_post_goal, daily_comment_goal')
                .eq('user_id', user.id)
                .eq('platform', 'threads')
                .maybeSingle();

            const settings: GoalSettings = goalRow ?? {
                daily_post_goal: 1,
                daily_comment_goal: 5,
            };
            setGoalSettings(settings);
            setDraftSettings(settings);

            // Load comment progress for last 30 days
            const dateRange = getLast30Days();
            const since = dateRange[0];
            const until = dateRange[dateRange.length - 1];

            const { data: progressRows } = await supabase
                .from('goal_progress')
                .select('date, comments_count, synced_at')
                .eq('user_id', user.id)
                .eq('platform', 'threads')
                .gte('date', since)
                .lte('date', until);

            const commentsByDate: Record<string, number> = {};
            let latestSynced: string | null = null;
            for (const row of (progressRows ?? [])) {
                commentsByDate[row.date] = row.comments_count;
                if (!latestSynced || row.synced_at > latestSynced) {
                    latestSynced = row.synced_at;
                }
            }
            if (latestSynced) setLastSynced(latestSynced);

            // Load published post counts per day from scheduled_posts
            const { data: postRows } = await supabase
                .from('scheduled_posts')
                .select('published_at')
                .eq('user_id', user.id)
                .eq('platform', 'threads')
                .eq('status', 'published')
                .gte('published_at', since + 'T00:00:00Z')
                .lte('published_at', until + 'T23:59:59Z');

            const postsByDate: Record<string, number> = {};
            for (const row of (postRows ?? [])) {
                const date = row.published_at.slice(0, 10);
                postsByDate[date] = (postsByDate[date] ?? 0) + 1;
            }

            const today = todayStr();
            const built: DayProgress[] = dateRange.map(date => ({
                date,
                label: formatDayLabel(date),
                posts_count: postsByDate[date] ?? 0,
                comments_count: commentsByDate[date] ?? 0,
                post_goal: settings.daily_post_goal,
                comment_goal: settings.daily_comment_goal,
                posts_hit: (postsByDate[date] ?? 0) >= settings.daily_post_goal,
                comments_hit: (commentsByDate[date] ?? 0) >= settings.daily_comment_goal,
                is_future: date > today,
            }));

            setDays(built);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Save goal settings ────────────────────────────────────────────────────

    const saveSettings = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await supabase
                .from('goals')
                .upsert(
                    {
                        user_id: user.id,
                        platform: 'threads',
                        daily_post_goal: draftSettings.daily_post_goal,
                        daily_comment_goal: draftSettings.daily_comment_goal,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id,platform' }
                );
            await fetchData();
        } finally {
            setSaving(false);
        }
    };

    // ── Force sync ────────────────────────────────────────────────────────────

    const handleSync = async () => {
        if (!user) return;
        setSyncing(true);
        setSyncError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const resp = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-goal-progress`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ source: 'manual' }),
                }
            );
            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                setSyncError(body.error ?? 'Sync failed');
            } else {
                await fetchData();
            }
        } catch (e: any) {
            setSyncError(e.message ?? 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    // ── Stats ─────────────────────────────────────────────────────────────────

    const pastDays = days.filter(d => !d.is_future && d.date !== todayStr());
    const bothHit = pastDays.filter(d => d.posts_hit && d.comments_hit).length;
    const bothMissed = pastDays.filter(d => !d.posts_hit && !d.comments_hit).length;
    const streak = (() => {
        let s = 0;
        for (let i = days.length - 1; i >= 0; i--) {
            const d = days[i];
            if (d.is_future || d.date === todayStr()) continue;
            if (d.posts_hit && d.comments_hit) s++;
            else break;
        }
        return s;
    })();

    // ── Render ────────────────────────────────────────────────────────────────

    const settingsChanged =
        draftSettings.daily_post_goal !== goalSettings.daily_post_goal ||
        draftSettings.daily_comment_goal !== goalSettings.daily_comment_goal;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Track your daily posting and engagement targets
                    </p>
                </div>
                {/* Platform tab — Threads only for now */}
                <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                    <button className="px-3 py-1.5 rounded-md text-sm font-medium bg-background shadow-sm">
                        Threads
                    </button>
                </div>
            </div>

            {/* Goal Settings */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Daily Targets
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-6 items-end">
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                Posts per day
                            </Label>
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                value={draftSettings.daily_post_goal}
                                onChange={e =>
                                    setDraftSettings(s => ({
                                        ...s,
                                        daily_post_goal: Math.max(1, parseInt(e.target.value) || 1),
                                    }))
                                }
                                className="w-28"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm flex items-center gap-1.5">
                                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                Comments per day
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                max={200}
                                value={draftSettings.daily_comment_goal}
                                onChange={e =>
                                    setDraftSettings(s => ({
                                        ...s,
                                        daily_comment_goal: Math.max(0, parseInt(e.target.value) || 0),
                                    }))
                                }
                                className="w-28"
                            />
                        </div>
                        <Button
                            onClick={saveSettings}
                            disabled={!settingsChanged || saving}
                            size="sm"
                            className="gap-2"
                        >
                            {saving ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            Save
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Summary stats */}
            {!loading && pastDays.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Days both hit</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{bothHit}</p>
                            <p className="text-xs text-muted-foreground">of {pastDays.length} days</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Days missed both</p>
                            <p className="text-2xl font-bold text-rose-500 mt-0.5">{bothMissed}</p>
                            <p className="text-xs text-muted-foreground">of {pastDays.length} days</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Current streak</p>
                            <p className="text-2xl font-bold mt-0.5">{streak}</p>
                            <p className="text-xs text-muted-foreground">days in a row</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Progress list */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Last 30 Days</CardTitle>
                        <div className="flex items-center gap-3">
                            {lastSynced && (
                                <span className="text-xs text-muted-foreground">
                                    Synced {new Date(lastSynced).toLocaleString()}
                                </span>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSync}
                                disabled={syncing}
                                className="gap-2"
                            >
                                <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                                {syncing ? 'Syncing…' : 'Sync Now'}
                            </Button>
                        </div>
                    </div>
                    {syncError && (
                        <p className="text-xs text-rose-500 mt-1">{syncError}</p>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                            Loading…
                        </div>
                    ) : (
                        <div className="divide-y">
                            {/* Column headers */}
                            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs text-muted-foreground font-medium bg-muted/30">
                                <span>Date</span>
                                <span>Posts</span>
                                <span>Comments</span>
                                <span className="w-16 text-right">Status</span>
                            </div>

                            {[...days].reverse().map(day => {
                                const isToday = day.date === todayStr();
                                const allHit = day.posts_hit && day.comments_hit;
                                const noneHit = !day.posts_hit && !day.comments_hit;

                                return (
                                    <div
                                        key={day.date}
                                        className={cn(
                                            "grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center",
                                            isToday && "bg-primary/5",
                                            day.is_future && "opacity-40"
                                        )}
                                    >
                                        {/* Date */}
                                        <div>
                                            <span className={cn(
                                                "text-sm",
                                                isToday && "font-semibold"
                                            )}>
                                                {day.label}
                                            </span>
                                            {isToday && (
                                                <span className="ml-2 text-xs text-primary font-medium">Today</span>
                                            )}
                                        </div>

                                        {/* Posts */}
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className={cn(
                                                    "font-medium",
                                                    day.is_future ? "text-muted-foreground" :
                                                        day.posts_hit ? "text-emerald-600" : "text-foreground"
                                                )}>
                                                    {day.posts_count}
                                                </span>
                                                <span className="text-muted-foreground text-xs">/ {day.post_goal}</span>
                                            </div>
                                            <ProgressBar value={day.posts_count} goal={day.post_goal} />
                                        </div>

                                        {/* Comments */}
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className={cn(
                                                    "font-medium",
                                                    day.is_future ? "text-muted-foreground" :
                                                        day.comments_hit ? "text-emerald-600" : "text-foreground"
                                                )}>
                                                    {day.comments_count}
                                                </span>
                                                <span className="text-muted-foreground text-xs">/ {day.comment_goal}</span>
                                            </div>
                                            <ProgressBar value={day.comments_count} goal={day.comment_goal} />
                                        </div>

                                        {/* Status */}
                                        <div className="w-16 text-right">
                                            {day.is_future ? (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            ) : allHit ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Hit
                                                </span>
                                            ) : noneHit ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-500">
                                                    <XCircle className="h-3.5 w-3.5" /> Missed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                                                    <MinusCircle className="h-3.5 w-3.5" /> Partial
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
