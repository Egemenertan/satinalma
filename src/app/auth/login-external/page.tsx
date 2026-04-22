'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loading } from '@/components/ui/loading'
import { ensureProfile, getRedirectPath } from '@/lib/auth'
import { CheckCircle } from 'lucide-react'

export default function LoginExternalPage() {
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'success'>('loading')
  const supabase = createClient()

  useEffect(() => {
    const startLogin = async () => {
      // Önce mevcut session var mı kontrol et
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        // Zaten login - profil oluştur ve başarılı mesaj göster
        await ensureProfile(
          supabase,
          session.user.id,
          session.user.email,
          session.user.user_metadata?.full_name
        )
        setStatus('success')
        return
      }

      // Login değil - Microsoft'a yönlendir
      setStatus('redirecting')
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email openid profile',
          redirectTo: `${window.location.origin}/auth/login-external`,
          queryParams: { prompt: 'select_account' },
        },
      })

      if (error) {
        console.error('OAuth error:', error)
      }
    }

    startLogin()
  }, [supabase])

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Giriş Başarılı!</h1>
          <p className="text-gray-600">
            Bu sekmeyi kapatabilir ve Outlook uygulamasına dönebilirsiniz.
          </p>
          <p className="text-sm text-gray-500">
            Outlook&apos;ta &quot;Giriş Yaptım, Kontrol Et&quot; butonuna tıklayın.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loading size="lg" text="Microsoft'a yönlendiriliyorsunuz..." />
    </div>
  )
}
