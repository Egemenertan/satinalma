'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Loading, InlineLoading } from '@/components/ui/loading'
import { getRedirectPath } from '@/lib/auth'
import { initializeTeams, isInIframe, getTeamsSSOToken } from '@/lib/teams'

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [checking, setChecking] = useState(true)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      // Embedded ortam kontrolü
      const embedded = isInIframe()
      setIsEmbedded(embedded)
      
      if (embedded) {
        setStatus('Teams SDK başlatılıyor...')
        await initializeTeams()
      }
      
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
      
      setStatus('')
      setChecking(false)
    }
    init()
  }, [supabase])

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) {
      setError(err === 'no_session' ? 'Giriş tamamlanamadı. Lütfen tekrar deneyin.' : `Hata: ${err}`)
    }
  }, [searchParams])

  const handleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      if (isEmbedded) {
        // Outlook/Teams içinde: SSO ile giriş
        setStatus('Microsoft hesabınızla doğrulanıyor...')
        
        const teamsToken = await getTeamsSSOToken()
        
        setStatus('Oturum oluşturuluyor...')
        
        const response = await fetch('/api/auth/teams/sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamsToken })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Giriş başarısız')
        }

        if (data.actionLink) {
          // Magic link ile otomatik giriş
          setStatus('Yönlendiriliyorsunuz...')
          window.location.href = data.actionLink
        } else {
          throw new Error('Oturum bağlantısı alınamadı')
        }
      } else {
        // Normal tarayıcı: OAuth redirect
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
            scopes: 'email openid profile',
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: { prompt: 'select_account' },
          },
        })

        if (error) throw error
      }
    } catch (err) {
      console.error('Login hatası:', err)
      setError(err instanceof Error ? err.message : 'Giriş yapılırken bir hata oluştu')
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
