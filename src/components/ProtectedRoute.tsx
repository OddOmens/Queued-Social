import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, initialized } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (initialized && !user) {
            navigate('/');
        }
    }, [user, initialized, navigate]);

    if (!initialized) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!user) {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
