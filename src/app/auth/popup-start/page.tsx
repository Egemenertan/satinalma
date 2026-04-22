'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'

/**
 * Popup Auth Başlangıç Sayfası
 * 
 * Outlook/Teams gibi embedded ortamlarda popup pencerede açılır
 * ve Microsoft OAuth flow'unu başlatır.
 */
export default function PopupStartPage() {
  const supabase = createClient()

  useEffect(() => {
    const startAuth = async () => {
      try {
        // Popup callback URL'i
        const redirectUrl = `${window.location.origin}/auth/popup-callback`
        
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
            scopes: 'email openid profile',
            redirectTo: redirectUrl,
            queryParams: { prompt: 'select_account' },
          },
        })

        if (error) {
          console.error('OAuth başlatma hatası:', error)
          window.close()
        }
      } catch (err) {
        console.error('Popup auth hatası:', err)
        window.close()
      }
    }

    startAuth()
  }, [supabase])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loading size="lg" text="Microsoft'a yönlendiriliyorsunuz..." />
    </div>
  )
}
