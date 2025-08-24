/**
 * Runtime environment configuration
 * This ensures environment variables are loaded at runtime, not build time
 */

import getConfig from 'next/config'

// Get runtime config (fallback for when env vars aren't available at build time)
const getRuntimeConfig = () => {
  try {
    const { publicRuntimeConfig, serverRuntimeConfig } = getConfig() || {}
    return { publicRuntimeConfig: publicRuntimeConfig || {}, serverRuntimeConfig: serverRuntimeConfig || {} }
  } catch {
    return { publicRuntimeConfig: {}, serverRuntimeConfig: {} }
  }
}

// Server-side environment variables (available at runtime)
export const getServerEnv = () => {
  const { publicRuntimeConfig, serverRuntimeConfig } = getRuntimeConfig()
  
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 
                 process.env.SUPABASE_URL || 
                 publicRuntimeConfig.supabaseUrl,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     process.env.SUPABASE_ANON_KEY || 
                     publicRuntimeConfig.supabaseAnonKey,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 
                           serverRuntimeConfig.supabaseServiceRoleKey,
    nodeEnv: process.env.NODE_ENV
  }
}

// Client-side environment variables (must be NEXT_PUBLIC_* to be available in browser)
export const getClientEnv = () => {
  const { publicRuntimeConfig } = getRuntimeConfig()
  
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || publicRuntimeConfig.supabaseUrl,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || publicRuntimeConfig.supabaseAnonKey,
    nodeEnv: process.env.NODE_ENV
  }
}

// Validate environment variables
export const validateEnv = (isServer = false) => {
  const env = isServer ? getServerEnv() : getClientEnv()
  
  const missing = []
  if (!env.supabaseUrl) missing.push('SUPABASE_URL')
  if (!env.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY')
  
  if (missing.length > 0) {
    const context = isServer ? 'server' : 'client'
    console.error(`Missing ${context} environment variables:`, missing)
    return false
  }
  
  return true
}