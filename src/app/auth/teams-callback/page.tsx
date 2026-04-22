'use client'

import { useEffect, useRef, useState } from 'react'
import { createEmbeddedAuthClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile, getErrorMessage } from '@/lib/auth'
import {
  initializeTeams,
  teamsNotifyAuthFailure,
  teamsNotifyAuthSuccess,
} from '@/lib/teams'

type Status = 'loading' | 'success' | 'error'

interface ImplicitTokens {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
}

/**
 * Hash fragment'inden Supabase implicit flow token'larını ayıklar.
 *
 * Supabase implicit redirect örneği:
 *   /auth/teams-callback#access_token=...&refresh_token=...&expires_at=...&token_type=bearer&type=signup
 */
function parseImplicitTokensFromHash(hash: string): ImplicitTokens | null {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash
  if (!cleaned) return null

  const params = new URLSearchParams(cleaned)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')

  if (!access_token || !refresh_token) {
    return null
  }

  const expires_at_raw = params.get('expires_at')
  const expires_in_raw = params.get('expires_in')

  return {
    access_token,
    refresh_token,
    expires_at: expires_at_raw ? Number(expires_at_raw) : undefined,
    expires_in: expires_in_raw ? Number(expires_in_raw) : undefined,
  }
}

/**
 * Teams/Outlook popup OAuth callback sayfası (implicit flow).
 *
 * Akış:
 *   1. Microsoft → Supabase → bu sayfaya `#access_token=...` fragment ile yönlenir
 *   2. Token'lar fragment'ten ayıklanır
 *   3. Profil yoksa oluşturulur
 *   4. `notifySuccess` ile parent iframe'e token JSON'u iletilir
 *
 * PKCE yerine implicit flow kullanmamızın sebebi: Teams popup'ı modern
 * tarayıcı storage partitioning'i altında çalışır ve PKCE'nin
 * `code_verifier` cookie'si cross-origin navigation sırasında
 * kaybolabilir. Implicit flow bu state'e ihtiyaç duymaz.
 */
export default function TeamsCallbackPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Giriş yapılıyor...')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const process = async () => {
      const sdkReady = await initializeTeams()

      try {
        const search = new URLSearchParams(window.location.search)
        const oauthError = search.get('error') || (() => {
          // Bazı sağlayıcılar hata alanlarını fragment'ta da koyabilir
          const fragment = new URLSearchParams(
            window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
          )
          return fragment.get('error')
        })()
        const errorDescription =
          search.get('error_description') ||
          new URLSearchParams(
            window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
          ).get('error_description')

        if (oauthError) {
          throw new Error(errorDescription || oauthError)
        }

        const tokens = parseImplicitTokensFromHash(window.location.hash)
        if (!tokens) {
          throw new Error('Microsoft yetkilendirmesi tamamlanamadı (token alınamadı)')
        }

        // Yerel session'ı kur (popup tarafı için) — profile insert yetkisi için
        const supabase = createEmbeddedAuthClient()
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        })

        if (setSessionError || !data.session?.user) {
          throw new Error(getErrorMessage(setSessionError, 'Oturum başlatılamadı'))
        }

        await ensureProfile(
          supabase,
          data.session.user.id,
          data.session.user.email,
          data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name
        )

        setStatus('success')
        setMessage('Giriş başarılı! Yönlendiriliyorsunuz...')

        if (sdkReady) {
          teamsNotifyAuthSuccess({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at,
            user_email: data.session.user.email ?? undefined,
          })
        } else {
          // Teams SDK yoksa: bu popup normal tarayıcıdan açılmış demektir
          window.location.href = '/dashboard/requests'
        }
      } catch (err) {
        const message = getErrorMessage(err, 'Microsoft girişi tamamlanamadı')
        setStatus('error')
        setMessage(message)

        if (sdkReady) {
          try {
            teamsNotifyAuthFailure(message)
          } catch {
            /* sessizce geç */
          }
        }
      }
    }

    process()
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === 'loading' && <Loading size="lg" text={message} />}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-gray-900">{message}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-red-600">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
