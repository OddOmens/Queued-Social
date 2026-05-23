import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getConnectedPlatforms, removeCredentials, updateAccountName } from '@/services/credentials';
import { PlatformCredentials } from '@/types/data';
import { useAuthStore } from '@/stores/auth';
import { Loader2, Plus, Pencil, Check, X } from 'lucide-react';
import { debugThreadsEnvironment } from '@/lib/threads';
import SubscriptionSettings from '@/components/SubscriptionSettings';

export default function SettingsPage() {
    const [platforms, setPlatforms] = useState<PlatformCredentials[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const { user, signOut } = useAuthStore();

    const fetchPlatforms = async () => {
        if (!user) return;
        try {
            const data = await getConnectedPlatforms(user.id);
            setPlatforms(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlatforms();
    }, [user]);

    const handleDisconnect = async (id: string) => {
        if (!confirm('Are you sure you want to disconnect this account? Scheduled posts for this account will fail.')) return;
        try {
            await removeCredentials(id);
            await fetchPlatforms();
        } catch (error) {
            alert('Failed to disconnect account');
        }
    };

    const startEditing = (account: PlatformCredentials) => {
        setEditingId(account.id);
        // Fallback or prefer display name
        setEditName(account.accountName || account.accountUsername || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveName = async (id: string) => {
        if (!editName.trim()) return;
        try {
            await updateAccountName(id, editName);
            await fetchPlatforms();
            setEditingId(null);
        } catch (error) {
            console.error('Failed to update name', error);
            alert('Failed to update account name');
        }
    };

    const connectThreads = () => {
        const env = debugThreadsEnvironment();
        const clientId = env.VITE_THREADS_CLIENT_ID;
        // MUST match exactly what is in Meta App Dashboard
        // Uses VITE_APP_URL if set, otherwise falls back to the current origin
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
        const redirectUri = `${appUrl}/auth/threads/callback`;
        // Note: If you don't see the "Manage replies" permission in the consent dialog, you MUST remove the app from your Threads settings and reconnect.
        const scope = 'threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies,threads_manage_mentions,threads_manage_insights';

        window.location.href = `https://threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    };

    const connectLinkedIn = () => {
        const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID;
        if (!clientId) {
            alert('Missing VITE_LINKEDIN_CLIENT_ID');
            return;
        }

        // redirect_uri must match EXACTLY between here and the callback page
        // Uses VITE_APP_URL if set, otherwise falls back to the current origin
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
        const redirectUri = encodeURIComponent(`${appUrl}/auth/linkedin/callback`);

        // LinkedIn scopes: r_liteprofile w_member_social (openid might be needed for newer apps, but trying standard first)
        // If your app is newer (OpenID): openid profile email w_member_social
        // Let's assume standard V2 scopes for posting
        const scope = encodeURIComponent('openid profile email w_member_social');
        const state = 'linkedin_connect_' + Math.random().toString(36).substring(7);

        window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
    };

    const connectInstagram = () => {
        const clientId = import.meta.env.VITE_INSTAGRAM_CLIENT_ID;
        if (!clientId) {
            alert('Missing VITE_INSTAGRAM_CLIENT_ID');
            return;
        }

        // New "Instagram Business Login" Flow
        // Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
        const redirectUri = `${appUrl}/auth/instagram-direct/callback`;

        // Correct scopes for Business Login to enable publishing
        const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments';
        const state = 'instagram_direct_' + Math.random().toString(36).substring(7);

        // This flow uses instagram.com but grants Business permissions if the user selects a Business account
        window.location.href = `https://www.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${state}`;
    };

    return (
        <div className="flex flex-col gap-8 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">Manage your account and integrations.</p>
            </div>

            {/* Profile Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Manage your personal information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input value={user?.email || ''} readOnly disabled />
                        <p className="text-xs text-muted-foreground">Email cannot be changed directly.</p>
                    </div>
                    <div className="pt-4">
                        <Button variant="destructive" onClick={() => signOut()}>Sign Out</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Subscription Section */}
            <SubscriptionSettings />

            {/* Integrations Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Connected Accounts</CardTitle>
                    <CardDescription>Manage your social media connections.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        <div className="space-y-6">
                            {/* Threads Controls */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <div className="h-5 w-5 bg-black rounded flex items-center justify-center text-white text-xs">@</div> Threads
                                    </h3>
                                    <Button size="sm" variant="outline" onClick={connectThreads} disabled={!import.meta.env.VITE_THREADS_CLIENT_ID}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Account
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {platforms.filter(p => p.platform === 'threads').map(account => (
                                        <div key={account.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className={`h-2 w-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-red-500'}`} />

                                                {editingId === account.id ? (
                                                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                                                        <Input
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="h-8"
                                                            autoFocus
                                                        />
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900" onClick={() => handleSaveName(account.id)}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-900" onClick={cancelEditing}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium">{account.accountName || account.accountUsername || 'Threads User'}</p>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground opacity-50 hover:opacity-100" onClick={() => startEditing(account)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">ID: {account.platformAccountId}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {editingId !== account.id && (
                                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDisconnect(account.id)}>
                                                    Disconnect
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {platforms.filter(p => p.platform === 'threads').length === 0 && (
                                        <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md text-center">
                                            No Threads accounts connected
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* LinkedIn Controls */}
                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <div className="h-5 w-5 bg-blue-600 rounded flex items-center justify-center text-white text-xs">in</div> LinkedIn
                                    </h3>
                                    <Button size="sm" variant="outline" onClick={connectLinkedIn}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Account
                                    </Button>
                                </div>
                                <div className="grid gap-3">
                                    {platforms.filter(p => p.platform === 'linkedin').map(account => (
                                        <div key={account.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className={`h-2 w-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-red-500'}`} />

                                                {editingId === account.id ? (
                                                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                                                        <Input
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="h-8"
                                                            autoFocus
                                                        />
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900" onClick={() => handleSaveName(account.id)}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-900" onClick={cancelEditing}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium">{account.accountName || account.accountUsername || 'LinkedIn User'}</p>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground opacity-50 hover:opacity-100" onClick={() => startEditing(account)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">ID: {account.platformAccountId}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {editingId !== account.id && (
                                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDisconnect(account.id)}>
                                                    Disconnect
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {platforms.filter(p => p.platform === 'linkedin').length === 0 && (
                                        <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md text-center">
                                            No LinkedIn accounts connected
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* Instagram Controls */}
                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <div className="h-5 w-5 bg-pink-500 rounded flex items-center justify-center text-white text-xs">I</div> Instagram
                                    </h3>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={connectInstagram} disabled={!import.meta.env.VITE_INSTAGRAM_CLIENT_ID}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Account (Business)
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    {platforms.filter(p => p.platform === 'instagram').map(account => (
                                        <div key={account.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className={`h-2 w-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-red-500'}`} />

                                                {editingId === account.id ? (
                                                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                                                        <Input
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="h-8"
                                                            autoFocus
                                                        />
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900" onClick={() => handleSaveName(account.id)}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-900" onClick={cancelEditing}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium">{account.accountName || account.accountUsername || 'Instagram User'}</p>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground opacity-50 hover:opacity-100" onClick={() => startEditing(account)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">ID: {account.platformAccountId}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {editingId !== account.id && (
                                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDisconnect(account.id)}>
                                                    Disconnect
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {platforms.filter(p => p.platform === 'instagram').length === 0 && (
                                        <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md text-center">
                                            No Instagram accounts connected
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
