/**
 * Environment Variable Validation Utility
 * Helps debug environment variable issues in production
 */

export interface EnvCheckResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  config: {
    supabaseUrl: string
    hasAnonKey: boolean
    appUrl: string
    mode: string
  }
}

export function checkEnvironmentVariables(): EnvCheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const appUrl = import.meta.env.VITE_APP_URL
  const mode = import.meta.env.MODE

  // Check required variables
  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is not set')
  } else if (supabaseUrl.includes('your-project') || supabaseUrl.includes('placeholder')) {
    errors.push('VITE_SUPABASE_URL is using placeholder value')
  }

  if (!supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is not set')
  } else if (supabaseAnonKey.includes('placeholder') || supabaseAnonKey.includes('your-supabase')) {
    errors.push('VITE_SUPABASE_ANON_KEY is using placeholder value')
  }

  // Check optional variables
  if (!appUrl && mode === 'production') {
    warnings.push('VITE_APP_URL is not set in production')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: {
      supabaseUrl: supabaseUrl || 'NOT SET',
      hasAnonKey: !!supabaseAnonKey,
      appUrl: appUrl || 'NOT SET',
      mode: mode || 'unknown'
    }
  }
}

// Auto-check in development
if (import.meta.env.MODE === 'development') {
  const check = checkEnvironmentVariables()
  if (!check.isValid) {
    console.error('❌ Environment Variable Errors:', check.errors)
  }
  if (check.warnings.length > 0) {
    console.warn('⚠️ Environment Variable Warnings:', check.warnings)
  }
  if (check.isValid && check.warnings.length === 0) {
    console.log('✅ Environment variables are properly configured')
  }
}