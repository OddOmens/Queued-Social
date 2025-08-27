import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthProvider'
import { ErrorHandlingProvider } from './components/ErrorHandlingProvider'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Layout } from './components/layout/Layout'
import { appScheduler } from './services/appScheduler'
import { initializePlatformPlugins } from './services/platforms'

// Pages
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { UnifiedCalendarPage } from './pages/UnifiedCalendarPage'
import { PublishPage } from './pages/PublishPage'
import { DraftsPage } from './pages/DraftsPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ThreadsCallbackPage } from './pages/ThreadsCallbackPage'

function App() {
  // Initialize platform plugins and app scheduler when the app starts
  useEffect(() => {
    console.log('Initializing platform plugins...')
    initializePlatformPlugins()
    
    console.log('Starting app scheduler...')
    appScheduler.start()
    
    // Cleanup on unmount
    return () => {
      appScheduler.stop()
    }
  }, [])

  return (
    <ErrorHandlingProvider>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          
          {/* OAuth callback routes */}
          <Route path="/auth/threads/callback" element={<ProtectedRoute><ThreadsCallbackPage /></ProtectedRoute>} />
          
          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="calendar" element={<PublishPage />} />
            <Route path="publish" element={<UnifiedCalendarPage />} />
            <Route path="drafts" element={<DraftsPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/profile" element={<ProfilePage />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorHandlingProvider>
  )
}

export default App