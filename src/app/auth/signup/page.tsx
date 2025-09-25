'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
            name,
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
          <Card className="border border-gray-200 rounded-3xl shadow-sm">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="mb-6">
                  <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-black mb-3">
                  Kayıt Başarılı! 🎉
                </h1>
                <p className="text-gray-600">
                  Hesabınız başarıyla oluşturuldu.<br />
                  Giriş sayfasına yönlendiriliyorsunuz...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Ana form
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
          <h1 className="text-3xl font-bold text-black">Kayıt Ol</h1>
          <p className="text-gray-600 mt-2">
            Sisteme kayıt olmak için bilgilerinizi girin
          </p>
        </div>
        
        <Card className="border border-gray-200 rounded-3xl shadow-sm">
          <CardContent className="p-8">
            <form onSubmit={handleSignup} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="rounded-2xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Ad Soyad */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-900">
                  Ad Soyad
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmet Demir"
                  className="h-12 rounded-2xl border-gray-300 focus:border-black focus:ring-black"
                  required
                  disabled={loading}
                />
              </div>

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
                  minLength={6}
                />
                <p className="text-xs text-gray-500">En az 6 karakter olmalıdır</p>
              </div>

              
              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full text-white h-12 text-base font-semibold bg-black hover:bg-black/90 rounded-2xl" 
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
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Zaten hesabınız var mı?{' '}
                <Link 
                  href="/auth/login" 
                  className="text-black hover:text-gray-700 font-semibold underline"
                >
                  Giriş yapın
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}