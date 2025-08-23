import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Define route patterns
  const isAuthRoute = pathname.startsWith('/auth/')
  const isApiRoute = pathname.startsWith('/api/')
  const isPublicRoute = pathname === '/' || isAuthRoute
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                          pathname.startsWith('/settings') || 
                          pathname.startsWith('/profile')

  // Handle API routes separately (they have their own auth middleware)
  if (isApiRoute) {
    return response
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect unauthenticated users to signin for protected routes
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}