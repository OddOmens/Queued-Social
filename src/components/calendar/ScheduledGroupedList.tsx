import React from 'react';
import { Post } from '@/types/data';
import { format, isSameDay, isTomorrow, isToday, parseISO } from 'date-fns';
import { ScheduleCard } from './ScheduleCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface GroupedPosts {
    label: string;
    posts: Post[];
    isFailedGroup?: boolean;
}

interface ScheduledGroupedListProps {
    posts: Post[];
    onEdit: (postId: string) => void;
    onDelete: (postId: string, e: React.MouseEvent) => void;
    onRetry: (postId: string) => void;
}

export function ScheduledGroupedList({ posts, onEdit, onDelete, onRetry }: ScheduledGroupedListProps) {
    // 1. Separate Failed posts
    const failedPosts = posts.filter(p => p.status === 'failed');
    
    // 2. Separate Scheduled and Published posts
    const otherPosts = posts.filter(p => p.status !== 'failed');
    
    // 3. Group other posts by date
    const groups: GroupedPosts[] = [];
    
    if (failedPosts.length > 0) {
        groups.push({
            label: 'Not Published',
            posts: failedPosts,
            isFailedGroup: true
        });
    }
    
    const postsByDate: Record<string, Post[]> = {};
    
    otherPosts.forEach(post => {
        const date = post.scheduledTime || post.publishedAt || post.createdAt;
        if (!date) return;
        
        const dateStr = format(new Date(date), 'yyyy-MM-dd');
        if (!postsByDate[dateStr]) {
            postsByDate[dateStr] = [];
        }
        postsByDate[dateStr].push(post);
    });
    
    // Sort dates
    const now = new Date();
    
    // Sort dates by distance to now
    const dates = Object.keys(postsByDate).sort((a, b) => {
        // Ensure local time parsing for yyyy-MM-dd strings
        const dateA = parseISO(a);
        const dateB = parseISO(b);
        
        // Always prioritize Today
        if (isToday(dateA) && !isToday(dateB)) return -1;
        if (isToday(dateB) && !isToday(dateA)) return 1;

        const diffA = Math.abs(dateA.getTime() - now.getTime());
        const diffB = Math.abs(dateB.getTime() - now.getTime());
        return diffA - diffB;
    });
    
    dates.forEach(dateStr => {
        const date = parseISO(dateStr);
        let label = '';
        
        if (isToday(date)) {
            label = `Today, ${format(date, 'MMMM d')}`;
        } else if (isTomorrow(date)) {
            label = `Tomorrow, ${format(date, 'MMMM d')}`;
        } else {
            label = format(date, 'EEEE, MMMM d, yyyy');
        }
        
        groups.push({
            label,
            posts: postsByDate[dateStr].sort((a, b) => {
                const timeA = new Date(a.scheduledTime || a.publishedAt || a.createdAt).getTime();
                const timeB = new Date(b.scheduledTime || b.publishedAt || b.createdAt).getTime();
                const diffA = Math.abs(timeA - now.getTime());
                const diffB = Math.abs(timeB - now.getTime());
                return diffA - diffB;
            })
        });
    });
    
    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/20">
                <p className="text-muted-foreground">No posts found for this filter.</p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/publish'}>
                    Schedule a Post
                </Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-12 pb-20">
            {groups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-6">
                    <h3 className={group.isFailedGroup ? "text-xl font-bold" : "text-lg font-semibold text-muted-foreground"}>
                        {group.label}
                    </h3>
                    
                    <div className="space-y-6">
                        {group.posts.map(post => (
                            <ScheduleCard 
                                key={post.id} 
                                post={post} 
                                onEdit={onEdit} 
                                onDelete={onDelete} 
                                onRetry={onRetry}
                            />
                        ))}
                    </div>
                    
                    {!group.isFailedGroup && !group.label.includes('Yesterday') && (
                         <div className="flex gap-12 items-center">
                            <div className="w-20 text-right text-sm text-muted-foreground font-medium pt-3">
                                {/* Time marker for the empty slot? Maybe just skip or show next slot if available */}
                            </div>
                            <div className="flex-1">
                                <Button 
                                    variant="ghost" 
                                    className="w-full border-2 border-dashed border-muted-foreground/20 h-14 bg-muted/5 hover:bg-muted/10 text-muted-foreground justify-start px-6 gap-2"
                                    onClick={() => {
                                        const date = group.posts[0] ? new Date(group.posts[0].scheduledTime || group.posts[0].createdAt) : new Date();
                                        window.location.href = `/publish?date=${date.toISOString()}`;
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                    New
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
