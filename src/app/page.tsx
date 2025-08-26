'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Kullanıcının giriş durumunu kontrol et
    const checkAuthAndRedirect = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('Auth check error:', error)
          // Auth hatası varsa login sayfasına yönlendir
          router.push('/auth/login')
          return
        }

        if (user) {
          // Kullanıcı giriş yapmışsa dashboard'a yönlendir
          router.push('/dashboard')
        } else {
          // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        router.push('/auth/login')
      }
    }

    checkAuthAndRedirect()
  }, [router])

  // Loading durumu göster
  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-black to-gray-800 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
          <Package className="w-10 h-10 text-white" />
        </div>
        
        {/* Loading */}
        <div className="space-y-4">
          <h2 className="text-3xl font-normal text-black">
            SATIN ALMA SİSTEMİ
          </h2>
          <p className="text-gray-600 text-base">
            Yönlendiriliyor...
          </p>
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-black" />
          </div>
        </div>
      </div>
    </div>
  )
}
