'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile, getErrorMessage } from '@/lib/auth'

type Status = 'loading' | 'success' | 'error'

const HANDOFF_QUERY_KEY = 'handoff_id'

/**
 * Teams/Outlook embedded handoff flow için OAuth callback sayfası.
 *
 * **Yeni browser tab'da (top-level)** çalışır — popup değil. Standart
 * PKCE OAuth callback'i: cookie & code_verifier sorunsuz okunur.
 *
 * Akış:
 *   1. Microsoft → Supabase → bu sayfaya `?code=...&handoff_id=...` ile yönlenir.
 *   2. `exchangeCodeForSession(code)` ile session kurulur (PKCE).
 *   3. Profil yoksa oluşturulur.
 *   4. Token'lar `/api/auth/handoff/[id]` endpoint'ine POST edilir
 *      (parent iframe burayı polling yapıyor).
 *   5. Tab otomatik kapanır (`window.close()`).
 */
function TeamsCallbackContent() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Giriş yapılıyor...')
  const handled = useRef(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const process = async () => {
      try {
        const oauthError = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (oauthError) {
          throw new Error(errorDescription || oauthError)
        }

        const code = searchParams.get('code')
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

        const handoffId = searchParams.get(HANDOFF_QUERY_KEY)
        if (handoffId) {
          // Parent iframe'e token'ları handoff endpoint'i ile ilet
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
          setMessage('Giriş başarılı! Pencere kapatılıyor...')

          // Tab'ı kısa bir gecikmeyle kapat (kullanıcı mesajı görsün)
          setTimeout(() => {
            try {
              window.close()
            } catch {
              /* tarayıcı izin vermezse mesaj görünür kalır */
            }
          }, 800)
        } else {
          // Handoff yoksa: bu standart browser login — dashboard'a git
          setStatus('success')
          setMessage('Giriş başarılı! Yönlendiriliyorsunuz...')
          window.location.href = '/dashboard/requests'
        }
      } catch (err) {
        setStatus('error')
        setMessage(getErrorMessage(err, 'Microsoft girişi tamamlanamadı'))
      }
    }

    process()
  }, [searchParams])

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

export default function TeamsCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loading size="lg" />
        </div>
      }
    >
      <TeamsCallbackContent />
    </Suspense>
  )
}
