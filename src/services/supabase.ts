import { createBrowserClient } from '@supabase/ssr'
import { getClientEnv, validateEnv } from './env'

// Client-side Supabase client
export const createClient = () => {
  const env = getClientEnv()
  
  // Use fallback values if environment variables are missing
  const supabaseUrl = env.supabaseUrl || 'https://placeholder.supabase.co'
  const supabaseAnonKey = env.supabaseAnonKey || 'placeholder-key'
  
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