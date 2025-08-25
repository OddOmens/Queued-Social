#!/usr/bin/env node

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnvFile(filename) {
  try {
    const envPath = join(__dirname, '..', filename)
    const content = readFileSync(envPath, 'utf8')
    const env = {}
    
    content.split('\n').forEach(line => {
      line = line.trim()
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    
    return env
  } catch (error) {
    console.warn(`Warning: Could not load ${filename}`)
    return {}
  }
}

function validateEnvironment(env, envName) {
  const errors = []
  const warnings = []
  
  // Required variables
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ]
  
  // Production-specific required variables
  const productionRequired = [
    'APP_URL',
    'THREADS_CLIENT_ID',
    'THREADS_CLIENT_SECRET'
  ]
  
  // Check required variables
  required.forEach(key => {
    if (!env[key]) {
      errors.push(`${key} is required`)
    }
  })
  
  // Check production-specific variables
  if (envName === 'production') {
    productionRequired.forEach(key => {
      if (!env[key]) {
        errors.push(`${key} is required in production`)
      }
    })
    
    // Validate URLs
    if (env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_URL.startsWith('https://')) {
      errors.push('VITE_SUPABASE_URL must be HTTPS in production')
    }
    
    if (env.APP_URL && !env.APP_URL.startsWith('https://')) {
      errors.push('APP_URL must be HTTPS in production')
    }
    
    if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL.includes('localhost')) {
      errors.push('Cannot use localhost URLs in production')
    }
  }
  
  // Optional but recommended variables
  const recommended = [
    'THREADS_CLIENT_ID',
    'THREADS_CLIENT_SECRET'
  ]
  
  recommended.forEach(key => {
    if (!env[key] && envName !== 'production') {
      warnings.push(`${key} is not set - some features may not work`)
    }
  })
  
  return { errors, warnings }
}

function main() {
  const environments = ['local', 'production']
  let hasErrors = false
  
  console.log('🔍 Validating environment configurations...\n')
  
  environments.forEach(envName => {
    const filename = envName === 'local' ? '.env.local' : `.env.${envName}`
    const env = loadEnvFile(filename)
    
    if (Object.keys(env).length === 0) {
      console.log(`⚠️  ${filename} not found or empty`)
      return
    }
    
    const { errors, warnings } = validateEnvironment(env, envName)
    
    console.log(`📋 ${filename}:`)
    
    if (errors.length === 0) {
      console.log('  ✅ Valid configuration')
    } else {
      console.log('  ❌ Configuration errors:')
      errors.forEach(error => console.log(`    - ${error}`))
      hasErrors = true
    }
    
    if (warnings.length > 0) {
      console.log('  ⚠️  Warnings:')
      warnings.forEach(warning => console.log(`    - ${warning}`))
    }
    
    console.log()
  })
  
  if (hasErrors) {
    console.log('❌ Environment validation failed. Please fix the errors above.')
    process.exit(1)
  } else {
    console.log('✅ All environment configurations are valid!')
  }
}

main()