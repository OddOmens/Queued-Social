import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Post, PostStatus } from '@/types/data';
import { Calendar, CheckCircle2, XCircle, Clock, Trash2, ExternalLink, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { getSignedUrl } from '@/services/storage';

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

interface DayPostsListProps {
    selectedDate: Date;
    posts: Post[];
    onPostClick: (postId: string) => void;
    onPostDelete: (postId: string, e: React.MouseEvent) => void;
}

export function DayPostsList({ selectedDate, posts, onPostClick, onPostDelete }: DayPostsListProps) {
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

    const formatTime = (date: Date | null) => {
        if (!date) return 'No time';
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: 'numeric'
        }).format(date);
    };

    const postsForDay = posts.filter(post => {
        const postDate = post.scheduledTime || post.publishedAt || post.createdAt;
        if (!postDate) return false;
        const d = new Date(postDate);
        return (
            d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear()
        );
    }).sort((a, b) => {
        const dateA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
        const dateB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
        return dateA - dateB;
    });

    const formattedDate = selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    if (postsForDay.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">{formattedDate}</h3>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No posts scheduled for this day</p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => window.location.href = `/publish?date=${selectedDate.toISOString()}`}
                    >
                        Schedule a Post
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{formattedDate}</h3>
                <span className="text-sm text-muted-foreground">
                    {postsForDay.length} {postsForDay.length === 1 ? 'post' : 'posts'}
                </span>
            </div>

            <div className="space-y-3">
                {postsForDay.map(post => (
                    <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row">
                            {/* Status Strip */}
                            <div className={cn("w-full md:w-2 h-2 md:h-auto",
                                post.status === 'published' ? "bg-green-500" :
                                    post.status === 'failed' ? "bg-red-500" :
                                        "bg-yellow-500"
                            )} />

                            <div className="flex-1 p-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide", getStatusColor(post.status))}>
                                                {getStatusIcon(post.status)}
                                                {post.status}
                                            </span>
                                            <span className="text-xs font-semibold px-2 py-0.5 border rounded uppercase text-muted-foreground">
                                                {post.platform}
                                            </span>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                {formatTime(post.scheduledTime || post.createdAt)}
                                            </span>
                                        </div>
                                        <p className="font-medium text-sm text-balance line-clamp-2">
                                            {post.content?.text || <span className="italic text-muted-foreground">No text content</span>}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Image Thumbnails */}
                                        {post.content?.mediaUrls && post.content.mediaUrls.length > 0 && (
                                            <div className="flex items-center justify-center">
                                                <div className="relative w-10 h-10">
                                                    {post.content.mediaUrls.slice(0, 3).map((url: string, idx: number) => (
                                                        <PostThumbnail
                                                            key={idx}
                                                            src={url}
                                                            className="absolute top-0 left-0 w-10 h-10 object-cover rounded-md border shadow-sm bg-background transition-transform hover:scale-110 hover:z-50"
                                                            style={{
                                                                transform: `translate(${idx * 2}px, ${idx * 0}px) rotate(${idx * 5}deg)`,
                                                                zIndex: idx
                                                            }}
                                                        />
                                                    ))}
                                                    {post.content.mediaUrls.length > 3 && (
                                                        <div
                                                            className="absolute top-0 left-0 w-10 h-10 flex items-center justify-center bg-black/60 text-white rounded-md z-20 text-[10px] font-bold backdrop-blur-[1px]"
                                                            style={{
                                                                transform: `translate(${4}px, ${0}px) rotate(${15}deg)`,
                                                            }}
                                                        >
                                                            +{post.content.mediaUrls.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1">
                                            {(post.status === 'scheduled' || post.status === 'failed' || post.status === 'draft') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-primary shrink-0 h-8 w-8"
                                                    onClick={() => onPostClick(post.id)}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                                                onClick={(e) => onPostDelete(post.id, e)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {post.status === 'failed' && post.errorMessage && (
                                    <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-900/20">
                                        <span className="font-semibold">Error:</span> {post.errorMessage}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => window.location.href = `/publish?date=${selectedDate.toISOString()}`}
            >
                Schedule Another Post
            </Button>
        </Card>
    );
}
