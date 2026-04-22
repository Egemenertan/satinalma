'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createEmbeddedAuthClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { initializeTeams, teamsNotifyAuthFailure } from '@/lib/teams'
import { getErrorMessage } from '@/lib/auth'

const HANDOFF_QUERY_KEY = 'handoff_id'

/**
 * Teams/Outlook popup auth giriş sayfası.
 *
 * Bu sayfa `authentication.authenticate({ url: '/auth/teams-auth-start?handoff_id=...' })`
 * ile açılan popup içinde çalışır. Görevi:
 *
 * 1. URL'den `handoff_id`'yi okur (parent iframe tarafından üretilen secret).
 * 2. Teams SDK'yı başlatır.
 * 3. Supabase Azure OAuth akışını başlatır; redirectTo'yu
 *    `/auth/teams-callback?handoff_id=...` olarak ayarlar — handoff_id
 *    callback'e taşınır ve oradan token transit kanalı için kullanılır.
 *
 * Hata durumunda parent window'a `notifyFailure` ile haber verir.
 */
function TeamsAuthStartContent() {
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    let cancelled = false

    const startAuth = async () => {
      try {
        await initializeTeams()

        if (cancelled) return

        const handoffId = searchParams.get(HANDOFF_QUERY_KEY) ?? ''

        // Embedded ortam için implicit flow kullanan ayrı bir client.
        // PKCE'nin code_verifier cookie'si Teams popup partition'ında
        // kaybolabildiği için implicit'e düşüyoruz.
        const supabase = createEmbeddedAuthClient()

        const callbackUrl = new URL('/auth/teams-callback', window.location.origin)
        if (handoffId) {
          callbackUrl.searchParams.set(HANDOFF_QUERY_KEY, handoffId)
        }

        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
            scopes: 'email openid profile',
            redirectTo: callbackUrl.toString(),
            queryParams: {
              prompt: 'select_account',
            },
          },
        })

        if (oauthError) {
          throw oauthError
        }
        // Başarılıysa Supabase tarayıcıyı zaten Microsoft'a yönlendiriyor
      } catch (err) {
        const message = getErrorMessage(err, 'Microsoft girişi başlatılamadı')
        setError(message)
        try {
          teamsNotifyAuthFailure(message)
        } catch {
          /* SDK init olmadıysa sessizce geç */
        }
      }
    }

    startAuth()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Hata Oluştu</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <Loading size="lg" text="Microsoft'a yönlendiriliyorsunuz..." />
        <p className="mt-4 text-gray-600">Lütfen bekleyin...</p>
      </div>
    </div>
  )
}

export default function TeamsAuthStartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loading size="lg" />
        </div>
      }
    >
      <TeamsAuthStartContent />
    </Suspense>
  )
}
