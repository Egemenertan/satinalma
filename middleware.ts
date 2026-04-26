import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth Middleware
 * 
 * Sorumluluklar:
 * 1. Supabase auth cookie'lerini güncel tutmak (session refresh)
 * 2. Protected route'ları auth ile korumak
 * 3. Dashboard route'larında profil/rol tutarlılığını server-side garanti etmek
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

  // Dashboard route'larında rolü server-side garanti et.
  // Hedef: Microsoft ile gelen kullanıcıların user rolünde kalmaması.
  if (pathname.startsWith('/dashboard')) {
    const normalizedEmail = user.email?.trim().toLowerCase() ?? ''
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || normalizedEmail || 'Kullanıcı'

    const { data: profile, error: profileReadError } = await supabase
      .from('profiles')
      .select('role, site_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileReadError) {
      return NextResponse.redirect(new URL('/auth/login?error=role_read_failed', request.url))
    }

    if (!profile) {
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
        return NextResponse.redirect(new URL('/auth/login?error=role_create_failed', request.url))
      }
    } else if (profile.role === 'user') {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          role: DEFAULT_DASHBOARD_ROLE,
          site_id: [DEFAULT_SITE_ID],
        })
        .eq('id', user.id)

      if (profileUpdateError) {
        return NextResponse.redirect(new URL('/auth/login?error=role_upgrade_failed', request.url))
      }
    } else if (!Array.isArray(profile.site_id) || profile.site_id.length === 0) {
      const { error: profileSiteUpdateError } = await supabase
        .from('profiles')
        .update({ site_id: [DEFAULT_SITE_ID] })
        .eq('id', user.id)

      if (profileSiteUpdateError) {
        return NextResponse.redirect(new URL('/auth/login?error=site_assign_failed', request.url))
      }
    }
  }

  // Auth başarılı → response döndür (cookie'ler güncellendi)
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
