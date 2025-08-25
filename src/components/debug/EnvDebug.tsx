'use client'

export function EnvDebug() {
  if (typeof window === 'undefined') return null
  
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NODE_ENV: process.env.NODE_ENV,
    // Also check if they're available on window
    windowVars: {
      // @ts-ignore
      NEXT_PUBLIC_SUPABASE_URL: window.__NEXT_DATA__?.props?.pageProps?.env?.NEXT_PUBLIC_SUPABASE_URL,
      // @ts-ignore
      hasAnonKey: !!window.__NEXT_DATA__?.props?.pageProps?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }
  }
  
  console.log('Environment Debug:', envVars)
  
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', fontSize: '12px', zIndex: 9999 }}>
      <strong>Env Debug:</strong>
      <pre>{JSON.stringify(envVars, null, 2)}</pre>
    </div>
  )
}