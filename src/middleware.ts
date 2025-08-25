import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Get session from cookie
  const sessionCookie = request.cookies.get('session')
  
  // Protected routes
  const protectedRoutes = ['/dashboard', '/admin', '/api']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Check if user is authenticated
  let user = null
  if (sessionCookie) {
    try {
      user = JSON.parse(sessionCookie.value)
    } catch {
      // Invalid session cookie
    }
  }

  if (isProtectedRoute && !user) {
    // Redirect to login if accessing protected route without auth
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Role-based access control
  if (user && isProtectedRoute) {
    // Admin routes require admin role
    if (request.nextUrl.pathname.startsWith('/admin') && user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
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

