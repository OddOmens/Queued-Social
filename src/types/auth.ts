// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

import { User as SupabaseUser } from '@supabase/supabase-js'

export interface AuthUser extends Omit<SupabaseUser, 'user_metadata'> {
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  initialized: boolean
}

export interface SignUpData {
  email: string
  password: string
  fullName?: string
}

export interface SignInData {
  email: string
  password: string
}

export interface ResetPasswordData {
  email: string
}

export interface UpdatePasswordData {
  password: string
}

export interface UpdateProfileData {
  fullName?: string
  timezone?: string
}

export interface AuthError {
  message: string
  status?: number
}

export interface AuthResponse<T = any> {
  data: T | null
  error: AuthError | null
}

// Auth store interface
export interface AuthStore extends AuthState {
  // Actions
  signUp: (data: SignUpData) => Promise<AuthResponse<AuthUser>>
  signIn: (data: SignInData) => Promise<AuthResponse<AuthUser>>
  signInWithGoogle: () => Promise<AuthResponse<null>>
  signOut: () => Promise<AuthResponse<null>>
  resetPassword: (data: ResetPasswordData) => Promise<AuthResponse<null>>
  updatePassword: (data: UpdatePasswordData) => Promise<AuthResponse<AuthUser>>
  updateProfile: (data: UpdateProfileData) => Promise<AuthResponse<AuthUser>>
  refreshSession: () => Promise<AuthResponse<AuthUser>>
  
  // Internal actions
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  initialize: () => Promise<void>
}

// Session management
export interface SessionData {
  access_token: string
  refresh_token: string
  expires_at: number
  user: AuthUser
}

// Route protection
export interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
}

export interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
  fallback?: React.ReactNode
}

// Middleware types
export interface AuthMiddlewareConfig {
  publicRoutes: string[]
  authRoutes: string[]
  protectedRoutes: string[]
  redirects: {
    signIn: string
    signOut: string
    afterSignIn: string
    afterSignOut: string
  }
}

export interface RequestWithAuth extends Request {
  user?: AuthUser
  session?: SessionData
}