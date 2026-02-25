'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
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
  
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Kullanıcı rolünü çek (sadece ilk yüklemede)
  useEffect(() => {
    const checkInitialAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const role = (profile?.role as UserRole) || 'user'
        setUserRole(role)
        setIsLoading(false)
      } catch (error) {
        console.error('Auth kontrolü hatası:', error)
        router.push('/auth/login')
      }
    }

    checkInitialAuth()
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
        } else {
          // Diğer roller için dashboard'a yönlendir
          router.push('/dashboard')
        }
      }
    }
  }, [pathname, userRole, isLoading, router])

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

  // Access denied state
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <X className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-600 mb-4">Bu sayfaya erişim yetkiniz bulunmuyor.</p>
          <Button onClick={() => router.back()} variant="outline">
            Geri Dön
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Mobile Header - Ada Tasarımı */}
      <header className="fixed top-3 left-3 right-3 h-16 bg-white rounded-3xl border border-gray-100/50 shadow-lg z-50 lg:hidden">
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
          <div className="px-10 py-10">
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