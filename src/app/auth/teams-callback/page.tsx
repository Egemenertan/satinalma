'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile, getErrorMessage } from '@/lib/auth'
import {
  initializeTeams,
  teamsNotifyAuthFailure,
  teamsNotifyAuthSuccess,
} from '@/lib/teams'

type Status = 'loading' | 'success' | 'error'

/**
 * Teams/Outlook popup OAuth callback sayfası.
 *
 * Akış:
 *  1. Microsoft, OAuth code'u ile bu sayfaya yönlendirir.
 *  2. Supabase ile code -> session exchange yapılır.
 *  3. Profil yoksa oluşturulur.
 *  4. `notifySuccess` ile parent window'a access/refresh token JSON'u
 *     iletilir. Parent window bu token'larla `setSession` çağıracak.
 *
 * Bu yaklaşım iframe ile parent arasında cookie partitioning sorunlarını
 * tamamen atlar — token'lar postMessage benzeri bir kanaldan geçer.
 */
export default function TeamsCallbackPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Giriş yapılıyor...')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const process = async () => {
      // Popup içinde Teams SDK init — notify* çağrıları için zorunlu
      const sdkReady = await initializeTeams()

      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const oauthError = params.get('error')
        const errorDescription = params.get('error_description')

        if (oauthError) {
          throw new Error(errorDescription || oauthError)
        }

        if (!code) {
          throw new Error('Microsoft yetkilendirme kodu alınamadı')
        }

        const supabase = createClient()
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          throw exchangeError
        }

        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user || !session.access_token || !session.refresh_token) {
          throw new Error('Oturum oluşturulamadı')
        }

        await ensureProfile(
          supabase,
          session.user.id,
          session.user.email,
          session.user.user_metadata?.full_name || session.user.user_metadata?.name
        )

        setStatus('success')
        setMessage('Giriş başarılı! Yönlendiriliyorsunuz...')

        if (sdkReady) {
          // Token'ları parent iframe'e döndür
          teamsNotifyAuthSuccess({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user_email: session.user.email ?? undefined,
          })
        } else {
          // Teams SDK yoksa: bu popup normal tarayıcıdan açılmış demektir,
          // dashboard'a yönlendirelim
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
