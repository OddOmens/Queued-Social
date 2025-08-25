/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
    outputFileTracingRoot: process.cwd(),
  },
  
  // Ensure environment variables are available at build time
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://build-time-placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxNTg0MzQsImV4cCI6MTk2MDczNDQzNH0.placeholder-key-for-build-time',
  },
  
  // Add runtime configuration for dynamic environment loading
  publicRuntimeConfig: {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  },
  
  serverRuntimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
}

module.exports = nextConfig