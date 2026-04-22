'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Loading, InlineLoading } from '@/components/ui/loading'
import { getRedirectPath } from '@/lib/auth'
import { isInIframe } from '@/lib/teams'

const ERROR_MESSAGES: Record<string, string> = {
  no_session: 'Giriş tamamlanamadı. Lütfen tekrar deneyin.',
  callback_failed: 'Giriş işlemi başarısız. Lütfen tekrar deneyin.',
  auth_failed: 'Kimlik doğrulama başarısız. Lütfen tekrar deneyin.',
}

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const [checking, setChecking] = useState(true)
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Ortam ve session kontrolü
  useEffect(() => {
    const check = async () => {
      // Embedded ortam kontrolü
      const embedded = isInIframe()
      setIsEmbedded(embedded)
      
      // Mevcut session kontrolü
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
      
      setChecking(false)
    }
    check()
  }, [supabase])

  // URL'deki hata parametresi
  useEffect(() => {
    const err = searchParams.get('error')
    if (err) {
      setError(ERROR_MESSAGES[err] || `Hata: ${err}`)
    }
  }, [searchParams])

  // Session'ı kontrol et (sayfa yenilendiğinde)
  const checkSession = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()

      window.location.href = getRedirectPath(profile?.role)
    } else {
      setError('Henüz giriş yapılmamış. Lütfen yeni sekmede giriş yapın.')
      setLoading(false)
    }
  }

  // Login - normal veya yeni sekmede
  const handleLogin = async () => {
    setLoading(true)
    setError(null)

    if (isEmbedded) {
      // Outlook/iframe içinde: Yeni sekmede aç
      const loginUrl = `${window.location.origin}/auth/login-external`
      window.open(loginUrl, '_blank')
      setLoading(false)
    } else {
      // Normal tarayıcı: Redirect
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
            scopes: 'email openid profile',
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: { prompt: 'select_account' },
          },
        })

        if (error) {
          setError(error.message)
          setLoading(false)
        }
      } catch (err) {
        setError('Giriş yapılırken bir hata oluştu.')
        setLoading(false)
      }
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loading size="lg" text="Kontrol ediliyor..." />
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

            {isEmbedded && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <ExternalLink className="w-4 h-4" />
                  <span className="font-medium">Outlook Ortamı</span>
                </div>
                <p className="text-sm text-blue-600">
                  Giriş yeni sekmede açılacak. Giriş yaptıktan sonra bu sayfayı yenileyin.
                </p>
              </div>
            )}

            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-14 text-base font-semibold bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <InlineLoading className="mr-2" />
                  {isEmbedded ? 'Yeni sekme açılıyor...' : 'Giriş yapılıyor...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                    <path d="M0 0h10.93v10.93H0V0z" fill="#F25022" />
                    <path d="M12.07 0H23v10.93H12.07V0z" fill="#7FBA00" />
                    <path d="M0 12.07h10.93V23H0V12.07z" fill="#00A4EF" />
                    <path d="M12.07 12.07H23V23H12.07V12.07z" fill="#FFB900" />
                  </svg>
                  {isEmbedded ? 'Yeni Sekmede Giriş Yap' : 'Microsoft ile Giriş Yap'}
                </>
              )}
            </Button>

            {isEmbedded && (
              <Button
                onClick={checkSession}
                disabled={loading}
                variant="outline"
                className="w-full h-12 text-base font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Giriş Yaptım, Kontrol Et
              </Button>
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
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><Loading size="lg" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
