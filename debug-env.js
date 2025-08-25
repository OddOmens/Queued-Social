#!/usr/bin/env node

console.log('=== Environment Variable Debug ===')
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL || 'NOT_SET')
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET')
console.log('APP_URL:', process.env.APP_URL || 'NOT_SET')

console.log('\n=== All Environment Variables ===')
Object.keys(process.env)
  .filter(key => key.includes('SUPABASE') || key.includes('VITE_'))
  .sort()
  .forEach(key => {
    const value = process.env[key]
    if (value) {
      console.log(`${key}:`, value.length > 50 ? value.substring(0, 50) + '...' : value)
    }
  })