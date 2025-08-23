'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'

export default function AuthCallback() {
  const router = useRouter()
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth/signin?error=auth_failed')
          return
        }

        if (data.session?.user) {
          setUser(data.session.user as any)
          
          // Create user profile if it doesn't exist
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
              id: data.session.user.id,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }, {
              onConflict: 'id',
              ignoreDuplicates: true
            })

          if (profileError) {
            console.warn('Failed to create user profile:', profileError)
          }

          router.push('/dashboard')
        } else {
          router.push('/auth/signin')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/auth/signin?error=auth_failed')
      } finally {
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router, setUser, setLoading])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}