interface EnvironmentConfig {
  supabaseUrl: string | undefined
  supabaseAnonKey: string | undefined
  threadsClientId: string | undefined
  threadsClientSecret: string | undefined
  nodeEnv: string | undefined
  appUrl: string | undefined
}

interface EnvironmentCheck {
  isValid: boolean
  errors: string[]
  warnings: string[]
  config: EnvironmentConfig
}

export function checkEnvironmentVariables(): EnvironmentCheck {
  const config: EnvironmentConfig = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    threadsClientId: import.meta.env.VITE_THREADS_CLIENT_ID || import.meta.env.THREADS_CLIENT_ID,
    threadsClientSecret: import.meta.env.VITE_THREADS_CLIENT_SECRET || import.meta.env.THREADS_CLIENT_SECRET,
    nodeEnv: import.meta.env.NODE_ENV,
    appUrl: import.meta.env.VITE_APP_URL || import.meta.env.APP_URL
  }

  const errors: string[] = []
  const warnings: string[] = []

  // Critical environment variables
  if (!config.supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is required')
  } else if (!config.supabaseUrl.startsWith('https://')) {
    errors.push('VITE_SUPABASE_URL must be a valid HTTPS URL')
  }

  if (!config.supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is required')
  }

  // Platform-specific checks
  if (!config.threadsClientId) {
    warnings.push('THREADS_CLIENT_ID is not set - Threads integration will not work')
  }

  if (!config.threadsClientSecret) {
    warnings.push('THREADS_CLIENT_SECRET is not set - Threads integration will not work')
  }

  // Production-specific checks
  if (config.nodeEnv === 'production') {
    if (!config.appUrl) {
      errors.push('APP_URL is required in production')
    } else if (!config.appUrl.startsWith('https://')) {
      errors.push('APP_URL must be HTTPS in production')
    }

    if (config.supabaseUrl?.includes('localhost')) {
      errors.push('Cannot use localhost Supabase URL in production')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config
  }
}

export function logEnvironmentStatus(): void {
  const check = checkEnvironmentStatus()
  
  if (check.isValid) {
    console.log('✅ Environment configuration is valid')
    if (check.warnings.length > 0) {
      console.warn('⚠️ Environment warnings:', check.warnings)
    }
  } else {
    console.error('❌ Environment configuration errors:', check.errors)
    if (check.warnings.length > 0) {
      console.warn('⚠️ Environment warnings:', check.warnings)
    }
  }
}

// Alias for backward compatibility
export const checkEnvironmentStatus = checkEnvironmentVariables