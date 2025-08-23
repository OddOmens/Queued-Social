'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * Authentication provider component that initializes auth state
 * Should be placed at the root of the application
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const initialize = useAuthStore((state) => state.initialize)
  const initialized = useAuthStore((state) => state.initialized)

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialize, initialized])

  return <>{children}</>
}