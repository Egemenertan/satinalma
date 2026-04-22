'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureUserProfile, getPostLoginRedirectPath } from '@/lib/auth'

/**
 * Microsoft OAuth Callback Sayfası
 * 
 * Single Tenant yapılandırması sayesinde sadece şirket çalışanları giriş yapabilir.
 * Tüm kullanıcılar otomatik olarak site_personnel rolü alır ve dashboard'a yönlendirilir.
 */
export default function AuthCallback() {
  const supabase = createClient()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const handleCallback = async () => {
      try {
        console.log('🔐 OAuth callback başlatıldı...')

        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const oauthError = params.get('error')
        const errorDescription = params.get('error_description')

        // OAuth hatası varsa
        if (oauthError) {
          console.error('❌ OAuth hatası:', oauthError, errorDescription)
          window.location.href = `/auth/login?error=${encodeURIComponent(oauthError)}`
          return
        }

        // Authorization code → session
        if (code) {
          console.log('🔄 Code exchange başlatılıyor...')
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            console.error('❌ Code exchange hatası:', exchangeError.message)
            // Hata olsa bile mevcut session'ı kontrol et - belki zaten login
          }
          
          // Cookie'lerin set edilmesi için kısa bekleme
          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        // Session kontrolü - code exchange başarısız olsa bile mevcut session olabilir
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session?.user) {
          console.error('❌ Session alınamadı:', sessionError?.message)
          window.location.href = '/auth/login?error=no_session'
          return
        }

        console.log('✅ Session alındı:', session.user.email)

        // Profil hazırla (otomatik site_personnel)
        const { role, isNewProfile, wasMerged } = await ensureUserProfile(supabase, session.user)

        console.log('👤 Profil hazır:', { role, isNewProfile, wasMerged })

        // Dashboard'a yönlendir
        const redirectPath = getPostLoginRedirectPath(role)
        console.log('🚀 Yönlendiriliyor:', redirectPath)
        window.location.href = redirectPath

      } catch (err) {
        console.error('🔥 Callback hatası:', err)
        window.location.href = '/auth/login?error=callback_failed'
      }
    }

    handleCallback()
  }, [supabase])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <Loading size="lg" text="Giriş yapılıyor..." />
        <p className="mt-4 text-gray-600">Microsoft hesabınız doğrulanıyor...</p>
      </div>
    </div>
  )
}
