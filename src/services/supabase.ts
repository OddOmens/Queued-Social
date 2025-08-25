import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = []
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY')
  
  console.error('❌ Missing Supabase environment variables:', missingVars)
  console.error('📋 Current environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl || 'NOT SET',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'SET' : 'NOT SET',
    MODE: import.meta.env.MODE
  })
  
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
    'Please set these in your Coolify deployment environment variables.'
  )
}

// Validate that we're not using placeholder values
if (supabaseUrl.includes('your-project') || supabaseUrl.includes('placeholder')) {
  throw new Error(
    'VITE_SUPABASE_URL is using a placeholder value. Please set the correct Supabase URL in your Coolify deployment.'
  )
}

if (supabaseAnonKey.includes('your-supabase') || supabaseAnonKey.includes('placeholder')) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is using a placeholder value. Please set the correct Supabase anonymous key in your Coolify deployment.'
  )
}

// Log successful configuration (development only)
if (import.meta.env.MODE === 'development') {
  console.log('✅ Supabase client configured successfully:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    mode: import.meta.env.MODE
  })
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// For backward compatibility with existing code
export const createClient = () => supabase