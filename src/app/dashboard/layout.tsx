'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import NotificationPanel from '@/components/NotificationPanel'
// import AIChatbot from '@/components/AIChatbot'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { canAccessPage } from '@/lib/roles'
import type { UserRole } from '@/lib/types'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>('user')
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(true)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)
  
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Kullanıcı rolünü çek (sadece ilk yüklemede)
  useEffect(() => {
    let mounted = true
    
    const checkInitialAuth = async () => {
      try {
        // İlk önce getUser() ile user bilgisini al - bu daha güvenilir
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (!mounted) return
        
        if (userError || !user) {
          console.error('❌ User error:', userError?.message)
          // Session yok, middleware redirect yapacak
          setIsLoading(false)
          return
        }

        console.log('✅ User found:', user.id)

        // Profil bilgisini çek - retry mekanizması ile
        let profile = null
        let profileError = null
        
        // İlk deneme
        const result = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        profile = result.data
        profileError = result.error

        // Eğer profil alınamazsa, kısa bir süre bekleyip tekrar dene
        if (profileError && mounted) {
          console.warn('⚠️ Profile error, retrying...:', profileError.message)
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const retryResult = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          profile = retryResult.data
          profileError = retryResult.error
        }

        if (!mounted) return

        if (profileError) {
          console.error('❌ Profile error after retry:', profileError.message, profileError)
          // RLS hatası alıyorsa, kullanıcıyı logout yap
          await supabase.auth.signOut()
          window.location.href = '/auth/login?error=profile_access_denied'
          return
        }

        console.log('✅ Profile found:', profile?.role)
        let role = (profile?.role as UserRole) || 'site_personnel'

        // "user" rolünü otomatik "site_personnel"e yükselt (Microsoft Single Tenant)
        if (role === 'user') {
          console.log('🔄 user rolü tespit edildi, site_personnel\'e yükseltiliyor...')
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'site_personnel' })
            .eq('id', user.id)
          
          if (!updateError) {
            role = 'site_personnel'
            console.log('✅ Rol yükseltildi: site_personnel')
          } else {
            console.warn('⚠️ Rol yükseltilemedi:', updateError.message)
          }
        }

        setUserRole(role)
        setIsLoading(false)
      } catch (error) {
        console.error('❌ Auth kontrolü hatası:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    checkInitialAuth()
    
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Sadece component mount'ta çalışır

  // Sayfa erişim kontrolü (pathname değiştiğinde)
  useEffect(() => {
    if (!isLoading && userRole) {
      const hasPageAccess = canAccessPage(userRole, pathname)
      setHasAccess(hasPageAccess)
      
      if (!hasPageAccess) {
        // Erişim yoksa kullanıcıyı erişebileceği bir sayfaya yönlendir
        if (userRole === 'site_manager' || userRole === 'site_personnel' || userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici') {
          router.push('/dashboard/requests')
        } else if (userRole === 'purchasing_officer') {
          router.push('/dashboard')
        } else {
          router.push('/dashboard')
        }
      }
    }
  }, [pathname, userRole, isLoading, router])

  // Mobil header scroll hide/show kontrolü
  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        const scrollDelta = currentScrollY - lastScrollY.current
        
        // Eğer menü açıksa header'ı gizleme
        if (isMobileMenuOpen || isNotificationPanelOpen) {
          setIsHeaderVisible(true)
          lastScrollY.current = currentScrollY
          ticking.current = false
          return
        }
        
        // Sayfa başındaysa her zaman göster
        if (currentScrollY < 10) {
          setIsHeaderVisible(true)
        } else if (scrollDelta > 8) {
          // Aşağı scroll - gizle (8px threshold ile hassasiyeti azalt)
          setIsHeaderVisible(false)
        } else if (scrollDelta < -8) {
          // Yukarı scroll - göster
          setIsHeaderVisible(true)
        }
        
        lastScrollY.current = currentScrollY
        ticking.current = false
      })
      ticking.current = true
    }
  }, [isMobileMenuOpen, isNotificationPanelOpen])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Bildirim paneli açıldığında sidebar'ı kapat ve tam tersi
  const handleNotificationPanelChange = (open: boolean) => {
    if (open && isMobileMenuOpen) {
      setIsMobileMenuOpen(false)
    }
    setIsNotificationPanelOpen(open)
  }

  const handleSidebarMobileChange = (open: boolean) => {
    if (open && isNotificationPanelOpen) {
      setIsNotificationPanelOpen(false)
    }
    setIsMobileMenuOpen(open)
  }



  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="lg" text="Erişim kontrolü..." />
      </div>
    )
  }

  // Access denied state - sadece yetkili roller için (user rolü buraya gelmez)
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Bu sayfaya erişiminiz yok</h2>
          <p className="text-gray-600 mb-6">Görüntülemek istediğiniz sayfa için gerekli yetkiniz bulunmuyor.</p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => router.back()} variant="outline">
              Geri Dön
            </Button>
            <Button onClick={() => router.push('/dashboard/requests')} className="bg-black hover:bg-gray-800">
              Ana Sayfa
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Mobile Header - Ada Tasarımı */}
      <header 
        className={`fixed top-3 left-3 right-3 h-16 bg-white rounded-3xl border border-gray-100/50 shadow-lg z-50 lg:hidden transition-all duration-300 ease-out ${
          isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-[calc(100%+1rem)] opacity-0'
        }`}
      >
        <div className="flex items-center justify-between h-full px-5">
          <button 
            onClick={() => router.push('/dashboard/requests')}
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <img 
              src="/d.png" 
              alt="Logo" 
              className="h-8 w-auto filter brightness-0"
            />
          </button>
          <div className="flex items-center gap-2">
            {/* Mobile Notification Button */}
            <NotificationPanel 
              isOpen={isNotificationPanelOpen}
              onOpenChange={handleNotificationPanelChange}
              showMobileButton={true}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSidebarMobileChange(!isMobileMenuOpen)}
              className="h-10 w-10 p-0 rounded-xl bg-transparent hover:bg-gray-100 text-gray-600 transition-all duration-200"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <Sidebar 
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={handleSidebarMobileChange}
      />

      {/* Desktop Header */}
      <DashboardHeader />

      {/* Desktop Notification Panel */}
      <div className="hidden lg:block">
        <NotificationPanel 
          isOpen={isNotificationPanelOpen}
          onOpenChange={handleNotificationPanelChange}
        />
      </div>
      
      {/* Desktop Layout - Sidebar artık ada tasarımında, boşluklar ayarlandı */}
      <main className="min-h-screen transition-all duration-500 hidden lg:block lg:pl-[5.5rem]">
        <div className="h-full overflow-y-auto">
          <div className="px-10 pt-20 pb-10">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Layout */}
      <main className="min-h-screen pt-[4.75rem] lg:hidden">
        <div className="min-h-[calc(100vh-4.75rem)]">
          <div className="px-4 py-6 sm:px-6">
            {children}
          </div>
        </div>
      </main>

      {/* AI Chatbot - Temporarily disabled */}
      {/* <AIChatbot /> */}
    </div>
  )
}