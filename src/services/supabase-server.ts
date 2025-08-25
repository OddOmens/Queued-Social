import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServerEnv, validateEnv } from './env'

// Server-side Supabase client for API routes and server components
export const createServerSupabaseClient = () => {
  const env = getServerEnv()

  // Use fallback values during build time to prevent URL validation errors
  const supabaseUrl = env.supabaseUrl || 'https://build-time-placeholder.supabase.co'
  const supabaseAnonKey = env.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxNTg0MzQsImV4cCI6MTk2MDczNDQzNH0.placeholder-key-for-build-time'

  // In production runtime, don't allow placeholder values
  if (env.nodeEnv === 'production' && typeof window === 'undefined') {
    if (supabaseUrl.includes('build-time-placeholder') || supabaseAnonKey.includes('placeholder')) {
      throw new Error('Production deployment is using placeholder Supabase values. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables in your deployment.')
    }
  }

  // Debug logging for environment variables (development only)
  if (env.nodeEnv === 'development') {
    console.log('Server Supabase Config:', {
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key',
      env: env.nodeEnv,
      hasServiceRole: !!env.supabaseServiceRoleKey,
      isValid: validateEnv(true)
    })
  }

  // Only warn in production if environment variables are missing
  if (env.nodeEnv === 'production' && (!env.supabaseUrl || !env.supabaseAnonKey)) {
    console.error('Missing Supabase environment variables in production:', {
      NEXT_PUBLIC_SUPABASE_URL: !!env.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!env.supabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: !!env.supabaseServiceRoleKey
    })
  }

  // During build time, cookies() is not available, so we provide a fallback
  let cookieStore: any

  try {
    cookieStore = cookies()
  } catch (error) {
    // During build time, provide a mock cookie store
    cookieStore = {
      get: () => undefined,
      set: () => { },
      delete: () => { }
    }
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get?.(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set?.({ name, value, ...options })
      },
      remove(name: string, options: any) {
        cookieStore.set?.({ name, value: '', ...options })
      },
    },
  })
}

// Server-side client with service role key for admin operations
export const createAdminSupabaseClient = () => {
  const env = getServerEnv()
  const supabaseUrl = env.supabaseUrl || 'https://build-time-placeholder.supabase.co'

  // In production runtime, don't allow placeholder values
  if (env.nodeEnv === 'production' && typeof window === 'undefined' && supabaseUrl.includes('build-time-placeholder')) {
    throw new Error('Production deployment is using placeholder Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL environment variable in your deployment.')
  }
  const serviceRoleKey = env.supabaseServiceRoleKey

  // During build time, use placeholder for service role key
  const finalServiceRoleKey = serviceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE1ODQzNCwiZXhwIjoxOTYwNzM0NDM0fQ.placeholder-service-role-key-for-build-time'

  // Only warn in production runtime if missing (admin client is optional for some features)
  if (!serviceRoleKey && env.nodeEnv === 'production' && typeof window === 'undefined') {
    console.warn('Missing Supabase service role key in production runtime - admin features will be disabled')
  }

  return createServerClient(supabaseUrl, finalServiceRoleKey, {
    cookies: {
      get() { return undefined },
      set() { },
      remove() { },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}