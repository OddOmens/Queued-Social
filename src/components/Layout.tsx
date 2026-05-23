import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import {
    PenSquare,
    FileText,
    Settings,
    LogOut,
    CalendarClock,
    Image,
    Menu,
    X,
    MessageSquare,
    BarChart2,
    TrendingUp,
    Target
} from 'lucide-react';

const SidebarItem = ({
    icon: Icon,
    label,
    path,
    isActive
}: {
    icon: any,
    label: string,
    path: string,
    isActive: boolean
}) => {
    return (
        <Link to={path} className="w-full">
            <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                    "w-full justify-start gap-3 mb-1 font-normal",
                    isActive && "font-medium"
                )}
            >
                <Icon className="h-4 w-4" />
                {label}
            </Button>
        </Link>
    );
};

const SectionLabel = ({ label }: { label: string }) => (
    <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
    </p>
);

const generalItems = [
    { icon: PenSquare, label: 'Publish', path: '/publish' },
    { icon: CalendarClock, label: 'Schedule', path: '/schedule' },
    { icon: FileText, label: 'Drafts', path: '/drafts' },
    { icon: Image, label: 'Library', path: '/library' },
];

const threadsItems = [
    { icon: BarChart2, label: 'Analytics', path: '/analytics' },
    { icon: TrendingUp, label: 'Engagement', path: '/engagement' },
    { icon: Target, label: 'Goals', path: '/goals' },
    { icon: MessageSquare, label: 'Community', path: '/community' },
];

export default function Layout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    const currentPath = location.pathname;
    const { signOut } = useAuthStore();

    const allItems = [...generalItems, ...threadsItems, { icon: Settings, label: 'Settings', path: '/settings' }];

    return (
        <div className="flex h-screen bg-background overflow-hidden relative">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 border-r bg-card flex-col h-full">
                <div className="p-6">
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <img src="/queued-social-logo.svg" alt="Queued Social" className="h-6 w-6" />
                        Queued Social
                    </h1>
                </div>

                <nav className="flex-1 px-4 py-2 overflow-y-auto">
                    {generalItems.map((item) => (
                        <SidebarItem
                            key={item.path}
                            icon={item.icon}
                            label={item.label}
                            path={item.path}
                            isActive={currentPath.startsWith(item.path)}
                        />
                    ))}

                    <SectionLabel label="Threads" />

                    {threadsItems.map((item) => (
                        <SidebarItem
                            key={item.path}
                            icon={item.icon}
                            label={item.label}
                            path={item.path}
                            isActive={currentPath.startsWith(item.path)}
                        />
                    ))}
                </nav>

                <div className="p-4 border-t space-y-1">
                    <SidebarItem
                        icon={Settings}
                        label="Settings"
                        path="/settings"
                        isActive={currentPath.startsWith('/settings')}
                    />
                    <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={() => signOut()}>
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm md:hidden animate-in fade-in duration-200">
                    <div className="flex flex-col h-full">
                        <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
                            <span className="font-bold text-lg flex items-center gap-2">
                                <img src="/queued-social-logo.svg" alt="Queued Social" className="h-5 w-5" />
                                Queued Social
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <nav className="flex-1 p-4 overflow-y-auto">
                            {generalItems.map((item) => (
                                <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button
                                        variant={currentPath.startsWith(item.path) ? "secondary" : "ghost"}
                                        className="w-full justify-start gap-3 h-12 text-base font-normal"
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {item.label}
                                    </Button>
                                </Link>
                            ))}

                            <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Threads</p>

                            {threadsItems.map((item) => (
                                <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button
                                        variant={currentPath.startsWith(item.path) ? "secondary" : "ghost"}
                                        className="w-full justify-start gap-3 h-12 text-base font-normal"
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {item.label}
                                    </Button>
                                </Link>
                            ))}

                            <div className="border-t my-4 pt-4 space-y-1">
                                <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button
                                        variant={currentPath.startsWith('/settings') ? "secondary" : "ghost"}
                                        className="w-full justify-start gap-3 h-12 text-base font-normal"
                                    >
                                        <Settings className="h-5 w-5" />
                                        Settings
                                    </Button>
                                </Link>
                                <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground h-12 text-base" onClick={() => signOut()}>
                                    <LogOut className="h-5 w-5" />
                                    Sign Out
                                </Button>
                            </div>
                        </nav>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full min-w-0 transition-all duration-300 ease-in-out">
                {/* Mobile Header */}
                <header className="md:hidden h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
                    <div className="font-bold text-lg flex items-center gap-2">
                        <img src="/queued-social-logo.svg" alt="Queued Social" className="h-5 w-5" />
                        Queued Social
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                        <Menu className="h-5 w-5" />
                    </Button>
                </header>

                <main className="flex-1 overflow-y-auto bg-muted/20">
                    <div className="container max-w-6xl mx-auto py-6 px-4 md:py-8 md:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
