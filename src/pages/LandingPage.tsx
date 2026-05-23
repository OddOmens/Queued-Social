import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Layers, Calendar, BarChart3, AlertTriangle } from 'lucide-react';

export default function LandingPage() {
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleGoogleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
        if (error) {
            console.error(error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] w-full bg-zinc-950 flex flex-col items-center justify-center font-sans overflow-hidden select-none px-0 md:px-6 relative">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes subtle-drift {
                    0% { transform: translateY(0) scale(1.02); }
                    50% { transform: translateY(-10px) scale(1); }
                    100% { transform: translateY(0) scale(1.02); }
                }
                .animate-subtle-drift {
                    animation: subtle-drift 20s ease-in-out infinite;
                }
            `}} />

            {/* Optional background grid for the entire outer screen */}
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-10 pointer-events-none">
                <div className="w-full h-full bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
            </div>

            {/* Content Container: Max Width 1200px */}
            <div className="w-full max-w-[1200px] h-[100dvh] md:h-[800px] md:max-h-[95vh] md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row bg-zinc-900 relative z-10 border-0 md:border md:border-zinc-800">
                
                {/* Left Side: Dark Info */}
                <div className="relative flex-1 bg-zinc-950 text-zinc-50 p-8 md:p-12 lg:p-16 flex flex-col justify-between overflow-hidden order-2 md:order-1 hidden md:flex border-r border-zinc-800">
                    {/* Lean, modern animation: drifting grid pattern inside the dark panel */}
                    <div className="absolute inset-0 z-0 opacity-[0.04] animate-subtle-drift pointer-events-none">
                        <div className="w-full h-[150%] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                    </div>

                    <div className={`relative z-10 flex items-center gap-3 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="h-10 w-10 border border-zinc-800 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg">
                            <Layers className="h-5 w-5 text-zinc-100" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">Queued Social</span>
                    </div>

                    <div className={`relative z-10 max-w-md my-auto pt-6 pb-6 transition-all duration-1000 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] mb-6 text-white">
                            Schedule smarter. Post with purpose.
                        </h1>
                        <p className="text-lg text-zinc-400 mb-10 leading-relaxed">
                            Draft, schedule, and publish everything centrally. We fully support <strong className="text-zinc-100 font-medium">LinkedIn</strong>, <strong className="text-zinc-100 font-medium">Instagram</strong>, and offer <strong className="text-zinc-100 font-medium">enhanced Threads capabilities</strong> built for deep community growth.
                        </p>

                        <div className="space-y-6">
                            {[
                                { icon: Calendar, title: "Visual Scheduling", desc: "Plan your pipeline with precision." },
                                { icon: BarChart3, title: "Real-time Analytics", desc: "Track performance seamlessly." },
                                { icon: Layers, title: "Enhanced Threads Features", desc: "Deep integrations for the modern creator." }
                            ].map((feature, i) => (
                                <div key={i} className={`flex items-start gap-4 transition-all duration-700 ${mounted ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`} style={{ transitionDelay: `${500 + i * 150}ms` }}>
                                    <div className="h-10 w-10 mt-1 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center shrink-0">
                                        <feature.icon className="h-4 w-4 text-zinc-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-200">{feature.title}</h3>
                                        <p className="text-sm text-muted-foreground mt-1 leading-snug">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`relative z-10 text-xs text-muted-foreground font-medium transition-opacity duration-1000 delay-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                        &copy; {new Date().getFullYear()} Odd Omens. All rights reserved.
                    </div>
                </div>

                {/* Right Side: Sign In */}
                <div className="w-full md:w-[440px] lg:w-[480px] bg-card text-card-foreground p-8 md:p-12 lg:p-16 flex flex-col justify-center relative z-20 shrink-0 order-1 md:order-2 h-[100dvh] md:h-full">
                    <div className={`w-full max-w-[360px] mx-auto transition-all duration-1000 delay-500 ${mounted ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-0'}`}>
                        
                        <div className="md:hidden flex items-center gap-3 mb-10">
                            <div className="h-8 w-8 bg-zinc-950 rounded-md flex items-center justify-center">
                                 <Layers className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-foreground">Queued Social</span>
                        </div>

                        <div className="mb-8 hidden md:block">
                            <div className="h-12 w-12 bg-muted border border-border rounded-xl flex items-center justify-center mb-6">
                                <Layers className="h-6 w-6 text-foreground" />
                            </div>
                        </div>

                        <Card className="border-0 shadow-none bg-transparent">
                            <CardHeader className="px-0 pt-0 pb-6">
                                <CardTitle className="text-3xl font-bold tracking-tight text-foreground mb-1">
                                    Welcome Back
                                </CardTitle>
                                <CardDescription className="text-muted-foreground text-sm">
                                    Sign in to your account securely
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-0 pb-0 space-y-6">
                                <Button 
                                    size="lg" 
                                    variant="outline"
                                    className="w-full h-12 text-sm font-medium transition-colors flex items-center justify-center gap-3 border-border hover:bg-muted text-foreground shadow-sm bg-transparent"
                                    onClick={handleGoogleLogin} 
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-zinc-400" /> : (
                                        <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                        </svg>
                                    )}
                                    {loading ? "Signing in..." : "Continue with Google"}
                                </Button>

                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-border"></div>
                                    <span className="flex-shrink-0 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fast & Secure</span>
                                    <div className="flex-grow border-t border-border"></div>
                                </div>
                                
                                <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-5">
                                    <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-500 mb-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Work in Progress
                                    </h4>
                                    <p className="text-xs text-amber-400/80 leading-relaxed text-left">
                                        This product is currently in active development and might experience unexpected behavior. Thanks for testing!
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
