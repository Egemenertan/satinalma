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
      // Supabase ile giriş yap
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        console.log('✅ Login successful for user:', data.user.id)
        
        // Kullanıcının profilini kontrol et
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()

        console.log('🔍 Profile check:', { profile: profile?.id, error: profileError })

        if (profile) {
          // User rolü dashboard'a erişemez
          if (profile.role === 'user') {
            console.log('❌ User role detected, denying access')
            setError('Bu hesap dashboard\'a erişim yetkisine sahip değil. Lütfen sistem yöneticisine başvurun.')
            return
          }
          
          console.log('🚀 Redirecting to dashboard...')
          // Başarılı - Dashboard'a git
          window.location.href = '/dashboard'
        } else {
          console.log('❌ Profile not found')
          setError('Kullanıcı profili bulunamadı.')
        }
      }
    } catch (err) {
      setError('Giriş yapılırken bir hata oluştu.')
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
        <div className="text-center">
          <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-light text-lg">Yükleniyor...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}