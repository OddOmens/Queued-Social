import { NextResponse } from 'next/server'

export async function GET() {
  // Only allow in development or with a debug token
  if (process.env.NODE_ENV === 'production' && !process.env.DEBUG_TOKEN) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
    timestamp: new Date().toISOString()
  })
}