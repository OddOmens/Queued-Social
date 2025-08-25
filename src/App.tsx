import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthProvider'
import { ErrorHandlingProvider } from './components/ErrorHandlingProvider'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Layout } from './components/layout/Layout'

// Pages
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { PostsPage } from './pages/PostsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'

function App() {
  return (
    <ErrorHandlingProvider>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          
          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="posts" element={<PostsPage />} />
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