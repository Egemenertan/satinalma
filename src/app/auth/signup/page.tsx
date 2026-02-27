'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Supabase Auth'da kullanıcı oluştur
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: 'user'
          }
        }
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        setSuccess(true)
        // 2 saniye sonra login sayfasına git
        setTimeout(() => {
          router.push('/auth/login?message=Kayıt başarılı, şimdi giriş yapabilirsiniz')
        }, 2000)
      }
    } catch (err) {
      setError('Kayıt olurken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  // Başarı sayfası
  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-3xl shadow-sm p-12">
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Kayıt Başarılı! 🎉
              </h1>
              <p className="text-gray-600">
                Hesabınız başarıyla oluşturuldu.<br />
                Giriş sayfasına yönlendiriliyorsunuz...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Ana form
  return (
    <div className="min-h-screen relative grid lg:grid-cols-2 gap-0">
      {/* Mobil Arka Plan Görseli */}
      <div className="fixed inset-0 lg:hidden">
        <img 
          src="/dovec.webp" 
          alt="Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70"></div>
      </div>

      {/* Sol Taraf - Kayıt Formu */}
      <div className="relative z-10 flex items-center justify-center px-8 sm:px-12 lg:px-16 xl:px-24 py-12 lg:bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Başlık */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white lg:text-gray-900 tracking-tight">Kayıt Ol</h1>
            <p className="text-gray-200 lg:text-gray-600 mt-3 text-lg">
              Sisteme kayıt olmak için bilgilerinizi girin
            </p>
          </div>
          
          {/* Form - Border'sız, sade */}
          <div className="space-y-6">
            <form onSubmit={handleSignup} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-0 bg-red-50 lg:bg-red-50 bg-red-900/90 backdrop-blur-sm">
                  <AlertDescription className="text-sm text-white lg:text-red-900">{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Ad Soyad */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-white lg:text-gray-700">
                  Ad Soyad
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmet Demir"
                  className="h-12 border border-white/30 lg:border-gray-200 bg-white/95 lg:bg-white backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-white lg:focus:ring-gray-900 rounded-xl"
                  required
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white lg:text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@dovecgroup.com"
                  className="h-12 border border-white/30 lg:border-gray-200 bg-white/95 lg:bg-white backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-white lg:focus:ring-gray-900 rounded-xl"
                  required
                  disabled={loading}
                />
              </div>
              
              {/* Şifre */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-white lg:text-gray-700">
                  Şifre
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border border-white/30 lg:border-gray-200 bg-white/95 lg:bg-white backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-white lg:focus:ring-gray-900 rounded-xl"
                  required
                  disabled={loading}
                  minLength={6}
                />
                <p className="text-xs text-white/80 lg:text-gray-500">En az 6 karakter olmalıdır</p>
              </div>
              
              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-white lg:bg-gray-900 hover:bg-white/90 lg:hover:bg-gray-800 text-gray-900 lg:text-white border border-gray-900 lg:border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Hesap oluşturuluyor...
                  </>
                ) : (
                  'Hesap Oluştur'
                )}
              </Button>
            </form>
            
            {/* Login Link */}
            <div className="pt-6 text-center">
              <p className="text-sm text-white lg:text-gray-600">
                Zaten hesabınız var mı?{' '}
                <Link 
                  href="/auth/login" 
                  className="text-white lg:text-gray-900 hover:text-white/80 lg:hover:text-gray-700 font-semibold"
                >
                  Giriş yapın
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