'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import type { ProtectedRouteProps } from '@/types/auth'

/**
 * Protected route wrapper that requires authentication
 */
export function ProtectedRoute({ 
  children, 
  fallback = <div>Loading...</div>,
  redirectTo = '/auth/signin'
}: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && !loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, initialized, router, redirectTo])

  // Show loading while initializing or loading
  if (!initialized || loading) {
    return <>{fallback}</>
  }

  // Show loading while redirecting
  if (!user) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Auth guard component for conditional rendering based on auth state
 */
export function AuthGuard({ 
  children, 
  requireAuth = true,
  redirectTo = '/auth/signin',
  fallback = <div>Loading...</div>
}: {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
  fallback?: React.ReactNode
}) {
  const { user, loading, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && !loading) {
      if (requireAuth && !user) {
        router.push(redirectTo)
      } else if (!requireAuth && user) {
        router.push('/dashboard')
      }
    }
  }, [user, loading, initialized, requireAuth, router, redirectTo])

  // Show loading while initializing or loading
  if (!initialized || loading) {
    return <>{fallback}</>
  }

  // Check auth requirements
  if (requireAuth && !user) {
    return <>{fallback}</>
  }

  if (!requireAuth && user) {
    return <>{fallback}</>
  }

  return <>{children}</>
}