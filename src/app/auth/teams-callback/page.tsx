'use client'

import { useEffect, useState, useRef } from 'react'
import { app, authentication } from '@microsoft/teams-js'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureUserProfile } from '@/lib/auth'

type Status = 'loading' | 'success' | 'error'

/**
 * Teams Authentication Popup Callback
 * 
 * Teams ortamındaki popup'ta auth flow'unu tamamlar.
 * Tüm kullanıcılar otomatik olarak site_personnel rolü alır.
 */
export default function TeamsCallbackPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Teams authentication işleniyor...')
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const handleTeamsCallback = async () => {
      try {
        await app.initialize()

        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const oauthError = params.get('error')
        const errorDescription = params.get('error_description')

        if (oauthError) {
          console.error('❌ OAuth hatası:', oauthError, errorDescription)
          setStatus('error')
          setMessage(`Giriş hatası: ${errorDescription || oauthError}`)
          authentication.notifyFailure(oauthError)
          return
        }

        if (!code) {
          setStatus('error')
          setMessage('Authentication code bulunamadı')
          authentication.notifyFailure('no_code')
          return
        }

        setMessage('Oturum doğrulanıyor...')

        const supabase = createClient()
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          console.error('❌ Code exchange hatası:', exchangeError)
          setStatus('error')
          setMessage(`Oturum oluşturulamadı: ${exchangeError.message}`)
          authentication.notifyFailure(exchangeError.message)
          return
        }

        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          setStatus('error')
          setMessage('Session alınamadı')
          authentication.notifyFailure('no_session')
          return
        }

        // Profil hazırla (otomatik site_personnel)
        await ensureUserProfile(supabase, session.user)

        setStatus('success')
        setMessage('Giriş başarılı! Yönlendiriliyorsunuz...')
        authentication.notifySuccess('success')
      } catch (err) {
        console.error('🔥 Teams callback hatası:', err)
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu')
        try {
          authentication.notifyFailure('unexpected_error')
        } catch {
          console.warn('Teams SDK kullanılamıyor')
        }
      }
    }

    handleTeamsCallback()
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === 'loading' && (
          <>
            <Loading size="lg" text={message} />
            <p className="mt-4 text-gray-600">Lütfen bekleyin...</p>
          </>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
            <p className="text-gray-600">Bu pencere otomatik olarak kapanacak.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Giriş Başarısız</h2>
            <p className="text-red-600">{message}</p>
            <p className="text-gray-600 text-sm">Bu pencereyi kapatıp tekrar deneyebilirsiniz.</p>
          </div>
        )}
      </div>
    </div>
  )
}
