'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import AIChatbot from '@/components/AIChatbot'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { canAccessPage } from '@/lib/roles'
import type { UserRole } from '@/lib/types'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>('user')
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(true)
  
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Kullanıcı rolünü çek ve sayfa erişim kontrolü yap
  useEffect(() => {
    const checkAccess = async () => {
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
        
        // Sayfa erişim kontrolü
        const hasPageAccess = canAccessPage(role, pathname)
        setHasAccess(hasPageAccess)
        
        if (!hasPageAccess) {
          // Erişim yoksa kullanıcıyı erişebileceği bir sayfaya yönlendir
          if (role === 'site_manager') {
            router.push('/dashboard') // Site manager'ı dashboard'a yönlendir
          } else if (role === 'site_personnel') {
            router.push('/dashboard/requests') // Site personeli'ni taleplere yönlendir
          }
        }
        
      } catch (error) {
        console.error('Erişim kontrolü hatası:', error)
        router.push('/auth/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [pathname, router, supabase])



  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-light text-lg">Erişim kontrolü...</p>
        </div>
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
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 lg:hidden">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center">
            <img 
              src="/d.png" 
              alt="Logo" 
              className="h-8 w-auto filter brightness-0"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-10 w-10 p-0 rounded-lg bg-transparent hover:bg-gray-100 text-gray-600 transition-all duration-200"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <Sidebar 
        onCollapsedChange={setSidebarCollapsed} 
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />
      
      {/* Desktop Layout */}
      <main className={`min-h-screen transition-all duration-300 hidden lg:block ${
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      }`}>
        <div className="h-full overflow-y-auto">
          <div className="p-8">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Layout */}
      <main className="min-h-screen pt-16 lg:hidden">
        <div className="min-h-[calc(100vh-4rem)]">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </div>
      </main>

      {/* AI Chatbot - Dashboard'un her yerinde erişilebilir */}
      <AIChatbot />
    </div>
  )
}