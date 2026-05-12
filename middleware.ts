import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth Middleware
 *
 * Sorumluluklar:
 * 1. Supabase auth cookie'lerini güncel tutmak (token refresh sırasında set edilen
 *    cookies'i ASLA kaybetmemek — tüm response dönüşlerinde preserve).
 * 2. Protected route'ları auth ile korumak.
 * 3. Dashboard route'larında profil/rol "best-effort" tutarlılığı: hata olursa
 *    kullanıcıyı atma, sadece logla geç. (Kullanıcının session'ı geçerliyken
 *    geçici bir DB hatası onu sistemden atmamalı.)
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
const DEFAULT_DASHBOARD_ROLE = 'site_personnel' as const
const DEFAULT_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7' as const

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

/**
 * Supabase'in token refresh sırasında set ettiği güncel cookies'i,
 * yeni bir response'a (redirect vb.) taşır. Cookies kaybını önler.
 */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie)
  })
  return to
}

function buildLoginRedirect(request: NextRequest, base: NextResponse): NextResponse {
  const redirectUrl = new URL('/auth/login', request.url)
  // Sadece dashboard route'larında redirectTo ekle (API'ler için anlamsız)
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
  }
  return copyCookies(base, NextResponse.redirect(redirectUrl))
}

function buildUnauthorized(base: NextResponse): NextResponse {
  return copyCookies(base, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
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

  // @supabase/ssr middleware pattern (v0.1 API):
  //  - Cookies hem `request`'e (sıradaki Supabase çağrıları için) hem
  //    `supabaseResponse`'a (tarayıcıya gidecek response için) yazılır.
  //  - `supabaseResponse` set/remove içinde yeniden oluşturulur ki
  //    `NextResponse.next({ request })` güncel request cookie'lerini görsün.
  //  - Tüm dönüşlerde cookies'i preserve etmek için `copyCookies` helper'ı
  //    kullanılır (özellikle redirect/401 dönüşlerinde kritik — aksi halde
  //    refresh edilmiş token'lar kaybolur → kullanıcı atılır).
  let supabaseResponse = NextResponse.next({ request })

  const isProd = process.env.NODE_ENV === 'production'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        ...(isProd ? { secure: true } : {}),
      },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set(name, value)
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set(name, '')
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Token doğrulama (gerekirse refresh tetiklenir)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    if (pathname.startsWith('/api/')) {
      return buildUnauthorized(supabaseResponse)
    }
    return buildLoginRedirect(request, supabaseResponse)
  }

  // Dashboard route'larında profil/rol tutarlılığı — BEST-EFFORT.
  // Hata olursa kullanıcıyı sistemden ATMA. Sadece logla, devam et.
  // (Önceki implementasyon her DB hatasında login'e atıyordu — bu defansif değil.)
  if (pathname.startsWith('/dashboard')) {
    try {
      const normalizedEmail = user.email?.trim().toLowerCase() ?? ''
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        normalizedEmail ||
        'Kullanıcı'

      const { data: profile, error: profileReadError } = await supabase
        .from('profiles')
        .select('role, site_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profileReadError) {
        console.warn('[middleware] profile read failed (devam ediliyor):', profileReadError.message)
      } else if (!profile) {
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: normalizedEmail,
            full_name: fullName,
            role: DEFAULT_DASHBOARD_ROLE,
            site_id: [DEFAULT_SITE_ID],
            created_at: new Date().toISOString(),
          })

        if (profileInsertError) {
          console.warn('[middleware] profile insert failed (devam ediliyor):', profileInsertError.message)
        }
      } else if (profile.role === 'user') {
        // Microsoft ile yeni gelen "user" rolünü default dashboard rolüne yükselt
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            role: DEFAULT_DASHBOARD_ROLE,
            site_id: [DEFAULT_SITE_ID],
          })
          .eq('id', user.id)

        if (profileUpdateError) {
          console.warn('[middleware] role upgrade failed (devam ediliyor):', profileUpdateError.message)
        }
      } else if (!Array.isArray(profile.site_id) || profile.site_id.length === 0) {
        const { error: profileSiteUpdateError } = await supabase
          .from('profiles')
          .update({ site_id: [DEFAULT_SITE_ID] })
          .eq('id', user.id)

        if (profileSiteUpdateError) {
          console.warn('[middleware] site assign failed (devam ediliyor):', profileSiteUpdateError.message)
        }
      }
    } catch (err) {
      // Beklenmeyen hata: yine de kullanıcıyı atma
      console.warn('[middleware] role check unexpected error (devam ediliyor):', err)
    }
  }

  // ÖNEMLİ: cookies refresh edilmişse mutlaka tarayıcıya yansısın
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
