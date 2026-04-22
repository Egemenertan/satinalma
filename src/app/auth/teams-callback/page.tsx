'use client'

import { useEffect, useState, useRef } from 'react'
import { app, authentication } from '@microsoft/teams-js'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile } from '@/lib/auth'

export default function TeamsCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Giriş yapılıyor...')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const process = async () => {
      try {
        await app.initialize()

        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')

        if (error) {
          setStatus('error')
          setMessage('Giriş başarısız: ' + error)
          authentication.notifyFailure(error)
          return
        }

        if (!code) {
          setStatus('error')
          setMessage('Kod bulunamadı')
          authentication.notifyFailure('no_code')
          return
        }

        const supabase = createClient()
        await supabase.auth.exchangeCodeForSession(code)

        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          setStatus('error')
          setMessage('Oturum oluşturulamadı')
          authentication.notifyFailure('no_session')
          return
        }

        await ensureProfile(supabase, session.user.id, session.user.email, session.user.user_metadata?.full_name)

        setStatus('success')
        setMessage('Giriş başarılı!')
        authentication.notifySuccess('success')
      } catch (err) {
        setStatus('error')
        setMessage('Beklenmeyen hata')
        try { authentication.notifyFailure('error') } catch {}
      }
    }

    process()
  }, [])

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
            <p className="text-xl font-semibold">{message}</p>
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
          </div>
        )}
      </div>
    </div>
  )
}
