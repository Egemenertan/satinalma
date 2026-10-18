'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import Sidebar from '@/components/Sidebar'
import NotificationPanel from '@/components/NotificationPanel'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { Menu, X } from 'lucide-react'
import { canAccessPage } from '@/lib/roles'
import {
  WAREHOUSE_ACCESS_SWR_KEY,
  fetchMyWarehouseAccessScope,
} from '@/lib/warehouse-access'
import { getRedirectPath } from '@/lib/auth'
import { useCurrentProfile } from '@/lib/auth/current-profile'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  const [accessCheck, setAccessCheck] = useState<'loading' | 'allow' | 'deny'>('loading')
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)
  const redirectedRef = useRef(false)

  const pathname = usePathname()
  const router = useRouter()
  const { data: profile, error: profileError, isLoading: profileLoading } = useCurrentProfile()
  const userRole = profile?.role ?? null

  const isProductsPage =
    pathname === '/dashboard/products' || pathname.startsWith('/dashboard/products/')
  const needsWarehouseScope = userRole === 'site_manager' && isProductsPage

  const { data: warehouseScope } = useSWR(
    needsWarehouseScope ? WAREHOUSE_ACCESS_SWR_KEY : null,
    fetchMyWarehouseAccessScope,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
    }
  )

  useEffect(() => {
    if (profileLoading) return
    if (!profile) {
      if (!profileError && !redirectedRef.current) {
        redirectedRef.current = true
        window.location.href = '/auth/login'
      }
    }
  }, [profile, profileLoading, profileError])

  useEffect(() => {
    if (profileLoading) return

    if (!userRole) {
      if (profileError) {
        setAccessCheck('allow')
        return
      }
      setAccessCheck('loading')
      return
    }

    const roleAllowed = canAccessPage(userRole, pathname)

    if (roleAllowed) {
      setAccessCheck('allow')
      return
    }

    if (userRole === 'site_manager' && isProductsPage) {
      if (!warehouseScope) {
        setAccessCheck('loading')
        return
      }
      setAccessCheck(warehouseScope.manageWarehouseIds.length > 0 ? 'allow' : 'deny')
      return
    }

    setAccessCheck('deny')
  }, [pathname, userRole, profileLoading, profileError, isProductsPage, warehouseScope])

  useEffect(() => {
    if (accessCheck !== 'deny' || !userRole) return
    router.push(getRedirectPath(userRole))
  }, [accessCheck, userRole, router])

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

  if (profileLoading || accessCheck === 'loading' || (!profile && !profileError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loading size="lg" text="Yükleniyor..." />
      </div>
    )
  }

  if (accessCheck === 'deny') {
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
      <header className={`fixed top-0 inset-x-0 h-[4.5rem] w-full bg-white border-b border-gray-100 shadow-sm z-50 lg:hidden transition-all duration-300 ${isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="flex items-center justify-between h-full px-4">
          <button onClick={() => router.push('/dashboard/requests')} className="flex items-center hover:opacity-80">
            <img src="/d.png" alt="Logo" className="h-10 w-auto filter brightness-0" />
          </button>
          <div className="flex items-center gap-2">
            <NotificationPanel isOpen={isNotificationPanelOpen} onOpenChange={handleNotificationPanelChange} showMobileButton={true} />
            <Button variant="ghost" size="sm" onClick={() => handleSidebarMobileChange(!isMobileMenuOpen)} className="h-10 w-10 p-0 rounded-full">
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <Sidebar isMobileOpen={isMobileMenuOpen} setIsMobileOpen={handleSidebarMobileChange} />

      <div className="hidden lg:block">
        <NotificationPanel isOpen={isNotificationPanelOpen} onOpenChange={handleNotificationPanelChange} />
      </div>

      <main className="min-h-screen pt-[4.5rem] lg:pt-0 lg:pl-[5.5rem]">
        <div className="w-full px-4 py-6 sm:px-6 lg:px-10 lg:pt-8 lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  )
}
