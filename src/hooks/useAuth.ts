'use client'

import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@/types/auth'

/**
 * Custom hook for accessing authentication state and actions
 */
export function useAuth() {
  const store = useAuthStore()

  return {
    // State
    user: store.user,
    loading: store.loading,
    initialized: store.initialized,
    isAuthenticated: !!store.user,
    
    // Actions
    signUp: store.signUp,
    signIn: store.signIn,
    signOut: store.signOut,
    resetPassword: store.resetPassword,
    updatePassword: store.updatePassword,
    updateProfile: store.updateProfile,
    refreshSession: store.refreshSession,
  }
}

/**
 * Hook that returns the current user or null
 */
export function useUser(): AuthUser | null {
  return useAuthStore((state) => state.user)
}

/**
 * Hook that returns whether the user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const user = useAuthStore((state) => state.user)
  return !!user
}

/**
 * Hook that returns the authentication loading state
 */
export function useAuthLoading(): boolean {
  return useAuthStore((state) => state.loading)
}

/**
 * Hook that returns whether auth has been initialized
 */
export function useAuthInitialized(): boolean {
  return useAuthStore((state) => state.initialized)
}