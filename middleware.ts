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

  // Refresh session if expired - required for Server Components
  const { data: { user }, error } = await supabase.auth.getUser()

  // Protected routes
  const protectedRoutes = ['/dashboard', '/admin', '/api']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute && (!user || error)) {
    // Redirect to login if accessing protected route without auth
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is logged in and trying to access login page, redirect to dashboard
  if (user && request.nextUrl.pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based access control
  if (user && isProtectedRoute) {
    // Get user details from database
    const { data: userData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = userData?.role

    // Admin routes require admin role
    if (request.nextUrl.pathname.startsWith('/admin') && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Site personnel can only access requests pages
    if (userRole === 'site_personnel') {
      const currentPath = request.nextUrl.pathname
      console.log(`🔒 Site personnel accessing: ${currentPath}`)
      
      // Allow all requests-related paths
      if (!currentPath.startsWith('/dashboard/requests')) {
        console.log(`❌ Redirecting site personnel from ${currentPath} to /dashboard/requests`)
        return NextResponse.redirect(new URL('/dashboard/requests', request.url))
      } else {
        console.log(`✅ Site personnel allowed to access: ${currentPath}`)
      }
    }

    // Santiye depo can only access requests pages (same as site personnel)
    if (userRole === 'santiye_depo') {
      const currentPath = request.nextUrl.pathname
      console.log(`🔒 Santiye depo accessing: ${currentPath}`)
      
      // Allow all requests-related paths
      if (!currentPath.startsWith('/dashboard/requests')) {
        console.log(`❌ Redirecting santiye depo from ${currentPath} to /dashboard/requests`)
        return NextResponse.redirect(new URL('/dashboard/requests', request.url))
      } else {
        console.log(`✅ Santiye depo allowed to access: ${currentPath}`)
      }
    }

    // User role cannot access settings
    if (userRole === 'user' && request.nextUrl.pathname.startsWith('/dashboard/settings')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
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
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}

