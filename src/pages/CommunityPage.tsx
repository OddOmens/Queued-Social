import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { getConnectedPlatforms } from '@/services/credentials';
import { getThreadsInteractions, postReply } from '@/services/community';
import { ThreadConversation, PlatformCredentials } from '@/types/data';
import { 
    Loader2, 
    MessageSquare, 
    ChevronDown, 
    Filter, 
    Search,
    RefreshCw,
    LayoutList,
    LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InteractionCard from '@/components/community/InteractionCard';
import { cn } from '@/lib/utils';

export default function CommunityPage() {
    const { user } = useAuthStore();
    const [threadsCount, setThreadsCount] = useState<number>(0);
    const [conversations, setConversations] = useState<ThreadConversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState<PlatformCredentials | null>(null);
    const [accounts, setAccounts] = useState<PlatformCredentials[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'post'>('list');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadAccounts = async () => {
            if (!user) return;
            try {
                const connected = await getConnectedPlatforms(user.id);
                const threadsAccounts = connected.filter(a => a.platform === 'threads');
                setAccounts(threadsAccounts);
                if (threadsAccounts.length > 0) {
                    setSelectedAccount(threadsAccounts[0]);
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Failed to load accounts:', error);
                setIsLoading(false);
            }
        };
        loadAccounts();
    }, [user]);

    useEffect(() => {
        if (selectedAccount) {
            loadInteractions();
        }
    }, [selectedAccount]);

    const loadInteractions = async () => {
        setIsLoading(true);
        try {
            const data = await getThreadsInteractions('threads', selectedAccount?.platformAccountId);
            setConversations(data);
            // Count root posts from me vs mentions
            setThreadsCount(data.length); 
        } catch (error) {
            console.error('Failed to load interactions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReply = async (parentId: string, text: string) => {
        if (!selectedAccount) return;
        try {
            await postReply({
                platform: 'threads',
                platformAccountId: selectedAccount.platformAccountId,
                parentId,
                text
            });
            // Reload to show the new reply
            loadInteractions();
        } catch (error) {
            console.error('Failed to send reply:', error);
            throw error;
        }
    };

    const q = searchQuery.toLowerCase();
    const filteredConversations = conversations.filter(c =>
        c.rootPost.text?.toLowerCase().includes(q) ||
        c.rootPost.authorUsername?.toLowerCase().includes(q) ||
        c.interactions.some(i => i.text?.toLowerCase().includes(q))
    );

    if (!selectedAccount && !isLoading && accounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-card border rounded-xl shadow-sm">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-6">
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-2">No Threads Account Connected</h2>
                <p className="text-muted-foreground mb-8 max-w-sm">Connect your Threads account in settings to start managing your community and replies.</p>
                <Button asChild>
                    <a href="/settings">Connect Threads</a>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">Community</h1>
                    <div className="flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {threadsCount}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadInteractions} disabled={isLoading} className="h-9">
                        <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-2">
                                {selectedAccount?.accountName || selectedAccount?.accountUsername || 'Select Account'}
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            {accounts.map(acc => (
                                <DropdownMenuItem 
                                    key={acc.id} 
                                    onClick={() => setSelectedAccount(acc)}
                                    className="gap-2"
                                >
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    {acc.accountName || acc.accountUsername}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search conversation..." 
                        className="pl-9 bg-muted/30 border-none h-10 w-full md:max-w-md"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto no-scrollbar">
                    <div className="flex items-center p-1 bg-muted/30 rounded-lg shrink-0">
                        <Button 
                            variant={viewMode === 'post' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 px-3 text-xs"
                            onClick={() => setViewMode('post')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5 mr-2" />
                            By post
                        </Button>
                        <Button 
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 px-3 text-xs"
                            onClick={() => setViewMode('list')}
                        >
                            <LayoutList className="h-3.5 w-3.5 mr-2" />
                            List
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-border hidden md:block" />

                    <Button variant="ghost" size="sm" className="h-9 px-3 shrink-0">
                        <Filter className="h-4 w-4 mr-2" />
                        All
                        <ChevronDown className="h-3.5 w-3.5 ml-2 text-muted-foreground" />
                    </Button>
                </div>
            </div>

            {isLoading && conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>Fetching your Threads community...</p>
                </div>
            ) : filteredConversations.length > 0 ? (
                <div className="grid gap-6">
                    {filteredConversations.map((conv) => (
                        <div key={conv.rootPost.id} className="space-y-3">
                            <InteractionCard
                                interaction={conv.rootPost}
                                onReply={handleReply}
                                isRoot={true}
                            />
                            {conv.interactions.length > 0 && (
                                <div className="ml-10 space-y-3 border-l-2 border-muted pl-6 mt-2 pb-2">
                                    {conv.interactions.map(interaction => (
                                        <InteractionCard 
                                            key={interaction.id}
                                            interaction={interaction}
                                            onReply={handleReply}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-card rounded-xl border border-dashed">
                    <p>{searchQuery ? 'No conversations match your search' : 'No interactions found on this account yet'}</p>
                </div>
            )}
        </div>
    );
}
