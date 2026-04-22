import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../supabase'

/**
 * Browser Supabase client (singleton, PKCE flow).
 *
 * Tüm uygulama bu client'ı kullanır. PKCE en güvenli OAuth flow'udur.
 *
 * Teams/Outlook embedded ortamda da bu client kullanılır — çünkü auth
 * popup'ta değil, **yeni bir top-level browser tab'da** gerçekleşir
 * (bkz: src/app/auth/login/page.tsx). Top-level context'te cookie ve
 * PKCE state sorunsuz çalışır.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
