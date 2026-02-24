'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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

  // URL parametrelerini kontrol et
  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError === 'access_denied') {
      setError('Bu hesap dashboard\'a erişim yetkisine sahip değil. Lütfen sistem yöneticisine başvurun.')
    }
  }, [searchParams])

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
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <img 
            src="/d.png" 
            alt="Logo" 
            className="mx-auto w-24 h-24 object-contain filter brightness-0 mb-4"
          />
          <h1 className="text-3xl font-bold text-black">Giriş Yap</h1>
          <p className="text-gray-600 mt-2">
            Email ve şifrenizi girerek sisteme giriş yapın
          </p>
        </div>
        
        <Card className="border border-gray-200 rounded-3xl shadow-sm">
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="rounded-2xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-900">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="h-12 rounded-2xl border-gray-300 focus:border-black focus:ring-black"
                  required
                  disabled={loading}
                />
              </div>
              
              {/* Şifre */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-900">
                  Şifre
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl border-gray-300 focus:border-black focus:ring-black"
                  required
                  disabled={loading}
                />
              </div>
              
              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-12 text-base text-white font-semibold bg-black hover:bg-black/90 rounded-2xl" 
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
            
            {/* Signup Link */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Hesabınız yok mu?{' '}
                <Link 
                  href="/auth/signup" 
                  className="text-black hover:text-gray-700 font-semibold underline"
                >
                  Kayıt olun
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
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