import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth Middleware
 * 
 * Sorumluluklar:
 * 1. Supabase auth cookie'lerini güncel tutmak (session refresh)
 * 2. Protected route'ları auth ile korumak
 * 3. Rol bazlı erişim kontrolü dashboard layout'a delege edilmiştir
 * 
 * Public route'lar:
 * - / (anasayfa)
 * - /auth/* (login, signup, callback)
 * - /api/public/*, /api/auth/*
 * - Static dosyalar (.css, .js, .png, vb.)
 */

const PROTECTED_ROUTE_PREFIXES = ['/dashboard', '/admin'] as const
const PROTECTED_API_PREFIXES = ['/api'] as const

const PUBLIC_API_PREFIXES = ['/api/public/', '/api/auth/'] as const

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname.startsWith('/auth/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  // Static asset (file extension içeriyor)
  if (pathname.includes('.') && !pathname.startsWith('/api/')) return true
  return false
}

function isProtectedRoute(pathname: string): boolean {
  if (PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  if (PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  return false
}

function buildLoginRedirect(request: NextRequest): NextResponse {
  const redirectUrl = new URL('/auth/login', request.url)
  // Sadece dashboard route'larında redirectTo ekle (API'ler için anlamsız)
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
  }
  return NextResponse.redirect(redirectUrl)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public route'lar için bypass
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Protected olmayan route'lara karışma (güvenlik için varsayılan: bypass)
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next()
  }

  // Supabase client + session refresh için response
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          supabaseResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          supabaseResponse.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Session kontrolü
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user || error) {
    // API route ise 401 dön, sayfa ise login'e yönlendir
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return buildLoginRedirect(request)
  }

  // Auth başarılı → response döndür (cookie'ler güncellendi)
  // Rol bazlı kontrol dashboard/layout.tsx'te yapılıyor
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
