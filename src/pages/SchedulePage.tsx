import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPosts, deletePost } from '@/services/posts';
import { publishPostInstant } from '@/services/publish';
import { getSignedUrl } from '@/services/storage';
import { Post, PostStatus } from '@/types/data';
import { Loader2, Calendar, CheckCircle2, XCircle, Clock, Trash2, ExternalLink, ImagePlus, List, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MonthlyCalendar } from '@/components/calendar/MonthlyCalendar';
import { DayPostsList } from '@/components/calendar/DayPostsList';
import { ScheduledGroupedList } from '@/components/calendar/ScheduledGroupedList';

const PostThumbnail = ({ src, className, style }: { src: string, className?: string, style?: any }) => {
    const [imgSrc, setImgSrc] = useState(src);
    const [failed, setFailed] = useState(false);
    const retriedRef = useRef(false);

    const handleError = () => {
        if (retriedRef.current || failed) {
            setFailed(true);
            return;
        }
        retriedRef.current = true;
        getSignedUrl(src).then(signed => {
            if (signed) {
                setImgSrc(signed);
            } else {
                setFailed(true);
            }
        }).catch(() => setFailed(true));
    };

    if (failed) {
        return (
            <div className={className} style={{ ...style, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImagePlus className="h-8 w-8 text-gray-400" />
            </div>
        );
    }

    return <img src={imgSrc} onError={handleError} className={className} style={style} alt="Media thumbnail" />;
};

export default function SchedulePage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
    const [pushingAll, setPushingAll] = useState(false);
    const [pushStats, setPushStats] = useState({ total: 0, current: 0 });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const data = await getPosts();
            // Filter out drafts as they have their own page
            setPosts(data.filter(p => p.status !== 'draft'));
        } catch (error) {
            console.error('Failed to fetch posts', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this log?')) return;
        try {
            await deletePost(id);
            setPosts(posts.filter(p => p.id !== id));
        } catch (error) {
            alert('Failed to delete post');
        }
    };

    const handleForcePushAll = async () => {
        const failedPosts = posts.filter(p => p.status === 'failed');
        if (failedPosts.length === 0) return;
        if (!confirm(`Are you sure you want to force push all ${failedPosts.length} failed posts right now?`)) return;

        setPushingAll(true);
        setPushStats({ total: failedPosts.length, current: 0 });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < failedPosts.length; i++) {
            const post = failedPosts[i];
            setPushStats({ total: failedPosts.length, current: i + 1 });
            try {
                // Update local status to publishing
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'publishing' } : p));
                
                await publishPostInstant({
                    postId: post.id,
                    platform: post.platform,
                    platformAccountId: post.platformAccountId || '',
                    content: post.content,
                    cleanupMedia: false // Avoid aggressively cleaning media since it might be reused across failed attempts
                });
                successCount++;
            } catch (error) {
                console.error(`Failed to force push post ${post.id}:`, error);
                failCount++;
            }
        }

        alert(`Force push complete. Successfully published ${successCount} posts. ${failCount > 0 ? `Failed ${failCount} posts.` : ''}`);
        setPushingAll(false);
        // Refresh the list to get updated statuses from the DB
        fetchPosts();
    };

    const handleRetry = async (postId: string) => {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        try {
            // Update local status to publishing
            setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'publishing' } : p));
            
            await publishPostInstant({
                postId: post.id,
                platform: post.platform,
                platformAccountId: post.platformAccountId || '',
                content: post.content,
                cleanupMedia: false
            });
            fetchPosts(); // Refresh on success
        } catch (error) {
            console.error(`Failed to retry post ${post.id}:`, error);
            // Revert status to failed with new error if needed
            fetchPosts();
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredPosts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredPosts.map(p => p.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} selected post${selectedIds.size > 1 ? 's' : ''}?`)) return;
        setBulkDeleting(true);
        try {
            await Promise.all([...selectedIds].map(id => deletePost(id)));
            setPosts(posts.filter(p => !selectedIds.has(p.id)));
            setSelectedIds(new Set());
        } catch {
            alert('Failed to delete some posts');
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleDayClick = (date: Date) => {
        setSelectedDate(date);
    };

    const handlePostClick = (postId: string) => {
        window.location.href = `/publish?edit=${postId}`;
    };

    const filteredPosts = posts.filter(post => {
        if (filter === 'all') return true;
        if (filter === 'published') return post.status === 'published';
        if (filter === 'scheduled') return post.status === 'scheduled' || post.status === 'publishing';
        if (filter === 'failed') return post.status === 'failed';
        return true;
    }).sort((a, b) => {
        const dateA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
        const dateB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;

        // For Scheduled posts: Earliest First (Ascending)
        if (filter === 'scheduled') {
            return dateA - dateB;
        }

        // For All/History/Failed: Latest/Newest First (Descending)
        return dateB - dateA;
    });

    // Calculate Monthly Stats
    const monthlyStats = (() => {
        const stats: Record<string, number> = {};

        // Use a map to preserve order: 3 months back -> 3 months forward
        const months = new Map<string, string>(); // Key -> Label
        const today = new Date();

        for (let i = -3; i <= 3; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            stats[key] = 0;
            months.set(key, key);
        }

        posts.forEach(post => {
            const date = post.scheduledTime || post.publishedAt || post.createdAt;
            if (date) {
                const key = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });
                // Only count if it's within our range of interest? Or expand?
                // Visual requirement suggests a strip. Let's just key everything and show what matches or surrounds current.
                if (stats[key] !== undefined) {
                    stats[key]++;
                }
            }
        });

        return Array.from(months.keys()).map(month => ({ month, count: stats[month] }));
    })();

    const getStatusColor = (status: PostStatus) => {
        switch (status) {
            case 'published': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
            case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
            case 'scheduled': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'publishing': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'text-muted-foreground bg-muted dark:bg-gray-800 dark:text-gray-400';
        }
    };

    const getStatusIcon = (status: PostStatus) => {
        switch (status) {
            case 'published': return <CheckCircle2 className="h-4 w-4" />;
            case 'failed': return <XCircle className="h-4 w-4" />;
            case 'scheduled': return <Calendar className="h-4 w-4" />;
            case 'publishing': return <Clock className="h-4 w-4 animate-pulse" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'No date';
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: 'numeric'
        }).format(date);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Schedule & History</h1>
                    <p className="text-muted-foreground mt-2">View your scheduled queue and past publications.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'list' | 'calendar')} className="w-full">
                <TabsList className="w-full md:w-auto">
                    <TabsTrigger value="list" className="flex items-center gap-2">
                        <List className="h-4 w-4" />
                        List
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Calendar
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-6">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex p-1 bg-muted rounded-lg w-full md:w-auto">
                            {(['all', 'scheduled', 'published', 'failed'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => { setFilter(f); setSelectedIds(new Set()); }}
                                    className={cn(
                                        "flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all capitalize",
                                        filter === f
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-background/50"
                                    )}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                        {selectedIds.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting}
                            >
                                {bulkDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete {selectedIds.size} selected
                            </Button>
                        )}
                        </div>

                        {filter === 'failed' && (
                            <div className="flex bg-muted/30 border border-muted p-4 rounded-lg items-center justify-between">
                                <div>
                                    <h3 className="font-semibold">Force Push Failed Posts</h3>
                                    <p className="text-sm text-muted-foreground">This will immediately attempt to publish all your failed posts again.</p>
                                </div>
                                <Button 
                                    onClick={handleForcePushAll}
                                    disabled={pushingAll || filteredPosts.length === 0}
                                    variant="default"
                                >
                                    {pushingAll ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Pushing {pushStats.current}/{pushStats.total}...
                                        </>
                                    ) : (
                                        'Force Push All Now'
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Monthly Stats Strip */}
                        <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0 no-scrollbar">
                            {monthlyStats.map(({ month, count }) => (
                                <div key={month} className="flex flex-col items-center justify-center min-w-[80px] p-3 rounded-lg border bg-card shadow-sm">
                                    <span className="text-xl font-bold">{count}</span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">{month}</span>
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredPosts.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/20 p-12 text-center">
                                <h3 className="text-xl font-semibold">No posts found</h3>
                                <p className="text-muted-foreground mt-2">Filter: {filter}</p>
                            </div>
                        ) : (
                                <ScheduledGroupedList 
                                    posts={filteredPosts}
                                    onEdit={handlePostClick}
                                    onDelete={handleDelete}
                                    onRetry={handleRetry}
                                />
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="calendar" className="mt-6">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <MonthlyCalendar
                                    posts={posts}
                                    onDayClick={handleDayClick}
                                    selectedDate={selectedDate}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                {selectedDate ? (
                                    <DayPostsList
                                        selectedDate={selectedDate}
                                        posts={posts}
                                        onPostClick={handlePostClick}
                                        onPostDelete={handleDelete}
                                    />
                                ) : (
                                    <Card className="p-6">
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <Calendar className="h-12 w-12 text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">
                                                Select a day to view scheduled posts
                                            </p>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
