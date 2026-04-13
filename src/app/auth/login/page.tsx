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

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

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
    console.log('🔍 URL error parameter:', urlError)
    
    if (urlError === 'access_denied') {
      setError('Bu hesap dashboard\'a erişim yetkisine sahip değil. Lütfen sistem yöneticisine başvurun.')
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

  const handleMicrosoftLogin = async () => {
    setLoading(true)
    setError('')

    try {
      console.log('🔐 Microsoft login başlatılıyor...')
      console.log('🌐 Current origin:', window.location.origin)
      
      // Redirect URL'i açıkça belirt
      const redirectUrl = `${window.location.origin}/auth/callback`
      console.log('🔗 Redirect URL:', redirectUrl)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email openid profile',
          redirectTo: redirectUrl,
          queryParams: {
            prompt: 'select_account' // Her seferinde hesap seçimi iste
          }
        }
      })

      if (error) {
        console.error('❌ Microsoft login error:', error)
        setError('Microsoft ile giriş yapılırken hata oluştu: ' + error.message)
        setLoading(false)
      }
      // OAuth redirect olacak, loading state devam eder
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
            console.log('❌ User role detected, denying access')
            setError('Bu hesap dashboard\'a erişim yetkisine sahip değil. Lütfen sistem yöneticisine başvurun.')
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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Hoş Geldiniz</h1>
            <p className="text-gray-600 mt-3 text-lg">
              Devam etmek için giriş yapın
            </p>
          </div>
          
          {/* Form - Border'sız, sade */}
          <div className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-0 bg-red-50">
                  <AlertDescription className="text-sm text-red-900">{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@dovecgroup.com"
                  className="h-12 border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-gray-900 rounded-xl"
                  required
                  disabled={loading}
                />
              </div>
              
              {/* Şifre */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Şifre
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-gray-900 rounded-xl"
                  required
                  disabled={loading}
                />
              </div>
              
              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-black hover:bg-gray-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <InlineLoading className="mr-2" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </form>
            
            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">veya</span>
              </div>
            </div>
            
            {/* Microsoft Login Button */}
            <Button
              type="button"
              onClick={handleMicrosoftLogin}
              className="w-full h-12 text-base font-semibold bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm hover:shadow-md rounded-xl flex items-center justify-center gap-3 transition-all duration-200"
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0h10.93v10.93H0V0z" fill="#F25022"/>
                <path d="M12.07 0H23v10.93H12.07V0z" fill="#7FBA00"/>
                <path d="M0 12.07h10.93V23H0V12.07z" fill="#00A4EF"/>
                <path d="M12.07 12.07H23V23H12.07V12.07z" fill="#FFB900"/>
              </svg>
              Microsoft ile Giriş Yap
            </Button>
            
            {/* Signup Link */}
            <div className="pt-6 text-center">
              <p className="text-sm text-gray-600">
                Hesabınız yok mu?{' '}
                <Link 
                  href="/auth/signup" 
                  className="text-gray-900 hover:text-gray-700 font-semibold underline"
                >
                  Kayıt olun
                </Link>
              </p>
            </div>
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