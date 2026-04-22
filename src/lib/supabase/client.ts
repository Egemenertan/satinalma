import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../supabase'

/**
 * Genel browser Supabase client (singleton, PKCE flow).
 *
 * Tüm uygulama bunu kullanır. PKCE en güvenli OAuth flow'udur
 * ve normal tarayıcı oturumlarında sorunsuz çalışır.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Teams / Outlook popup akışı için izole client.
 *
 * Neden ayrı bir client?
 * - Embedded ortamda popup, Teams SDK tarafından açılır ve modern
 *   tarayıcılarda **storage partitioning** uygulanır. PKCE flow'unun
 *   ihtiyaç duyduğu `code_verifier` cookie'si, popup Microsoft'a gidip
 *   geri dönerken kaybolabilir → "invalid request: both auth code and
 *   code verifier should be non-empty" hatası.
 * - **Implicit flow** çözüm: token'lar callback URL'inin fragment
 *   kısmında doğrudan gelir, ayrı bir state cookie'sine ihtiyaç yoktur.
 * - `isSingleton: false` ile ana uygulamadaki PKCE singleton'ı
 *   değiştirmez; sadece popup sayfalarında kullanılır.
 */
export function createEmbeddedAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    isSingleton: false,
    // Runtime'da boş cookies methodları varsa @supabase/ssr otomatik
    // olarak document.cookie'ye düşer; tip imzası zorunlu kıldığı için
    // boş bir objeyle geçiyoruz.
    cookies: {},
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}
