'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Loading, InlineLoading } from '@/components/ui/loading'
import { ensureProfile, getRedirectPath, getErrorMessage, translateAuthError } from '@/lib/auth'
import {
  initializeTeams,
  isInIframe,
  teamsAuthenticate,
  type TeamsAuthTokenPayload,
} from '@/lib/teams'

const TEAMS_AUTH_START_PATH = '/auth/teams-auth-start'
const BROWSER_OAUTH_CALLBACK_PATH = '/auth/callback'

/**
 * Login sayfası — Microsoft (Azure AD) tabanlı tek giriş akışı.
 *
 * İki mod desteklenir:
 *
 * 1. **Normal tarayıcı**: Standart Supabase OAuth redirect akışı.
 * 2. **Teams / Outlook iframe**: Teams SDK popup'ı açılır
 *    (`teamsAuthenticate`) — popup OAuth tamamlanınca access/refresh
 *    token'ları parent iframe'e geri döner ve `setSession` ile session
 *    iframe'de aktive edilir. Cookie partitioning sorunu yaşanmaz.
 */
function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [checking, setChecking] = useState(true)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  /**
   * Mount: Embedded ortam tespiti + var olan session kontrolü.
   * Session varsa direkt yönlendir.
   */
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const embedded = isInIframe()

      if (!cancelled) setIsEmbedded(embedded)

      if (embedded) {
        if (!cancelled) setStatus('Microsoft entegrasyonu hazırlanıyor...')
        // Sessiz fail — Teams ortamında değilsek timeout ile false döner
        await initializeTeams()
      }

      if (cancelled) return

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()

        window.location.href = getRedirectPath(profile?.role)
        return
      }

      if (!cancelled) {
        setStatus('')
        setChecking(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [supabase])

  /**
   * URL'deki ?error=... parametresini insancıl mesaja çevir.
   */
  useEffect(() => {
    const code = searchParams.get('error')
    if (code) {
      setError(translateAuthError(code))
    }
  }, [searchParams])

  /**
   * Embedded (Teams/Outlook) modu için popup auth.
   * Popup'tan dönen token JSON'u ile setSession çağrılır.
   */
  const loginWithTeamsPopup = useCallback(async () => {
    setStatus('Microsoft hesabınızla doğrulanıyor...')

    const popupUrl = `${window.location.origin}${TEAMS_AUTH_START_PATH}`

    let resultRaw: string
    try {
      resultRaw = await teamsAuthenticate(popupUrl, 600, 700)
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Microsoft girişi iptal edildi'))
    }

    setStatus('Oturum oluşturuluyor...')

    let payload: TeamsAuthTokenPayload
    try {
      payload = JSON.parse(resultRaw) as TeamsAuthTokenPayload
    } catch {
      throw new Error('Microsoft girişinden geçersiz yanıt alındı')
    }

    if (!payload?.access_token || !payload?.refresh_token) {
      throw new Error('Oturum bilgileri alınamadı')
    }

    const { data, error: setSessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    })

    if (setSessionError || !data.session?.user) {
      throw new Error(getErrorMessage(setSessionError, 'Oturum başlatılamadı'))
    }

    const role = await ensureProfile(
      supabase,
      data.session.user.id,
      data.session.user.email,
      data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name
    )

    setStatus('Yönlendiriliyorsunuz...')
    window.location.href = getRedirectPath(role)
  }, [supabase])

  /**
   * Standart tarayıcı modu için OAuth redirect.
   */
  const loginWithBrowserRedirect = useCallback(async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email openid profile',
        redirectTo: `${window.location.origin}${BROWSER_OAUTH_CALLBACK_PATH}`,
        queryParams: { prompt: 'select_account' },
      },
    })

    if (oauthError) {
      throw oauthError
    }
    // Başarılı: tarayıcı zaten Microsoft'a yönlendiriliyor
  }, [supabase])

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    setStatus('')

    try {
      if (isEmbedded) {
        await loginWithTeamsPopup()
      } else {
        await loginWithBrowserRedirect()
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Giriş yapılırken bir hata oluştu')
      console.error('Login hatası:', err)
      setError(message)
      setLoading(false)
      setStatus('')
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loading size="lg" text={status || 'Kontrol ediliyor...'} />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative grid lg:grid-cols-2 gap-0 bg-white">
      <div className="relative z-10 flex items-center justify-center px-8 sm:px-12 lg:px-16 xl:px-24 py-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src="/d.png" alt="Logo" className="h-12 w-auto invert" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Hoş Geldiniz</h1>
            <p className="text-gray-600 mt-3 text-lg">Microsoft hesabınız ile devam edin</p>
          </div>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-0 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {status && !error && (
              <div className="text-center text-gray-600 py-2">
                <InlineLoading className="mr-2" />
                {status}
              </div>
            )}

            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-14 text-base font-semibold bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              {loading && !status ? (
                <>
                  <InlineLoading className="mr-2" />
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                    <path d="M0 0h10.93v10.93H0V0z" fill="#F25022" />
                    <path d="M12.07 0H23v10.93H12.07V0z" fill="#7FBA00" />
                    <path d="M0 12.07h10.93V23H0V12.07z" fill="#00A4EF" />
                    <path d="M12.07 12.07H23V23H12.07V12.07z" fill="#FFB900" />
                  </svg>
                  Microsoft ile Giriş Yap
                </>
              )}
            </Button>

            {isEmbedded && (
              <p className="text-xs text-center text-gray-500 leading-relaxed">
                Giriş için küçük bir Microsoft penceresi açılacak. Tarayıcınız
                açılır pencereleri engelliyorsa lütfen bu site için izin verin.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center p-8">
        <div className="relative w-full h-full max-h-[calc(100vh-4rem)] rounded-3xl overflow-hidden">
          <img src="/dovec.webp" alt="Dovec Group" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loading size="lg" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
