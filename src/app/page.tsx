'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export default function Home() {
  const { user, loading, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && !loading) {
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/auth/signin')
      }
    }
  }, [user, loading, initialized, router])

  // Show loading while determining auth state
  if (!initialized || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Social Media Scheduler</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  return null
}