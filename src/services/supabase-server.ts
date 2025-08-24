import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServerEnv, validateEnv } from './env'

// Server-side Supabase client for API routes and server components
export const createServerSupabaseClient = () => {
  const env = getServerEnv()
  
  // Use fallback values if environment variables are missing
  const supabaseUrl = env.supabaseUrl || 'https://placeholder.supabase.co'
  const supabaseAnonKey = env.supabaseAnonKey || 'placeholder-key'
  
  // Debug logging for environment variables
  console.log('Server Supabase Config:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key',
    env: env.nodeEnv,
    hasServiceRole: !!env.supabaseServiceRoleKey,
    isValid: validateEnv(true)
  })
  
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
      set: () => {},
      delete: () => {}
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
  const supabaseUrl = env.supabaseUrl || 'https://placeholder.supabase.co'
  const serviceRoleKey = env.supabaseServiceRoleKey
  
  if (!serviceRoleKey) {
    throw new Error('Missing Supabase service role key')
  }
  
  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      get() { return undefined },
      set() {},
      remove() {},
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}