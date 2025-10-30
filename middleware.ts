import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Static dosyalar, public assets ve auth sayfalarını kontrol etme
  const isPublicRoute = 
    pathname.startsWith('/auth/') || 
    pathname === '/' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/public/') ||
    pathname.includes('.') // .css, .js, .png, .ico etc.
    
  if (isPublicRoute) {
    return NextResponse.next()
  }

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
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Session kontrolü - sadece user bilgisini al, token refresh otomatik
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

    // Site manager can only access requests pages
    if (userRole === 'site_manager') {
      const currentPath = request.nextUrl.pathname
      
      // Allow all requests-related paths
      if (!currentPath.startsWith('/dashboard/requests')) {
        return NextResponse.redirect(new URL('/dashboard/requests', request.url))
      }
    }

    // Site personnel can only access requests pages
    if (userRole === 'site_personnel') {
      const currentPath = request.nextUrl.pathname
      
      // Allow all requests-related paths
      if (!currentPath.startsWith('/dashboard/requests')) {
        return NextResponse.redirect(new URL('/dashboard/requests', request.url))
      }
    }

    // Santiye depo can only access requests pages (same as site personnel)
    if (userRole === 'santiye_depo') {
      const currentPath = request.nextUrl.pathname
      
      // Allow all requests-related paths
      if (!currentPath.startsWith('/dashboard/requests')) {
        return NextResponse.redirect(new URL('/dashboard/requests', request.url))
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

