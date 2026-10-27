'use client'

import { createClient } from '@/lib/supabase/client'
import { clearCurrentProfileCache } from '@/lib/auth/current-profile'

const LOGOUT_TIMEOUT_MS = 2500

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('logout-timeout')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * JWT / refresh bozulunca `signOut({ scope: 'global' })` takılı kalabiliyor.
 * Önce sunucuya dener, olmazsa yereli temizler ve her durumda login'e gider.
 */
export async function signOutAndRedirect(redirectTo = '/auth/login') {
  clearCurrentProfileCache()
  const supabase = createClient()

  try {
    await withTimeout(supabase.auth.signOut({ scope: 'global' }), LOGOUT_TIMEOUT_MS)
  } catch {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Yerel temizlik de düşerse yine login'e git.
    }
  }

  window.location.assign(redirectTo)
}
