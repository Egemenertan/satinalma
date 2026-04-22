'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'

export default function PopupCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Giriş tamamlanıyor...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🖼️ Popup callback başlatılıyor...')
        console.log('🌐 URL:', window.location.href)

        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        if (error) {
          console.error('❌ OAuth error:', error, errorDescription)
          setStatus('error')
          setMessage(errorDescription || error)
          return
        }

        if (!code) {
          console.error('❌ Code bulunamadı')
          setStatus('error')
          setMessage('Authentication code bulunamadı')
          return
        }

        setMessage('Oturum oluşturuluyor...')

        const supabase = createClient()
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          console.error('❌ Code exchange error:', exchangeError)
          setStatus('error')
          setMessage(`Oturum oluşturulamadı: ${exchangeError.message}`)
          return
        }

        console.log('✅ Session oluşturuldu:', data.session?.user.id)

        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          setStatus('error')
          setMessage('Session alınamadı')
          return
        }

        const email = session.user.email || ''
        const allowedDomains = ['dovecgroup.com']
        const isAllowedDomain = allowedDomains.some(domain => email.endsWith(`@${domain}`))
        
        if (!isAllowedDomain) {
          console.error('❌ Yetkisiz domain:', email)
          await supabase.auth.signOut()
          setStatus('error')
          setMessage('Bu email adresi ile giriş yapılamaz. Sadece @dovecgroup.com email adresleri kullanılabilir.')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, email, full_name')
          .eq('id', session.user.id)
          .single()

        if (profileError && profileError.code === 'PGRST116') {
          console.log('📝 Yeni profil oluşturuluyor...')
          
          const DEFAULT_SITES = {
            MERKEZ_OFIS: '9cf48170-f37f-4fc2-91d8-fe65e5f5b921',
            COURTYARD: '18e8e316-1291-429d-a591-5cec97d235b7'
          }
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
              role: 'site_personnel',
              site_id: [DEFAULT_SITES.MERKEZ_OFIS, DEFAULT_SITES.COURTYARD],
              created_at: new Date().toISOString()
            })

          if (insertError) {
            console.error('❌ Profil oluşturulamadı:', insertError)
            setStatus('error')
            setMessage('Profil oluşturulamadı')
            return
          }

          console.log('✅ Profil oluşturuldu')
        }

        if (profile?.role === 'user') {
          const DEFAULT_SITES = {
            MERKEZ_OFIS: '9cf48170-f37f-4fc2-91d8-fe65e5f5b921',
            COURTYARD: '18e8e316-1291-429d-a591-5cec97d235b7'
          }
          
          await supabase
            .from('profiles')
            .update({ 
              role: 'site_personnel',
              site_id: [DEFAULT_SITES.MERKEZ_OFIS, DEFAULT_SITES.COURTYARD]
            })
            .eq('id', session.user.id)
        }

        setStatus('success')
        setMessage('Giriş başarılı! Bu pencere kapanacak...')
        
        console.log('✅ Popup auth tamamlandı, pencere kapatılıyor...')
        
        setTimeout(() => {
          window.close()
        }, 1500)

      } catch (error) {
        console.error('🔥 Popup callback error:', error)
        setStatus('error')
        setMessage('Beklenmeyen bir hata oluştu')
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === 'loading' && (
          <>
            <Loading size="lg" text={message} />
            <p className="mt-4 text-gray-600">Lütfen bekleyin...</p>
          </>
        )}
        
        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Giriş Başarısız</h2>
            <p className="text-red-600">{message}</p>
            <button 
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Pencereyi Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
