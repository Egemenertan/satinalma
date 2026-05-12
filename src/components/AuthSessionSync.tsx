'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const FOCUS_REFRESH_MS = 25_000

/**
 * Arka planda sekmeyken access token süresi dolabilir; tarayıcı timer'ları kısıtlanır.
 * Sekmeye dönünce veya pencere odaklanınca getSession() ile (içeride gerekirse)
 * refresh_token kullanılarak oturum yenilenir; SSR ile aynı çerezler güncellenir.
 */
export function AuthSessionSync() {
  const supabase = createClient()
  const lastAttemptRef = useRef(0)

  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastAttemptRef.current < FOCUS_REFRESH_MS) return
      lastAttemptRef.current = now
      void supabase.auth.getSession()
    }

    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [supabase])

  return null
}
