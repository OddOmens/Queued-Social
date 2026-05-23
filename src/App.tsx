import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { AuthProvider } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import PublishPage from '@/pages/PublishPage';
import DraftsPage from '@/pages/DraftsPage';
import LibraryPage from '@/pages/LibraryPage';
import SchedulePage from '@/pages/SchedulePage';
import SettingsPage from '@/pages/SettingsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import EngagementPage from '@/pages/EngagementPage';
import CommunityPage from '@/pages/CommunityPage';
import GoalsPage from '@/pages/GoalsPage';
import ThreadsCallbackPage from '@/pages/ThreadsCallbackPage';
import LinkedInCallbackPage from '@/pages/LinkedInCallbackPage';
import InstagramCallbackPage from '@/pages/InstagramCallbackPage';
import InstagramDirectCallbackPage from '@/pages/InstagramDirectCallbackPage';
import { useAuthStore } from '@/stores/auth';
import { appScheduler } from '@/services/scheduler';

function App() {
    const { initialize, user } = useAuthStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    // Start scheduler when user is logged in
    useEffect(() => {
        if (user) {
            appScheduler.init(user.id);
        } else {
            appScheduler.stop();
        }
        return () => appScheduler.stop();
    }, [user]);

    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={!user ? <LoginPage /> : <Navigate to="/publish" replace />} />
                    <Route path="/login" element={<Navigate to="/" replace />} />

                    <Route path="/auth/threads/callback" element={<ProtectedRoute><ThreadsCallbackPage /></ProtectedRoute>} />
                    <Route path="/auth/linkedin/callback" element={<ProtectedRoute><LinkedInCallbackPage /></ProtectedRoute>} />
                    <Route path="/auth/instagram/callback" element={<ProtectedRoute><InstagramCallbackPage /></ProtectedRoute>} />
                    <Route path="/auth/instagram-direct/callback" element={<ProtectedRoute><InstagramDirectCallbackPage /></ProtectedRoute>} />

                    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route path="publish" element={<PublishPage />} />
                        <Route path="schedule" element={<SchedulePage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="engagement" element={<EngagementPage />} />
                        <Route path="drafts" element={<DraftsPage />} />
                        <Route path="goals" element={<GoalsPage />} />
                        <Route path="community" element={<CommunityPage />} />
                        <Route path="library" element={<LibraryPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
