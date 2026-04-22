'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Loading, InlineLoading } from '@/components/ui/loading'
import { useTeams, teamsAuthenticate, initializeTeams } from '@/lib/teams'
import { getPostLoginRedirectPath } from '@/lib/auth'

/**
 * URL'deki error parametrelerini kullanıcı dostu mesajlara çevirir.
 */
function getErrorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null

  const ERROR_MESSAGES: Record<string, string> = {
    no_session: 'Microsoft girişi tamamlanamadı. Lütfen tekrar deneyin.',
    session_error: 'Oturum hatası oluştu. Lütfen tekrar giriş yapın.',
    callback_failed: 'Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.',
    code_exchange_failed: 'Microsoft oturum doğrulaması başarısız oldu. Tarayıcı çerezlerini temizleyip tekrar deneyin.',
    profile_error: 'Profil bilgileri alınamadı. Lütfen sistem yöneticisine başvurun.',
  }

  return ERROR_MESSAGES[errorCode] ?? `Giriş hatası: ${errorCode}`
}

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()

  const { isInTeams, isLoading: teamsLoading } = useTeams()

  // Zaten giriş yapmış kullanıcıyı yönlendir
  useEffect(() => {
    let cancelled = false
    
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled || !session) return

        // Profil rolünü al
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()

        if (cancelled) return

        const role = profile?.role as any
        const redirectPath = getPostLoginRedirectPath(role)
        window.location.href = redirectPath
      } catch (err) {
        console.error('Session kontrolü hatası:', err)
      }
    }

    checkExistingSession()
    return () => { cancelled = true }
  }, [supabase])

  // URL'deki hata parametresini değerlendir
  useEffect(() => {
    const errorCode = searchParams.get('error')
    const errorMessage = getErrorMessage(errorCode)
    if (errorMessage) {
      setError(errorMessage)
    }
  }, [searchParams])

  const handleTeamsLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      await initializeTeams()
      const authUrl = `${window.location.origin}/auth/teams-auth-start`
      await teamsAuthenticate(authUrl, 600, 600)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Oturum oluşturulamadı. Lütfen tekrar deneyin.')
        setLoading(false)
        return
      }

      // Profil rolünü al ve yönlendir
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      const role = profile?.role as any
      window.location.href = getPostLoginRedirectPath(role)
    } catch (err) {
      console.error('🔥 Teams login hatası:', err)
      setError('Teams ile giriş yapılırken bir hata oluştu.')
      setLoading(false)
    }
  }

  const handleMicrosoftLogin = async () => {
    if (isInTeams) {
      return handleTeamsLogin()
    }

    setLoading(true)
    setError(null)

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email openid profile',
          redirectTo: redirectUrl,
          queryParams: { prompt: 'select_account' },
        },
      })

      if (oauthError) {
        console.error('❌ Microsoft login hatası:', oauthError)
        setError(`Microsoft ile giriş yapılırken hata oluştu: ${oauthError.message}`)
        setLoading(false)
      }
    } catch (err) {
      console.error('🔥 Microsoft login hatası:', err)
      setError('Microsoft ile giriş yapılırken bir hata oluştu.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative grid lg:grid-cols-2 gap-0 bg-white">
      {/* Sol Taraf - Giriş Formu */}
      <div className="relative z-10 flex items-center justify-center px-8 sm:px-12 lg:px-16 xl:px-24 py-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Logo ve Başlık */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img
                src="/d.png"
                alt="Dovec Logo"
                className="h-12 w-auto invert"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hoş Geldiniz</h1>
            <p className="text-gray-600 mt-3 text-lg">
              Microsoft hesabınız ile devam edin
            </p>
          </div>

          {/* Form Alanı */}
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-0 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm text-red-900">{error}</AlertDescription>
              </Alert>
            )}

            {/* Teams Ortamı Göstergesi */}
            {!teamsLoading && isInTeams && (
              <div className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 rounded-xl border border-purple-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z" fill="#5059C9" />
                  <path d="M17 13H13V17H11V13H7V11H11V7H13V11H17V13Z" fill="white" />
                </svg>
                <span className="text-sm font-medium text-purple-700">Microsoft Teams Ortamı</span>
              </div>
            )}

            {/* Microsoft Login Butonu */}
            <Button
              type="button"
              onClick={handleMicrosoftLogin}
              className="w-full h-14 text-base font-semibold bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-3 transition-all duration-200"
              disabled={loading || teamsLoading}
            >
              {loading ? (
                <>
                  <InlineLoading className="mr-2" />
                  {isInTeams ? 'Teams ile giriş yapılıyor...' : 'Giriş yapılıyor...'}
                </>
              ) : teamsLoading ? (
                <>
                  <InlineLoading className="mr-2" />
                  Ortam kontrol ediliyor...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h10.93v10.93H0V0z" fill="#F25022" />
                    <path d="M12.07 0H23v10.93H12.07V0z" fill="#7FBA00" />
                    <path d="M0 12.07h10.93V23H0V12.07z" fill="#00A4EF" />
                    <path d="M12.07 12.07H23V23H12.07V12.07z" fill="#FFB900" />
                  </svg>
                  Microsoft ile Giriş Yap
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sağ Taraf - Görsel Alan */}
      <div className="hidden lg:flex items-center justify-center p-8">
        <div className="relative w-full h-full max-h-[calc(100vh-4rem)] rounded-3xl overflow-hidden">
          <img
            src="/dovec.webp"
            alt="Dovec Group"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loading size="lg" text="Yükleniyor..." />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
