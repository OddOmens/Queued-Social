import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Only throw error in runtime, not during build
if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn('Missing Supabase environment variables in production')
}

// Server-side Supabase client for API routes and server components
export const createServerSupabaseClient = () => {
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
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