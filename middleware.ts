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
    pathname.startsWith('/api/auth/') || // Auth API route'ları da public
    pathname.includes('.') // .css, .js, .png, .ico etc.
    
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Response objesini oluştur
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Supabase client'ı cookie yönetimiyle oluştur
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Protected routes kontrol - sadece gerektiğinde user bilgisi al
  const protectedRoutes = ['/dashboard', '/admin', '/api']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute) {
    // Session kontrolü - sadece protected route'larda user bilgisini al
    const { data: { user }, error } = await supabase.auth.getUser()
    
    // Debug logging sadece development'ta
    if (process.env.NODE_ENV === 'development') {
      const authCookies = request.cookies.getAll().filter(c => c.name.includes('auth'))
      console.log('🍪 Auth cookies:', authCookies.map(c => c.name))
      console.log('👤 User check:', { hasUser: !!user, error: error?.message })
    }
    
    if (!user || error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Auth failed, redirecting to login from:', pathname)
      }
      // Redirect to login if accessing protected route without auth
      const redirectUrl = new URL('/auth/login', request.url)
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Auth successful for user:', user.id)
    }
  }

  // Role-based access control kaldırıldı - Dashboard layout'ta kontrol ediliyor
  // Sadece auth kontrolü yeterli, performans için role sorgusu yapılmıyor
  
  return supabaseResponse
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

