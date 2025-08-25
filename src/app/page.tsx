'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Package, Building2, Shield } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  useEffect(() => {
    // Eğer kullanıcı zaten giriş yapmışsa dashboard'a yönlendir
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/dashboard')
      }
    }
    checkAuth()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        // Kullanıcı profili var mı kontrol et
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (profileError || !profile) {
          // Profil yoksa oluştur
          const { error: createError } = await supabase
            .from('users')
            .insert([{
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Kullanıcı',
              role: 'engineer',
              password: 'auth_user',
              is_active: true,
              approval_limit: 0
            }])

          if (createError) {
            console.error('Profil oluşturma hatası:', createError)
          }
        }

        router.push(redirectTo)
        router.refresh()
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Giriş yapılırken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen  flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6 sm:space-y-10">
        {/* Logo ve Başlık */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-black to-gray-800 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-6 shadow-lg">
            <Package className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-normal text-black">
            SATIN ALMA SİSTEMİ
          </h2>
          <p className="mt-2 sm:mt-3 text-gray-600 text-sm sm:text-base lg:text-lg">
            Şantiye satın alma yönetim platformu
          </p>
        </div>
        
        <Card className="border border-gray-200/50 rounded-2xl sm:rounded-3xl shadow-xl shadow-black/5 bg-white/80 backdrop-blur-xl">
          <CardHeader className="space-y-2 pb-6 sm:pb-8 pt-6 sm:pt-8 px-4 sm:px-8">
            <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-normal text-center text-black">Giriş Yap</CardTitle>
            <CardDescription className="text-center text-gray-600 text-sm sm:text-base">
              Email ve şifrenizi girerek sisteme giriş yapın
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-8 pb-6 sm:pb-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="rounded-3xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-gray-900">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="h-10 sm:h-12 rounded-2xl sm:rounded-3xl border-gray-300 focus:border-black focus:ring-black text-sm sm:text-base"
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-gray-900">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 sm:h-12 rounded-2xl sm:rounded-3xl border-gray-300 focus:border-black focus:ring-black text-sm sm:text-base"
                  required
                  disabled={loading}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-10 sm:h-12 text-sm sm:text-base font-semibold bg-black hover:bg-black/90 rounded-2xl sm:rounded-3xl" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </form>
            
            <div className="mt-8 text-center space-y-6">
              <p className="text-sm text-gray-600">
                Hesabınız yok mu?{' '}
                <Link href="/auth/signup" className="text-black hover:text-gray-700 font-semibold underline">
                  Kayıt olun
                </Link>
              </p>
              
              <div className="border-t border-gray-200 pt-6">
                <p className="text-sm font-semibold text-gray-900 mb-4">
                  Demo Hesaplar:
                </p>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 bg-gray-50 rounded-2xl sm:rounded-3xl gap-1 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-black flex-shrink-0" />
                      <span className="font-medium text-gray-900">Şantiye Sorumlusu</span>
                    </div>
                    <span className="text-gray-600 text-xs sm:text-sm ml-5 sm:ml-0">demo@engineer.com</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 bg-gray-50 rounded-2xl sm:rounded-3xl gap-1 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Package className="w-3 h-3 sm:w-4 sm:h-4 text-black flex-shrink-0" />
                      <span className="font-medium text-gray-900">Satın Alma Uzmanı</span>
                    </div>
                    <span className="text-gray-600 text-xs sm:text-sm ml-5 sm:ml-0">demo@procurement.com</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 bg-gray-50 rounded-2xl sm:rounded-3xl gap-1 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-black flex-shrink-0" />
                      <span className="font-medium text-gray-900">Yönetici</span>
                    </div>
                    <span className="text-gray-600 text-xs sm:text-sm ml-5 sm:ml-0">demo@manager.com</span>
                  </div>
                  <p className="text-gray-500 mt-2 sm:mt-3 text-xs sm:text-sm">Şifre: <span className="font-mono font-semibold">123456</span></p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Loading component for Suspense fallback
function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
