'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { getErrorMessage } from '@/lib/auth'

const HANDOFF_QUERY_KEY = 'handoff_id'

/**
 * Teams/Outlook embedded handoff flow için OAuth başlangıç sayfası.
 *
 * Bu sayfa **yeni bir browser tab'da (top-level)** açılır — popup değil.
 * Top-level context'te cookie/PKCE state normal çalışır, COOP veya
 * storage partitioning sorunu yoktur.
 *
 * 1. URL'den `handoff_id`'yi okur (parent iframe tarafından üretilen secret).
 * 2. Standart Supabase Azure OAuth (PKCE) başlatır; redirectTo'yu
 *    `/auth/teams-callback?handoff_id=...` olarak ayarlar — handoff_id
 *    callback'e taşınır.
 */
function TeamsAuthStartContent() {
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    let cancelled = false

    const startAuth = async () => {
      try {
        const handoffId = searchParams.get(HANDOFF_QUERY_KEY) ?? ''
        if (!handoffId) {
          throw new Error('Geçersiz oturum başlatma isteği (handoff_id eksik)')
        }

        if (cancelled) return

        const supabase = createClient()

        const callbackUrl = new URL('/auth/teams-callback', window.location.origin)
        callbackUrl.searchParams.set(HANDOFF_QUERY_KEY, handoffId)

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
        // Başarılı: tarayıcı zaten Microsoft'a yönlendiriliyor
      } catch (err) {
        setError(getErrorMessage(err, 'Microsoft girişi başlatılamadı'))
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
