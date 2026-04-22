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

const HANDOFF_QUERY_KEY = 'handoff_id'

/**
 * Hash fragment'inden Supabase implicit flow token'larını ayıklar.
 *
 * Örnek:
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

function getHashOrSearchParam(key: string): string | null {
  const search = new URLSearchParams(window.location.search).get(key)
  if (search) return search
  const hashStr = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  return new URLSearchParams(hashStr).get(key)
}

/**
 * Teams/Outlook popup OAuth callback sayfası (implicit flow + handoff).
 *
 * Akış:
 *   1. Microsoft → Supabase → bu sayfa `#access_token=...&refresh_token=...`
 *   2. Token'lar fragment'ten ayıklanır.
 *   3. Yerel session kurulur ve profil garanti altına alınır.
 *   4. Token'lar `/api/auth/handoff/[id]` endpoint'ine POST edilir
 *      (parent iframe COOP nedeniyle notifySuccess'i alamayabilir).
 *   5. Best-effort olarak `notifySuccess` da çağrılır (eski/uyumlu host'lar
 *      için).
 *
 * Parent iframe handoff endpoint'ini polling ile kontrol eder ve token'ları
 * çeker — bu, browser COOP / storage partitioning kısıtlarını tamamen atlar.
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
        const oauthError =
          new URLSearchParams(window.location.search).get('error') ||
          new URLSearchParams(
            window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
          ).get('error')

        const errorDescription =
          new URLSearchParams(window.location.search).get('error_description') ||
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

        // Yerel session kurulumu (popup tarafı için) — ensureProfile için gerekli
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

        const payload = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          user_email: data.session.user.email ?? undefined,
        }

        // (1) Server-side handoff: COOP / storage partitioning'i atlayan
        //     birincil kanal. Parent iframe burayı polling yapar.
        const handoffId = getHashOrSearchParam(HANDOFF_QUERY_KEY)
        if (handoffId) {
          try {
            await fetch(`/api/auth/handoff/${encodeURIComponent(handoffId)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'omit',
            })
          } catch (handoffErr) {
            // Handoff'a yazılamadıysa hata değil — fallback notifySuccess var
            console.error('[teams-callback] handoff POST failed', handoffErr)
          }
        }

        setStatus('success')
        setMessage('Giriş başarılı! Yönlendiriliyorsunuz...')

        // (2) Best-effort: legacy / aynı-origin host'lar için Teams SDK kanalı
        if (sdkReady) {
          try {
            teamsNotifyAuthSuccess(payload)
          } catch {
            /* COOP severe etmişse sessizce geç — handoff zaten devrede */
          }
        }

        // (3) Eğer Teams ortamı yoksa popup standalone açılmıştır → dashboard
        if (!sdkReady && !handoffId) {
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
            <p className="text-sm text-gray-500">Bu pencere otomatik kapanmazsa kapatabilirsiniz.</p>
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
