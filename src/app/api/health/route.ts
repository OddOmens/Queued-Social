import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase'

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    
    // Check database connectivity
    const supabase = createClient()
    const { data: dbCheck, error: dbError } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
      .single()
    
    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw new Error(`Database connection failed: ${dbError.message}`)
    }
    
    const responseTime = Date.now() - startTime
    
    // Basic health metrics
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      database: {
        status: 'connected',
        responseTime: `${responseTime}ms`
      },
      services: {
        supabase: 'connected',
        cron: process.env.ENABLE_CRON_JOBS === 'true' ? 'enabled' : 'disabled'
      }
    }
    
    return NextResponse.json(healthData, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    
    const errorData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV || 'development'
    }
    
    return NextResponse.json(errorData, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}