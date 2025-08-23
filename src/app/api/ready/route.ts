import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase'

export async function GET(request: NextRequest) {
  try {
    const checks = []
    let allHealthy = true
    
    // Database readiness check
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
      
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      checks.push({
        name: 'database',
        status: 'ready',
        message: 'Database connection successful'
      })
    } catch (error) {
      allHealthy = false
      checks.push({
        name: 'database',
        status: 'not_ready',
        message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
    
    // Environment variables check
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    
    if (missingEnvVars.length === 0) {
      checks.push({
        name: 'environment',
        status: 'ready',
        message: 'All required environment variables are set'
      })
    } else {
      allHealthy = false
      checks.push({
        name: 'environment',
        status: 'not_ready',
        message: `Missing environment variables: ${missingEnvVars.join(', ')}`
      })
    }
    
    // File system check
    try {
      const fs = require('fs')
      const path = require('path')
      
      // Check if we can write to temp directory
      const tempDir = path.join(process.cwd(), 'temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      const testFile = path.join(tempDir, 'readiness-test.txt')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      
      checks.push({
        name: 'filesystem',
        status: 'ready',
        message: 'File system is writable'
      })
    } catch (error) {
      allHealthy = false
      checks.push({
        name: 'filesystem',
        status: 'not_ready',
        message: `File system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
    
    const readinessData = {
      status: allHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks
    }
    
    return NextResponse.json(readinessData, { 
      status: allHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('Readiness check failed:', error)
    
    return NextResponse.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: []
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}