'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Loading, InlineLoading } from '@/components/ui/loading'
import { ensureProfile, getRedirectPath, getErrorMessage, translateAuthError } from '@/lib/auth'
import { isInIframe } from '@/lib/teams'

const CALLBACK_PATH = '/auth/callback'
const HANDOFF_QUERY_KEY = 'handoff_id'

const HANDOFF_POLL_INTERVAL_MS = 1000
const HANDOFF_POLL_TIMEOUT_MS = 4 * 60 * 1000

interface HandoffTokens {
  access_token: string
  refresh_token: string
  expires_at?: number
  user_email?: string
}

/**
 * Cryptographically secure UUID v4.
 */
function generateHandoffId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Login sayfası — Microsoft (Azure AD) OAuth.
 *
 * Üç durum:
 *
 * 1. **Standart tarayıcı** (top-level, handoff_id yok):
 *    Buton → standart Supabase PKCE OAuth redirect → /auth/callback.
 *
 * 2. **Embedded mod** (Teams/Outlook iframe içinde):
 *    Buton → yeni tarayıcı sekmesi açar (`window.open(_blank)`).
 *    Yeni sekme top-level olduğu için PKCE/cookie sorunsuz çalışır.
 *    Iframe paralel olarak `/api/auth/handoff/[id]` polling yapar;
 *    yeni sekmedeki callback token'ları POST eder, iframe alır,
 *    setSession ile session kurulur.
 *
 * 3. **Yeni sekme + handoff_id** (top-level, ?handoff_id=X):
 *    Bu sayfa otomatik OAuth başlatır. redirectTo `/auth/callback?handoff_id=X`
 *    olur — callback token'ları handoff'a POST eder ve sekmeyi kapatır.
 *
 * NOT: Hydration güvenliği için tüm window/iframe tespiti useEffect içinde
 * yapılır. SSR ve ilk client render aynı statik içeriği üretir.
 */
export default function LoginPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [checking, setChecking] = useState(true)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const supabase = createClient()
  const abortRef = useRef<AbortController | null>(null)

  /**
   * Server-side handoff endpoint'ini polling ile dinler.
   */
  const pollHandoff = useCallback(
    async (handoffId: string, signal: AbortSignal): Promise<HandoffTokens> => {
      const deadline = Date.now() + HANDOFF_POLL_TIMEOUT_MS

      while (!signal.aborted && Date.now() < deadline) {
        try {
          const res = await fetch(
            `/api/auth/handoff/${encodeURIComponent(handoffId)}`,
            { method: 'GET', credentials: 'omit', signal }
          )

          if (res.ok) {
            const data = await res.json()
            if (data?.tokens?.access_token && data?.tokens?.refresh_token) {
              return data.tokens as HandoffTokens
            }
          } else if (res.status === 410) {
            throw new Error('Giriş süresi doldu, lütfen tekrar deneyin')
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw err
        }

        await new Promise((resolve) => setTimeout(resolve, HANDOFF_POLL_INTERVAL_MS))
      }

      if (signal.aborted) {
        throw new Error('Giriş iptal edildi')
      }
      throw new Error('Microsoft girişi zaman aşımına uğradı. Lütfen yeni sekmede giriş yapıp tekrar deneyin.')
    },
    []
  )

  /**
   * Supabase Azure OAuth'u başlatır (PKCE).
   * handoff_id varsa callback URL'sine taşır.
   */
  const startBrowserOAuth = useCallback(
    async (handoffId?: string | null) => {
      const callbackUrl = new URL(CALLBACK_PATH, window.location.origin)
      if (handoffId) {
        callbackUrl.searchParams.set(HANDOFF_QUERY_KEY, handoffId)
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email openid profile',
          redirectTo: callbackUrl.toString(),
          queryParams: { prompt: 'select_account' },
        },
      })

      if (oauthError) {
        throw oauthError
      }
      // Başarılı: tarayıcı zaten Microsoft'a yönleniyor
    },
    [supabase]
  )

  /**
   * Iframe modu için handoff akışı.
   */
  const loginWithHandoff = useCallback(async () => {
    const handoffId = generateHandoffId()

    const newTabUrl = new URL('/auth/login', window.location.origin)
    newTabUrl.searchParams.set(HANDOFF_QUERY_KEY, handoffId)

    const newTab = window.open(newTabUrl.toString(), '_blank')
    if (!newTab) {
      throw new Error(
        'Yeni sekme açılamadı. Tarayıcınızdan bu site için açılır pencere/sekme iznini verin.'
      )
    }

    setStatus('Yeni sekmede Microsoft girişi bekleniyor...')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const tokens = await pollHandoff(handoffId, controller.signal)

    setStatus('Oturum oluşturuluyor...')

    const { data, error: setSessionError } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
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
  }, [supabase, pollHandoff])

  const handleLogin = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStatus('')

    try {
      if (isEmbedded) {
        await loginWithHandoff()
      } else {
        await startBrowserOAuth()
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Giriş yapılırken bir hata oluştu')
      console.error('Login hatası:', err)
      setError(message)
      setLoading(false)
      setStatus('')
    }
  }, [isEmbedded, loginWithHandoff, startBrowserOAuth])

  /**
   * Mount: ortam tespiti, session kontrolü, error param okuma,
   * top-level + handoff_id durumunda otomatik OAuth.
   */
  useEffect(() => {
    let cancelled = false
    setMounted(true)

    const init = async () => {
      const params = new URLSearchParams(window.location.search)

      const errCode = params.get('error')
      if (errCode && !cancelled) {
        setError(translateAuthError(errCode))
      }

      const embedded = isInIframe()
      const handoffId = params.get(HANDOFF_QUERY_KEY)

      // Mevcut session varsa direkt yönlendir
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

      if (cancelled) return

      // Yeni sekme + handoff_id: otomatik OAuth başlat
      if (!embedded && handoffId) {
        setChecking(false)
        setLoading(true)
        setStatus('Microsoft\'a yönlendiriliyorsunuz...')
        try {
          await startBrowserOAuth(handoffId)
        } catch (err) {
          if (!cancelled) {
            setError(getErrorMessage(err, 'Microsoft girişi başlatılamadı'))
            setLoading(false)
            setStatus('')
          }
        }
        return
      }

      if (!cancelled) {
        setIsEmbedded(embedded)
        setChecking(false)
      }
    }

    init()

    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [supabase, startBrowserOAuth])

  // Hydration güvenliği: server ve ilk client render hep aynı içerik
  if (!mounted || checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loading size="lg" text="Yükleniyor..." />
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
                Giriş için yeni bir tarayıcı sekmesi açılacak. Microsoft girişini
                tamamladıktan sonra bu ekran otomatik devam edecek.
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
