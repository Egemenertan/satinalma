'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loading, InlineLoading } from '@/components/ui/loading'
import { useTeams, teamsAuthenticate, initializeTeams } from '@/lib/teams'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingApproval, setPendingApproval] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const { isInTeams, isLoading: teamsLoading } = useTeams()

  // Zaten giriş yapmış kullanıcıyı redirect et
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          console.log('✅ Kullanıcı zaten giriş yapmış, dashboard\'a yönlendiriliyor...')
          window.location.href = '/dashboard/requests'
        }
      } catch (error) {
        console.error('Session kontrolü hatası:', error)
      }
    }
    
    checkExistingSession()
  }, [supabase])

  // URL parametrelerini kontrol et
  useEffect(() => {
    const urlError = searchParams.get('error')
    const approvalPending = searchParams.get('approval_pending')
    console.log('🔍 URL error parameter:', urlError)
    console.log('🔍 Approval pending:', approvalPending)
    
    if (approvalPending === 'true') {
      setPendingApproval(true)
      return
    }
    
    if (urlError === 'access_denied') {
      setPendingApproval(true)
    } else if (urlError === 'no_session') {
      setError('Microsoft girişi başarısız oldu. Lütfen tekrar deneyin.')
    } else if (urlError === 'session_error') {
      setError('Oturum hatası. Lütfen tekrar giriş yapın.')
    } else if (urlError === 'profile_error') {
      setError('Profil bilgileri alınamadı. Lütfen sistem yöneticisine başvurun.')
    } else if (urlError === 'callback_failed') {
      setError('Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.')
    } else if (urlError === 'profile_creation_failed') {
      setError('Profil oluşturulamadı. Lütfen sistem yöneticisine başvurun.')
    } else if (urlError === 'unauthorized_domain') {
      setError('Bu email adresi ile giriş yapılamaz. Sadece @dovecgroup.com email adresleri kullanılabilir.')
    } else if (urlError === 'code_exchange_failed') {
      setError('Microsoft oturum doğrulaması başarısız oldu. Lütfen tekrar deneyin.')
    } else if (urlError === 'profile_merge_failed') {
      setError('Hesap birleştirme hatası. Lütfen sistem yöneticisine başvurun.')
    } else if (urlError === 'role_update_failed') {
      setError('Rol güncelleme hatası. Lütfen sistem yöneticisine başvurun.')
    } else if (urlError) {
      setError(`Giriş hatası: ${urlError}`)
    }
  }, [searchParams])

  const handleTeamsLogin = async () => {
    setLoading(true)
    setError('')

    try {
      console.log('🔷 Teams popup authentication başlatılıyor...')
      
      await initializeTeams()
      
      const authUrl = new URL(`${window.location.origin}/auth/teams-auth-start`)
      
      console.log('🔗 Teams Auth URL:', authUrl.toString())
      
      await teamsAuthenticate(authUrl.toString(), 600, 600)
      
      console.log('✅ Teams auth popup tamamlandı, session kontrol ediliyor...')
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        console.log('✅ Session bulundu, dashboard\'a yönlendiriliyor...')
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (profile?.role === 'site_manager' || profile?.role === 'site_personnel' || 
            profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_yonetici') {
          window.location.href = '/dashboard/requests'
        } else {
          window.location.href = '/dashboard'
        }
      } else {
        setError('Oturum oluşturulamadı. Lütfen tekrar deneyin.')
        setLoading(false)
      }
    } catch (err) {
      console.error('🔥 Teams login error:', err)
      setError('Teams ile giriş yapılırken bir hata oluştu')
      setLoading(false)
    }
  }

  const handleMicrosoftLogin = async () => {
    if (isInTeams) {
      return handleTeamsLogin()
    }

    setLoading(true)
    setError('')

    try {
      console.log('🔐 Microsoft login başlatılıyor...')
      console.log('🌐 Current origin:', window.location.origin)
      console.log('📍 Teams ortamında mı:', isInTeams)
      
      const redirectUrl = `${window.location.origin}/auth/callback`
      console.log('🔗 Redirect URL:', redirectUrl)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
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
        console.error('❌ Microsoft login error:', error)
        setError('Microsoft ile giriş yapılırken hata oluştu: ' + error.message)
        setLoading(false)
      }
    } catch (err) {
      console.error('🔥 Microsoft login error:', err)
      setError('Microsoft ile giriş yapılırken bir hata oluştu')
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('🔐 Login attempt started...')
      console.log('📍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
      
      // Supabase ile giriş yap
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Login error:', error)
        // Network hatalarını daha açıklayıcı göster
        if (error.message.includes('fetch')) {
          setError('Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin veya birkaç saniye sonra tekrar deneyin.')
        } else if (error.message.includes('Invalid login credentials')) {
          setError('Email veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.')
        } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          setError('Çok fazla deneme yapıldı. Lütfen 5 dakika bekleyip tekrar deneyin veya farklı bir tarayıcı kullanın.')
        } else {
          setError(error.message)
        }
        return
      }

      if (data.user) {
        console.log('✅ Login successful for user:', data.user.id)
        
        // Kullanıcının profilini kontrol et
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        console.log('🔍 Profile check:', { role: profile?.role, error: profileError })

        if (profileError) {
          console.error('❌ Profile fetch error:', profileError)
          setError('Kullanıcı profili yüklenirken hata oluştu.')
          return
        }

        if (profile) {
          // User rolü dashboard'a erişemez
          if (profile.role === 'user') {
            console.log('❌ User role detected, pending admin approval')
            // Oturumu kapat ve kullanıcıya friendly mesaj göster
            await supabase.auth.signOut()
            setPendingApproval(true)
            return
          }
          
          console.log('🚀 Redirecting based on role...')
          // Rol bazlı yönlendirme
          if (profile.role === 'site_manager' || profile.role === 'site_personnel' || profile.role === 'santiye_depo' || profile.role === 'santiye_depo_yonetici') {
            window.location.href = '/dashboard/requests'
          } else {
            window.location.href = '/dashboard'
          }
        } else {
          console.log('❌ Profile not found')
          setError('Kullanıcı profili bulunamadı.')
        }
      }
    } catch (err) {
      console.error('🔥 Unexpected error during login:', err)
      // Catch bloğunda daha detaylı hata mesajı
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin veya VPN kullanıyorsanız kapatmayı deneyin.')
      } else {
        setError(`Giriş yapılırken bir hata oluştu: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative grid lg:grid-cols-2 gap-0 bg-white">
      {/* Sol Taraf - Giriş Formu */}
      <div className="relative z-10 flex items-center justify-center px-8 sm:px-12 lg:px-16 xl:px-24 py-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Logo ve Başlık */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img 
                src="/d.png" 
                alt="Dovec Logo" 
                className="h-12 w-auto invert"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hoş Geldiniz</h1>
            <p className="text-gray-600 mt-3 text-lg">
              Microsoft hesabınız ile devam edin
            </p>
          </div>
          
          {/* Form - Border'sız, sade */}
          <div className="space-y-6">
            {pendingApproval && (
              <Alert className="border-0 bg-blue-50">
                <AlertDescription className="text-sm text-blue-900">
                  <div className="space-y-2">
                    <p className="font-semibold">Giriş Başarılı!</p>
                    <p>Hesabınız oluşturuldu ancak dashboard'a erişebilmek için sistem yöneticisinin onayı bekleniyor.</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert variant="destructive" className="border-0 bg-red-50">
                <AlertDescription className="text-sm text-red-900">{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Teams Environment Indicator */}
            {!teamsLoading && isInTeams && (
              <div className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 rounded-xl border border-purple-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z" fill="#5059C9"/>
                  <path d="M17 13H13V17H11V13H7V11H11V7H13V11H17V13Z" fill="white"/>
                </svg>
                <span className="text-sm font-medium text-purple-700">Microsoft Teams Ortamı</span>
              </div>
            )}
            
            {/* Microsoft Login Button */}
            <Button
              type="button"
              onClick={handleMicrosoftLogin}
              className="w-full h-14 text-base font-semibold bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-3 transition-all duration-200"
              disabled={loading || teamsLoading}
            >
              {loading ? (
                <>
                  <InlineLoading className="mr-2" />
                  {isInTeams ? 'Teams ile giriş yapılıyor...' : 'Giriş yapılıyor...'}
                </>
              ) : teamsLoading ? (
                <>
                  <InlineLoading className="mr-2" />
                  Ortam kontrol ediliyor...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0h10.93v10.93H0V0z" fill="#F25022"/>
                    <path d="M12.07 0H23v10.93H12.07V0z" fill="#7FBA00"/>
                    <path d="M0 12.07h10.93V23H0V12.07z" fill="#00A4EF"/>
                    <path d="M12.07 12.07H23V23H12.07V12.07z" fill="#FFB900"/>
                  </svg>
                  Microsoft ile Giriş Yap
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sağ Taraf - Görsel Alan (Ada gibi) */}
      <div className="hidden lg:flex items-center justify-center p-8">
        <div className="relative w-full h-full max-h-[calc(100vh-4rem)] rounded-3xl overflow-hidden">
          <img 
            src="/dovec.webp" 
            alt="Dovec Group" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loading size="lg" text="Yükleniyor..." />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}