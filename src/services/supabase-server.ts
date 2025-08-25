import { createClient } from '@supabase/supabase-js'

// Get environment variables with fallbacks for build time
const getEnvVars = () => {
  // Use Vite environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://build-time-placeholder.supabase.co'
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxNTg0MzQsImV4cCI6MTk2MDczNDQzNH0.placeholder-key-for-build-time'
  const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const nodeEnv = import.meta.env.MODE || 'development'

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    nodeEnv
  }
}

// Server-side Supabase client (for this Vite app, it's the same as regular client)
export const createServerSupabaseClient = () => {
  const env = getEnvVars()

  // In production runtime, don't allow placeholder values
  if (env.nodeEnv === 'production') {
    if (env.supabaseUrl.includes('build-time-placeholder') || env.supabaseAnonKey.includes('placeholder')) {
      throw new Error('Production deployment is using placeholder Supabase values. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables in your deployment.')
    }
  }

  // Debug logging for environment variables (development only)
  if (env.nodeEnv === 'development') {
    console.log('Server Supabase Config:', {
      url: env.supabaseUrl,
      hasKey: !!env.supabaseAnonKey && env.supabaseAnonKey !== 'placeholder-key',
      env: env.nodeEnv,
      hasServiceRole: !!env.supabaseServiceRoleKey
    })
  }

  // Only warn in production if environment variables are missing
  if (env.nodeEnv === 'production' && (!env.supabaseUrl || !env.supabaseAnonKey)) {
    console.error('Missing Supabase environment variables in production:', {
      VITE_SUPABASE_URL: !!env.supabaseUrl,
      VITE_SUPABASE_ANON_KEY: !!env.supabaseAnonKey,
      VITE_SUPABASE_SERVICE_ROLE_KEY: !!env.supabaseServiceRoleKey
    })
  }

  return createClient(env.supabaseUrl, env.supabaseAnonKey)
}

// Server-side client with service role key for admin operations
export const createAdminSupabaseClient = () => {
  const env = getEnvVars()
  const supabaseUrl = env.supabaseUrl

  // In production runtime, don't allow placeholder values
  if (env.nodeEnv === 'production' && supabaseUrl.includes('build-time-placeholder')) {
    throw new Error('Production deployment is using placeholder Supabase URL. Please set VITE_SUPABASE_URL environment variable in your deployment.')
  }

  const serviceRoleKey = env.supabaseServiceRoleKey

  // During build time, use placeholder for service role key
  const finalServiceRoleKey = serviceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE1ODQzNCwiZXhwIjoxOTYwNzM0NDM0fQ.placeholder-service-role-key-for-build-time'

  // Only warn in production runtime if missing (admin client is optional for some features)
  if (!serviceRoleKey && env.nodeEnv === 'production') {
    console.warn('Missing Supabase service role key in production runtime - admin features will be disabled')
  }

  return createClient(supabaseUrl, finalServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}