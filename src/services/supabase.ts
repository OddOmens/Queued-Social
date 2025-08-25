import { createBrowserClient } from '@supabase/ssr'
import { getClientEnv, validateEnv } from './env'

// Client-side Supabase client
export const createClient = () => {
  const env = getClientEnv()
  
  // Log warning but don't throw to prevent app crashes
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      console.warn('Missing Supabase environment variables:', {
        NEXT_PUBLIC_SUPABASE_URL: !!env.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!env.supabaseAnonKey
      })
    }
  }
  
  const supabaseUrl = env.supabaseUrl || 'https://build-time-placeholder.supabase.co'
  const supabaseAnonKey = env.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxNTg0MzQsImV4cCI6MTk2MDczNDQzNH0.placeholder-key-for-build-time'
  
  // Debug logging for environment variables
  if (typeof window !== 'undefined') {
    console.log('Client Supabase Config:', {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key',
      env: env.nodeEnv,
      isValid: validateEnv(false)
    })
    
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      console.error('Missing Supabase environment variables:', {
        NEXT_PUBLIC_SUPABASE_URL: !!env.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!env.supabaseAnonKey
      })
    }
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}