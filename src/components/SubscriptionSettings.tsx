import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import { Loader2, Check, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

export default function SubscriptionSettings() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [subscription, setSubscription] = useState<any>(null);

    useEffect(() => {
        if (user) {
            checkSubscription();
        }
    }, [user]);

    const checkSubscription = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', user!.id)
                .single();

            if (data) {
                setSubscription(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        setProcessing(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: {
                    priceId: PLANS.PRO.priceId,
                    successUrl: `${window.location.origin}/settings?session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${window.location.origin}/settings`,
                }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Upgrade failed:', err);
            alert('Failed to start upgrade process.');
        } finally {
            setProcessing(false);
        }
    };

    const handleManage = async () => {
        setProcessing(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session', {
                body: {
                    returnUrl: `${window.location.origin}/settings`,
                }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error('Portal failed:', err);
            alert('Failed to open billing portal.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <Loader2 className="h-6 w-6 animate-spin" />;

    // Determine current plan based on subscription status/existence
    // Assuming if no subscription record or status != active/trialing, it's Free.
    // NOTE: precise logic depends on your 'subscriptions' table data.
    const isPro = subscription && subscription.plan_type === 'pro' && subscription.status === 'active';
    const isAdmin = subscription && subscription.plan_type === 'admin';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>Manage your plan and billing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                    <div>
                        <div className="font-semibold text-lg flex items-center gap-2">
                            {isAdmin ? 'Admin' : isPro ? 'Pro Plan' : 'Free Plan'}
                            {(isPro || isAdmin) && <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">Active</span>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {isAdmin
                                ? 'Full admin access with no limits.'
                                : isPro
                                    ? `${PLANS.PRO.postLimit.toLocaleString()} scheduled posts · ${PLANS.PRO.mediaLimit} media files`
                                    : `${PLANS.FREE.postLimit} scheduled posts · ${PLANS.FREE.mediaLimit} media files`
                            }
                        </p>
                    </div>
                </div>

                {!isPro && !isAdmin && (
                    <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="border rounded-md p-4">
                                <h4 className="font-semibold mb-2">Free Includes:</h4>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    {PLANS.FREE.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4" /> {f}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="border border-primary/50 bg-primary/5 rounded-md p-4">
                                <h4 className="font-semibold mb-2">Pro Includes:</h4>
                                <ul className="space-y-2 text-sm">
                                    {PLANS.PRO.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {f}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <Button className="w-full" onClick={handleUpgrade} disabled={processing}>
                            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Upgrade to Pro — {PLANS.PRO.price}
                        </Button>
                    </div>
                )}

                {isPro && (
                    <div>
                        <Button variant="outline" onClick={handleManage} disabled={processing}>
                            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                            Manage Subscription
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">Manage billing, payment methods, and invoices via Stripe.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
