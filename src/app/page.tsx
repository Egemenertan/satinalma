'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

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
        {/* Logo - Animasyonlu */}
        <div className="mx-auto mb-8">
          <img 
            src="/d.png" 
            alt="Logo" 
            className="mx-auto w-24 h-24 object-contain filter brightness-0 animate-pulse"
          />
        </div>
        
        {/* İçerik */}
        <div className="space-y-6">
          <h2 className="text-4xl font-normal text-black tracking-wide">
            SATIN ALMA SİSTEMİ
          </h2>
          <p className="text-gray-600 text-lg font-medium">
            Yönlendiriliyor...
          </p>
          
          {/* Loading Çubuğu */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
            <div className="w-48 mx-auto bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-black to-gray-600 h-1.5 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
