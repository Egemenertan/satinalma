'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile, getRedirectPath, getErrorMessage } from '@/lib/auth'

const HANDOFF_QUERY_KEY = 'handoff_id'

/**
 * OAuth callback (PKCE).
 *
 * İki mod:
 *
 * 1. **Standart tarayıcı**: code → exchange → ensureProfile → /dashboard/...
 *
 * 2. **Embedded handoff** (?handoff_id=X varsa): Bu sekme aslında iframe'in
 *    açtığı yeni bir browser tab. Token'lar `/api/auth/handoff/[id]`
 *    endpoint'ine POST edilir (iframe burayı polling yapıyor) ve sekme
 *    `window.close()` ile kapanır.
 */
export default function AuthCallback() {
  const supabase = createClient()
  const handled = useRef(false)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Giriş yapılıyor...')

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const process = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const oauthError = params.get('error')
        const errorDescription = params.get('error_description')
        const handoffId = params.get(HANDOFF_QUERY_KEY)

        if (oauthError) {
          if (handoffId) {
            setStatus('error')
            setMessage(errorDescription || oauthError)
            return
          }
          window.location.href = `/auth/login?error=${encodeURIComponent(oauthError)}`
          return
        }

        if (!code) {
          if (handoffId) {
            setStatus('error')
            setMessage('Microsoft yetkilendirme kodu alınamadı')
            return
          }
          window.location.href = '/auth/login?error=no_code'
          return
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          throw exchangeError
        }

        // Cookie'lerin yazılması için kısa bekleme (SSR cookie sync)
        await new Promise((r) => setTimeout(r, 300))

        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          if (handoffId) {
            setStatus('error')
            setMessage('Oturum oluşturulamadı')
            return
          }
          window.location.href = '/auth/login?error=no_session'
          return
        }

        const role = await ensureProfile(
          supabase,
          session.user.id,
          session.user.email,
          session.user.user_metadata?.full_name || session.user.user_metadata?.name
        )

        if (handoffId) {
          // Embedded mod: token'ları handoff endpoint'ine ilet, sekmeyi kapat
          if (!session.access_token || !session.refresh_token) {
            throw new Error('Token bilgisi eksik')
          }

          await fetch(`/api/auth/handoff/${encodeURIComponent(handoffId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
              user_email: session.user.email ?? undefined,
            }),
          })

          setStatus('success')
          setMessage('Giriş başarılı! Bu sekme kapanıyor...')

          setTimeout(() => {
            try {
              window.close()
            } catch {
              /* tarayıcı izin vermezse mesaj görünür kalır */
            }
          }, 800)
          return
        }

        // Standart mod: dashboard'a git
        window.location.href = getRedirectPath(role)
      } catch (err) {
        const handoffId = new URLSearchParams(window.location.search).get(HANDOFF_QUERY_KEY)
        const message = getErrorMessage(err, 'Giriş sırasında bir hata oluştu')
        console.error('Callback error:', err)

        if (handoffId) {
          setStatus('error')
          setMessage(message)
          return
        }
        window.location.href = `/auth/login?error=${encodeURIComponent('callback_failed')}`
      }
    }

    process()
  }, [supabase])

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
            <p className="text-sm text-gray-500">Bu sekme otomatik kapanmazsa kapatabilirsiniz.</p>
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
