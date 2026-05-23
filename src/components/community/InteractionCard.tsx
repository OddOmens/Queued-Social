import React, { useState } from 'react';
import { CommunityInteraction } from '@/types/data';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageSquare, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface InteractionCardProps {
    interaction: CommunityInteraction;
    onReply: (parentId: string, text: string) => Promise<void>;
    isRoot?: boolean;
    level?: number;
}

export default function InteractionCard({
    interaction,
    onReply,
    isRoot = false,
    level = 0
}: InteractionCardProps) {
    const [isReplaying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleReply = async () => {
        if (!replyText.trim()) return;
        setIsSubmitting(true);
        try {
            await onReply(interaction.id, replyText);
            setReplyText('');
            setIsReplying(false);
        } catch (error) {
            console.error('Failed to post reply:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={cn(
            "group flex flex-col gap-2 p-4 bg-card rounded-lg border",
            !isRoot && "border-none pt-2 pb-2 pl-6 ml-2 border-l-2 border-muted"
        )}>
            <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={`https://unavatar.io/${interaction.authorUsername}`} />
                    <AvatarFallback>{interaction.authorUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{interaction.authorUsername}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(interaction.timestamp), { addSuffix: true })}
                        </span>
                    </div>
                    
                    <p className="mt-1 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {interaction.text}
                    </p>

                    {interaction.mediaUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border max-w-sm">
                            {interaction.mediaType === 'VIDEO' ? (
                                <video src={interaction.mediaUrl} controls className="w-full aspect-square object-cover" />
                            ) : (
                                <img src={interaction.mediaUrl} alt="Post content" className="w-full h-auto object-cover" />
                            )}
                        </div>
                    )}

                    <div className="mt-3 flex items-center gap-4">
                        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                            <Heart className="h-4 w-4" />
                            {interaction.likeCount !== undefined && <span className="text-xs font-medium">{interaction.likeCount}</span>}
                        </button>
                        <button 
                            onClick={() => setIsReplying(!isReplaying)}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                        >
                            <MessageSquare className="h-4 w-4" />
                            {interaction.replyCount !== undefined && <span className="text-xs font-medium">{interaction.replyCount}</span>}
                        </button>
                    </div>

                    {isReplaying && (
                        <div className="mt-4 flex flex-col gap-3 p-3 bg-muted/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
                            <Textarea
                                placeholder="Write your reply..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="min-h-[80px] text-sm resize-none bg-background focus-visible:ring-1"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => setIsReplying(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={handleReply}
                                    disabled={isSubmitting || !replyText.trim()}
                                    className="gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                    Post Reply
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {interaction.replies?.map(reply => (
                <InteractionCard
                    key={reply.id}
                    interaction={reply}
                    onReply={onReply}
                    level={level + 1}
                />
            ))}
        </div>
    );
}
