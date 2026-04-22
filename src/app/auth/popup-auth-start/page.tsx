'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'

export default function PopupAuthStartPage() {
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const startAuth = async () => {
      try {
        console.log('🖼️ Popup auth başlatılıyor...')
        
        const redirectUrl = `${window.location.origin}/auth/popup-callback`
        console.log('🔗 Redirect URL:', redirectUrl)
        
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
            scopes: 'email openid profile',
            redirectTo: redirectUrl,
            queryParams: {
              prompt: 'select_account'
            }
          }
        })

        if (error) {
          console.error('❌ OAuth başlatma hatası:', error)
          setError(error.message)
        }
      } catch (err) {
        console.error('🔥 Popup auth start error:', err)
        setError('Authentication başlatılamadı')
      }
    }

    startAuth()
  }, [supabase])

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
