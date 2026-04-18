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
    <div className="min-h-screen relative grid lg:grid-cols-2 gap-0 bg-white">
      {/* Sol Taraf - Kayıt Formu */}
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
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Kayıt Ol</h1>
            <p className="text-gray-600 mt-3 text-lg">
              Microsoft hesabınız ile kayıt olun
            </p>
          </div>
          
          {/* Form - Border'sız, sade */}
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-0 bg-red-50">
                <AlertDescription className="text-sm text-red-900">{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Microsoft ile Kayıt Ol Butonu */}
            <Button 
              type="button"
              onClick={() => window.location.href = '/auth/login'}
              className="w-full h-14 text-base font-semibold bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-3 transition-all duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0h10.93v10.93H0V0z" fill="#F25022"/>
                <path d="M12.07 0H23v10.93H12.07V0z" fill="#7FBA00"/>
                <path d="M0 12.07h10.93V23H0V12.07z" fill="#00A4EF"/>
                <path d="M12.07 12.07H23V23H12.07V12.07z" fill="#FFB900"/>
              </svg>
              Microsoft ile Kayıt Ol
            </Button>
            
            {/* Login Link */}
            <div className="pt-6 text-center">
              <p className="text-sm text-gray-600">
                Zaten hesabınız var mı?{' '}
                <Link 
                  href="/auth/login" 
                  className="text-gray-900 hover:text-gray-700 font-semibold"
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