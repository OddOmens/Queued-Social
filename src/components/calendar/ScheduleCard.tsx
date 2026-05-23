import React, { useState, useRef } from 'react';
import { Post } from '@/types/data';
import { format } from 'date-fns';
import { 
    Instagram, 
    Linkedin, 
    MessageSquare, 
    MoreVertical, 
    Pencil, 
    RefreshCcw, 
    Trash2, 
    Eye, 
    MessageCircle, 
    Heart, 
    Share2, 
    Repeat2,
    AlertCircle,
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSignedUrl } from '@/services/storage';
import { useAuthStore } from '@/stores/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface ScheduleCardProps {
    post: Post;
    onEdit: (postId: string) => void;
    onDelete: (postId: string, e: React.MouseEvent) => void;
    onRetry: (postId: string) => void;
}

const PostMedia = ({ url }: { url: string }) => {
    const [imgSrc, setImgSrc] = useState(url);
    const [error, setError] = useState(false);
    const retriedRef = useRef(false);

    const handleError = async () => {
        if (retriedRef.current || error) {
            setError(true);
            return;
        }
        retriedRef.current = true;
        try {
            const signed = await getSignedUrl(url);
            if (signed) setImgSrc(signed);
            else setError(true);
        } catch {
            setError(true);
        }
    };

    if (error) return null;

    return (
        <div className="relative aspect-video w-full max-w-[200px] rounded-lg overflow-hidden border bg-muted">
            <img 
                src={imgSrc} 
                onError={handleError}
                className="w-full h-full object-cover" 
                alt="Post media" 
            />
        </div>
    );
};

export function ScheduleCard({ post, onEdit, onDelete, onRetry }: ScheduleCardProps) {
    const user = useAuthStore((state) => state.user);
    const isPublished = post.status === 'published';
    const isFailed = post.status === 'failed';
    const isScheduled = post.status === 'scheduled' || post.status === 'publishing';

    const getPlatformIcon = () => {
        switch (post.platform) {
            case 'instagram': return <Instagram className="h-4 w-4" />;
            case 'linkedin': return <Linkedin className="h-4 w-4" />;
            case 'threads': return <MessageSquare className="h-4 w-4" />;
            default: return null;
        }
    };

    const analytics = post.analytics || {
        likes: 0,
        replies: 0,
        views: 0,
        quotes: 0,
        reposts: 0
    };

    return (
        <div className="flex gap-4 md:gap-12 group">
            {/* Left side: Time Marker */}
            <div className="w-20 pt-4 flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-bold">
                    {post.scheduledTime ? format(new Date(post.scheduledTime), 'h:mm a') : format(new Date(post.createdAt), 'h:mm a')}
                </span>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    Custom
                </div>
            </div>

            {/* Right side: The Card */}
            <div className="flex-1 min-w-0">
                <Card className={cn(
                    "overflow-hidden border bg-card/50 transition-all hover:border-primary/20 hover:shadow-md",
                    isFailed && "border-destructive/20 bg-destructive/5"
                )}>
                    {/* Error Banner */}
                    {isFailed && (
                        <div className="bg-destructive/10 border-b border-destructive/10 p-4 flex gap-3 text-destructive">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <div className="text-sm">
                                <p className="font-semibold">
                                    {post.errorMessage?.includes('restricted') 
                                        ? "Threads is hitting an issue due to the connected Instagram account being restricted. Log into the Instagram account natively to resolve the issue."
                                        : post.errorMessage?.includes('disconnected')
                                        ? "This failed to post at the scheduled time due to the channel being disconnected. Now that it's been reconnected, please reschedule for a future time!"
                                        : post.errorMessage || "Failed to post."}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="p-6 space-y-4">
                        {/* Header: User Profile */}
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border shadow-sm">
                                <AvatarImage src={user?.user_metadata?.avatar_url} alt={post.accountName || 'User'} />
                                <AvatarFallback className="font-bold uppercase">
                                    {post.accountName?.substring(0, 2) || user?.user_metadata?.full_name?.substring(0, 2) || 'QS'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold leading-tight">{post.accountName || 'Your Account'}</span>
                                    <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider text-muted-foreground/80 border">
                                        {post.platform}
                                    </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || '@username'}</span>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="flex gap-6 items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-4">
                                    {post.content?.text || <span className="text-muted-foreground italic">No text content</span>}
                                </p>
                            </div>
                            {post.content?.mediaUrls?.length > 0 && (
                                <PostMedia url={post.content.mediaUrls[0]} />
                            )}
                        </div>

                        {/* Analytics Strip (for published posts) */}
                        {isPublished && (
                            <div className="pt-4 border-t flex flex-wrap gap-x-8 gap-y-2 mt-4 text-[10px] uppercase font-bold text-muted-foreground/60">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Heart className="h-3.5 w-3.5" />
                                        <span className="tracking-wider">Reactions</span>
                                    </div>
                                    <span className="font-bold text-lg text-foreground">{analytics.likes || 0}</span>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <MessageCircle className="h-3.5 w-3.5" />
                                        <span className="tracking-wider">Comments</span>
                                    </div>
                                    <span className="font-bold text-lg text-foreground">{analytics.replies || 0}</span>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Eye className="h-3.5 w-3.5" />
                                        <span className="tracking-wider">Views</span>
                                    </div>
                                    <span className="font-bold text-lg text-foreground">{analytics.views || 0}</span>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Repeat2 className="h-3.5 w-3.5" />
                                        <span className="tracking-wider">Quotes</span>
                                    </div>
                                    <span className="font-bold text-lg text-foreground">{analytics.quotes || 0}</span>
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Share2 className="h-3.5 w-3.5" />
                                        <span className="tracking-wider">Reposts</span>
                                    </div>
                                    <span className="font-bold text-lg text-foreground">{analytics.reposts || 0}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-4 bg-muted/20 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                            {isPublished && (
                                <div className="flex items-center gap-2">
                                    <span>Published via</span>
                                    <div className="flex items-center gap-1 text-foreground font-semibold not-italic">
                                        {getPlatformIcon()}
                                        <span className="capitalize">{post.platform}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                             {isFailed && (
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="gap-2 font-bold h-9" 
                                    onClick={() => onRetry(post.id)}
                                >
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                    Retry Now
                                </Button>
                            )}
                            {isPublished && post.platformPostId && (
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="gap-2 font-bold h-9" 
                                    onClick={() => {/* Open link to post */}}
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    View Post
                                </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" onClick={() => onEdit(post.id)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={(e) => onDelete(post.id, e)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
