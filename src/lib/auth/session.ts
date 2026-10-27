/**
 * İstemci Tarafı Oturum Kontrolü
 *
 * `getSession()` süresi dolmuş JWT'yi de döner. Sorgular o token ile gidince
 * "JWT expired" görünür. Aynı anda birden fazla refresh, token rotation yüzünden
 * yenilemeyi düşürür — bu yüzden refresh tek sırada yürür.
 */

import type { Session, SupabaseClient } from '@supabase/supabase-js'

type Supabase = SupabaseClient<any, any, any>

const EXPIRY_SKEW_SECONDS = 60

let refreshInFlight: Promise<Session | null> | null = null

export function isAuthExpiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { message?: string; code?: string; name?: string }
  const text = `${err.message || ''} ${err.code || ''} ${err.name || ''}`.toLowerCase()
  return (
    text.includes('jwt expired') ||
    text.includes('invalid jwt') ||
    text.includes('session expired') ||
    text.includes('invalid claim') ||
    text.includes('bad_jwt') ||
    text.includes('session_not_found')
  )
}

function secondsUntilExpiry(session: Session | null | undefined): number {
  if (!session?.expires_at) return 0
  return session.expires_at - Math.floor(Date.now() / 1000)
}

async function refreshSessionOnce(supabase: Supabase, fallback: Session | null): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) return data.session
    if (fallback && secondsUntilExpiry(fallback) > 0) return fallback
    return null
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

/** Süresi dolmuş veya dolmak üzereyse oturumu yeniler. Yenileme olmazsa null. */
export async function ensureFreshSession(
  supabase: Supabase,
  options?: { force?: boolean }
): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const remaining = secondsUntilExpiry(session)
  if (!options?.force && session?.user && remaining > EXPIRY_SKEW_SECONDS) {
    return session
  }

  return refreshSessionOnce(supabase, session)
}

/**
 * Geçerli (yenilenmiş) kullanıcıyı döndürür.
 * Refresh başarısızsa null — süresi dolmuş JWT ile devam etmez.
 */
export async function getSessionUser(supabase: Supabase): Promise<Session['user'] | null> {
  const session = await ensureFreshSession(supabase)
  if (session?.user) return session.user

  const retry = await ensureFreshSession(supabase, { force: true })
  return retry?.user ?? null
}
