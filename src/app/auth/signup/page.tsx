'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Package, UserPlus, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type UserRole = 'engineer' | 'site_supervisor' | 'procurement_specialist' | 'finance_manager' | 'project_manager' | 'general_manager'

function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('engineer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Supabase Auth'da kullanıcı oluştur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role
          }
        }
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (authData.user) {
        // 2. users tablosuna profil ekle
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            name,
            role,
            password: 'auth_user', // Auth kullanıcısı işareti
            is_active: true,
            approval_limit: role === 'general_manager' ? 100000 : 
                           role === 'project_manager' ? 20000 : 
                           role === 'finance_manager' ? 10000 : 0
          })

        if (profileError) {
          console.error('Profile creation error:', profileError)
        }

        setSuccess(true)
        setTimeout(() => {
          router.push('/auth/login?message=Kayıt başarılı, giriş yapabilirsiniz')
        }, 2000)
      }
    } catch (err) {
      console.error('Signup error:', err)
      setError('Kayıt olurken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full space-y-8">
          <Card className="border border-gray-200 rounded-3xl shadow-sm">
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <div className="mx-auto w-20 h-20 bg-black rounded-3xl flex items-center justify-center mb-6">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <div className="text-black text-2xl font-bold mb-3">
                  Kayıt Başarılı!
                </div>
                <p className="text-gray-600 text-base">
                  Hesabınız oluşturuldu. Giriş sayfasına yönlendiriliyorsunuz...
                </p>
                <div className="mt-6">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-black" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-10">
        {/* Logo ve Başlık */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-black rounded-3xl flex items-center justify-center mb-6">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-normal text-black">
            HESAP OLUŞTUR
          </h2>
          <p className="mt-3 text-gray-600 text-lg">
            Şantiye satın alma sistemi için kayıt olun
          </p>
        </div>
        
        <Card className="border border-gray-200 rounded-3xl shadow-sm">
          <CardHeader className="space-y-2 pb-8 pt-8">
            <CardTitle className="text-3xl font-normal text-center text-black">Kayıt Ol</CardTitle>
            <CardDescription className="text-center text-gray-600 text-base">
              Sisteme kayıt olmak için bilgilerinizi girin
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSignup} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="rounded-3xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-3">
                <Label htmlFor="name" className="text-sm font-semibold text-gray-900">Ad Soyad</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmet Demir"
                  className="h-12 rounded-3xl border-gray-300 focus:border-black focus:ring-black"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-900">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="h-12 rounded-3xl border-gray-300 focus:border-black focus:ring-black"
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-900">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-3xl border-gray-300 focus:border-black focus:ring-black"
                  required
                  disabled={loading}
                  minLength={6}
                />
                <p className="text-xs text-gray-500">En az 6 karakter olmalıdır</p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="role" className="text-sm font-semibold text-gray-900">Rol</Label>
                <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                  <SelectTrigger className="h-12 rounded-3xl border-gray-300 focus:border-black focus:ring-black">
                    <SelectValue placeholder="Rolünüzü seçin" />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl">
                    <SelectItem value="engineer">Şantiye Sorumlusu</SelectItem>
                    <SelectItem value="site_supervisor">Saha Süpervizörü</SelectItem>
                    <SelectItem value="procurement_specialist">Satın Alma Uzmanı</SelectItem>
                    <SelectItem value="finance_manager">Finans Yöneticisi</SelectItem>
                    <SelectItem value="project_manager">Proje Yöneticisi</SelectItem>
                    <SelectItem value="general_manager">Genel Müdür</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-black hover:bg-black/90 rounded-3xl" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kayıt oluşturuluyor...
                  </>
                ) : (
                  'Hesap Oluştur'
                )}
              </Button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Zaten hesabınız var mı?{' '}
                <Link href="/auth/login" className="text-black hover:text-gray-700 font-semibold underline">
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

// Loading component for Suspense fallback
function SignupLoading() {
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

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupForm />
    </Suspense>
  )
}
