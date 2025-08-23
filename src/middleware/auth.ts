import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/services/supabase-server'
import type { AuthUser } from '@/types/auth'
import { ErrorCode } from '@/types'

export interface AuthMiddlewareOptions {
  required?: boolean
  redirectTo?: string
}

/**
 * Authentication middleware for API routes
 * Validates JWT token and attaches user to request
 */
export async function withAuth(
  _request: NextRequest,
  options: AuthMiddlewareOptions = { required: true }
): Promise<{ user: AuthUser | null; error: NextResponse | null }> {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get the session from the request
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      if (options.required) {
        return {
          user: null,
          error: NextResponse.json(
            {
              success: false,
              error: {
                code: ErrorCode.UNAUTHORIZED,
                message: 'Authentication required',
                statusCode: 401,
                timestamp: new Date().toISOString()
              }
            },
            { status: 401 }
          )
        }
      }
      return { user: null, error: null }
    }

    return { user: user as AuthUser, error: null }
  } catch (error) {
    console.error('Auth middleware error:', error)
    
    if (options.required) {
      return {
        user: null,
        error: NextResponse.json(
          {
            success: false,
            error: {
              code: ErrorCode.INTERNAL_SERVER_ERROR,
              message: 'Authentication error',
              statusCode: 500,
              timestamp: new Date().toISOString()
            }
          },
          { status: 500 }
        )
      }
    }
    
    return { user: null, error: null }
  }
}

/**
 * Higher-order function to protect API routes
 */
export function requireAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthUser, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const { user, error } = await withAuth(request, { required: true })
    
    if (error) {
      return error
    }
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Authentication required',
            statusCode: 401,
            timestamp: new Date().toISOString()
          }
        },
        { status: 401 }
      )
    }

    return handler(request, user, ...args)
  }
}

/**
 * Optional authentication middleware
 */
export function optionalAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthUser | null, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const { user } = await withAuth(request, { required: false })
    return handler(request, user, ...args)
  }
}

/**
 * Validate API key for webhook endpoints
 */
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const expectedApiKey = process.env.API_KEY
  
  if (!expectedApiKey) {
    console.warn('API_KEY environment variable not set')
    return false
  }
  
  return apiKey === expectedApiKey
}

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(
  request: NextRequest,
  options: { maxRequests: number; windowMs: number } = { maxRequests: 100, windowMs: 60000 }
): boolean {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  
  // Clean up old entries
  const entries = Array.from(rateLimitMap.entries())
  for (const [key, value] of entries) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key)
    }
  }
  
  const current = rateLimitMap.get(ip)
  
  if (!current) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + options.windowMs })
    return true
  }
  
  if (current.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + options.windowMs })
    return true
  }
  
  if (current.count >= options.maxRequests) {
    return false
  }
  
  current.count++
  return true
}