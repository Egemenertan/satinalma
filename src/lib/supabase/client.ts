import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../supabase'
import { createAuthCookieStorage, createBrowserCookieStore } from './auth-cookie-storage'

/**
 * Browser Supabase client (singleton, PKCE flow).
 *
 * Tüm uygulama bu client'ı kullanır. PKCE en güvenli OAuth flow'udur.
 * Kod takası yalnızca `/auth/callback` sayfasında yapılır. İstemcinin
 * adresteki kodu kendiliğinden takas etmesi ikinci bir isteğe ve boş
 * code verifier hatasına yol açıyordu.
 *
 * Teams/Outlook embedded ortamda da bu client kullanılır — çünkü auth
 * popup'ta değil, **yeni bir top-level browser tab'da** gerçekleşir
 * (bkz: src/app/auth/login/page.tsx).
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }

  const isProd = process.env.NODE_ENV === 'production'
  const cookieOptions = {
    path: '/',
    sameSite: 'lax' as const,
    ...(isProd ? { secure: true as const } : {}),
  }
  const browserCookies = createBrowserCookieStore()

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: browserCookies,
    cookieOptions,
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      storage: createAuthCookieStorage(browserCookies, cookieOptions, false),
    },
  })
}
