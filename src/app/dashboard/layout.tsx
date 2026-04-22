'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import NotificationPanel from '@/components/NotificationPanel'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { canAccessPage } from '@/lib/roles'
import { ensureProfile, getRedirectPath } from '@/lib/auth'
import type { UserRole } from '@/lib/types'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(true)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)
  
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Auth ve rol kontrolü
  useEffect(() => {
    let mounted = true
    
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        // Session yoksa login'e yönlendir
        if (!session?.user) {
          window.location.href = '/auth/login'
          return
        }

        // Profili kontrol et ve rolü al
        const role = await ensureProfile(
          supabase,
          session.user.id,
          session.user.email,
          session.user.user_metadata?.full_name
        )

        if (!mounted) return

        setUserRole(role)
        setIsLoading(false)
      } catch (error) {
        console.error('Auth hatası:', error)
        if (mounted) {
          window.location.href = '/auth/login?error=auth_failed'
        }
      }
    }

    checkAuth()
    return () => { mounted = false }
  }, [supabase])

  // Sayfa erişim kontrolü
  useEffect(() => {
    if (!isLoading && userRole) {
      const hasPageAccess = canAccessPage(userRole, pathname)
      setHasAccess(hasPageAccess)
      
      if (!hasPageAccess) {
        router.push(getRedirectPath(userRole))
      }
    }
  }, [pathname, userRole, isLoading, router])

  // Scroll kontrolü
  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY
        const scrollDelta = currentScrollY - lastScrollY.current
        
        if (isMobileMenuOpen || isNotificationPanelOpen) {
          setIsHeaderVisible(true)
        } else if (currentScrollY < 10) {
          setIsHeaderVisible(true)
        } else if (scrollDelta > 8) {
          setIsHeaderVisible(false)
        } else if (scrollDelta < -8) {
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

  const handleNotificationPanelChange = (open: boolean) => {
    if (open && isMobileMenuOpen) setIsMobileMenuOpen(false)
    setIsNotificationPanelOpen(open)
  }

  const handleSidebarMobileChange = (open: boolean) => {
    if (open && isNotificationPanelOpen) setIsNotificationPanelOpen(false)
    setIsMobileMenuOpen(open)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="lg" text="Yükleniyor..." />
      </div>
    )
  }

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
          <Button onClick={() => router.push('/dashboard/requests')} className="bg-black hover:bg-gray-800">
            Ana Sayfa
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className={`fixed top-3 left-3 right-3 h-16 bg-white rounded-3xl border border-gray-100/50 shadow-lg z-50 lg:hidden transition-all duration-300 ${isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-[calc(100%+1rem)] opacity-0'}`}>
        <div className="flex items-center justify-between h-full px-5">
          <button onClick={() => router.push('/dashboard/requests')} className="flex items-center hover:opacity-80">
            <img src="/d.png" alt="Logo" className="h-8 w-auto filter brightness-0" />
          </button>
          <div className="flex items-center gap-2">
            <NotificationPanel isOpen={isNotificationPanelOpen} onOpenChange={handleNotificationPanelChange} showMobileButton={true} />
            <Button variant="ghost" size="sm" onClick={() => handleSidebarMobileChange(!isMobileMenuOpen)} className="h-10 w-10 p-0 rounded-xl">
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <Sidebar isMobileOpen={isMobileMenuOpen} setIsMobileOpen={handleSidebarMobileChange} />
      <DashboardHeader />
      
      <div className="hidden lg:block">
        <NotificationPanel isOpen={isNotificationPanelOpen} onOpenChange={handleNotificationPanelChange} />
      </div>
      
      <main className="min-h-screen transition-all duration-500 hidden lg:block lg:pl-[5.5rem]">
        <div className="h-full overflow-y-auto">
          <div className="px-10 pt-20 pb-10">{children}</div>
        </div>
      </main>

      <main className="min-h-screen pt-[4.75rem] lg:hidden">
        <div className="min-h-[calc(100vh-4.75rem)]">
          <div className="px-4 py-6 sm:px-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
