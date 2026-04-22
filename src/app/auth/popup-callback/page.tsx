'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile } from '@/lib/auth'

/**
 * Popup Auth Callback Sayfası
 * 
 * Microsoft OAuth'tan döndükten sonra popup'ta açılır.
 * Session oluşturur, profili hazırlar ve pencereyi kapatır.
 */
export default function PopupCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Giriş tamamlanıyor...')
  const supabase = createClient()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const process = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')

        if (error) {
          setStatus('error')
          setMessage('Giriş başarısız')
          setTimeout(() => window.close(), 2000)
          return
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('Code exchange hatası:', exchangeError)
            setStatus('error')
            setMessage('Oturum oluşturulamadı')
            setTimeout(() => window.close(), 2000)
            return
          }
          // Cookie'lerin set edilmesi için daha uzun bekleme
          await new Promise(r => setTimeout(r, 1500))
        }

        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          setStatus('error')
          setMessage('Oturum oluşturulamadı')
          setTimeout(() => window.close(), 2000)
          return
        }

        // Profili hazırla
        await ensureProfile(
          supabase,
          session.user.id,
          session.user.email,
          session.user.user_metadata?.full_name
        )

        setStatus('success')
        setMessage('Giriş başarılı!')
        
        // Pencereyi kapat - ana sayfa session'ı algılayacak
        setTimeout(() => window.close(), 1000)
      } catch (err) {
        console.error('Popup callback hatası:', err)
        setStatus('error')
        setMessage('Bir hata oluştu')
        setTimeout(() => window.close(), 2000)
      }
    }

    process()
  }, [supabase])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        {status === 'loading' && <Loading size="lg" text={message} />}
        
        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-gray-900">{message}</p>
            <p className="text-gray-500">Bu pencere kapanıyor...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-red-600">{message}</p>
            <p className="text-gray-500">Bu pencere kapanıyor...</p>
          </div>
        )}
      </div>
    </div>
  )
}
