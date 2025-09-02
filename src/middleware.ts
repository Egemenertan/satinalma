import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
        set(name: string, value: string, options: CookieOptions) {
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
        remove(name: string, options: CookieOptions) {
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

  // Korunan route'ları kontrol et
  const protectedRoutes = ['/dashboard', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute) {
    console.log('🔒 Middleware: Checking protected route:', request.nextUrl.pathname)
    
    // Session'ı refresh et - cookies'leri güncelle
    const { data: session } = await supabase.auth.getSession()
    console.log('📋 Middleware: Session exists:', !!session.session)
    
    const { data: { user }, error } = await supabase.auth.getUser()
    console.log('🔍 Middleware: User check:', { user: user?.id, error })
    
    if (!user) {
      console.log('❌ Middleware: No user, redirecting to login')
      // Login'e yönlendir
      const redirectUrl = new URL('/auth/login', request.url)
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Kullanıcı profili kontrol et
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('👤 Middleware: Profile check:', { role: profile?.role })

    // Admin route'ları için admin rolü gerekli
    if (request.nextUrl.pathname.startsWith('/admin') && profile?.role !== 'admin') {
      console.log('❌ Middleware: Admin role required, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    console.log('✅ Middleware: All checks passed, allowing access')
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