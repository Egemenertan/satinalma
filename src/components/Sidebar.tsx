'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getAccessibleMenuItems, getRoleLabel } from '@/lib/roles'
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  ChevronLeft,
  BarChart3,
  Truck
} from 'lucide-react'

// Bekleyen talep sayısını getiren fetcher (rol bazlı)
const fetchPendingRequestsCount = async () => {
  const supabase = createClient()
  
  // Kullanıcı bilgilerini çek
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return 0
  }

  // Kullanıcı rolünü çek
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let query = supabase
    .from('purchase_requests')
    .select('id', { count: 'exact', head: true })

  // Purchasing officer için sadece "şantiye şefi onayladı" durumundaki talepleri say
  if (profile?.role === 'purchasing_officer') {
    query = query.eq('status', 'şantiye şefi onayladı')
  } else {
    // Diğer roller için pending durumundaki talepleri say
    query = query.eq('status', 'pending')
  }
  
  const { count, error } = await query
  
  if (error) {
    console.error('Bekleyen talep sayısı alınırken hata:', error)
    return 0
  }
  
  return count || 0
}

interface NavItem {
  title: string
  href?: string
  icon: React.ElementType
  badge?: string
  children?: NavItem[]
}

// Navigation - pendingCount ve userRole'u prop olarak alacak fonksiyon
const getNavigation = (pendingCount: number, userRole: string): NavItem[] => {
  const allMenuItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard
    },
    {
      id: 'requests',
      title: 'Talepler',
      href: '/dashboard/requests',
      icon: FileText,
      badge: pendingCount > 0 ? pendingCount.toString() : undefined
    },
    {
      id: 'sites',
      title: 'Şantiyeler',
      href: '/dashboard/sites',
      icon: Building2
    },
    {
      id: 'suppliers',
      title: 'Tedarikçiler',
      href: '/dashboard/suppliers',
      icon: Users
    },
    {
      id: 'orders',
      title: 'Siparişler',
      href: '/dashboard/orders',
      icon: Truck
    },
    {
      id: 'reports',
      title: 'Raporlar',
      href: '/dashboard/reports',
      icon: BarChart3
    },
    {
      id: 'settings',
      title: 'Ayarlar',
      href: '/dashboard/settings',
      icon: Settings
    }
  ]

  // Kullanıcı rolüne göre erişilebilir menü öğelerini filtrele
  const accessibleMenuIds = getAccessibleMenuItems(userRole as any)
  
  return allMenuItems.filter(item => accessibleMenuIds.includes(item.id))
}

interface SidebarProps {
  className?: string
  onCollapsedChange?: (collapsed: boolean) => void
  isMobileOpen?: boolean
  setIsMobileOpen?: (open: boolean) => void
}

export default function Sidebar({ 
  className, 
  onCollapsedChange, 
  isMobileOpen: externalIsMobileOpen = false,
  setIsMobileOpen: externalSetIsMobileOpen
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(['Satın Alma'])
  const [userRole, setUserRole] = useState<string>('user')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  
  // External prop varsa onu kullan, yoksa internal state kullan
  const isMobileOpen = externalSetIsMobileOpen ? externalIsMobileOpen : internalIsMobileOpen
  const setIsMobileOpen = externalSetIsMobileOpen || setInternalIsMobileOpen
  const pathname = usePathname()
  const router = useRouter()

  // Bekleyen talep sayısını SWR ile çek - user role ile key oluştur
  const { data: pendingCount, mutate: refreshPendingCount } = useSWR(
    userRole ? `pending_requests_count_${userRole}` : null,
    fetchPendingRequestsCount,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 saniye cache
      errorRetryCount: 2,
      fallbackData: 0
    }
  )

  // Kullanıcı bilgilerini çek
  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Email adresini set et
        setUserEmail(user.email || '')
        
        // Profile bilgilerini çek
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single()
        
        if (profile?.role) {
          setUserRole(profile.role)
        }
        
        // İsim bilgisini set et - önce full_name, yoksa email'den al
        if (profile?.full_name) {
          setUserName(profile.full_name)
        } else if (user.email) {
          // Email'den isim çıkar (@ işaretinden öncesini al)
          const nameFromEmail = user.email.split('@')[0]
          setUserName(nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1))
        }
      }
    }
    
    fetchUserData()
  }, [])

  // Mobile responsive kontrol
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Real-time updates için subscription
  useEffect(() => {
    const supabase = createClient()
    
    const subscription = supabase
      .channel('pending_requests_notifications')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'purchase_requests' 
        }, 
        (payload) => {
          console.log('📡 Sidebar notification update:', payload)
          // Bekleyen talep sayısını yenile
          refreshPendingCount()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [refreshPendingCount])

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed
    setIsCollapsed(newCollapsed)
    onCollapsedChange?.(newCollapsed)
  }

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen)
  }

  const supabase = createClient()
  
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  const isActive = (href?: string) => {
    if (!href) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  const NavItemComponent = ({ item, level = 0 }: { item: NavItem; level?: number }) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.includes(item.title)
    const active = isActive(item.href)

    if (hasChildren) {
      return (
        <div className="space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full h-10 transition-colors",
              isCollapsed ? "justify-center px-0" : "justify-start px-2",
              "text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md",
              active && "bg-gray-100 text-gray-900"
            )}
            onClick={() => toggleExpanded(item.title)}
          >
            <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
            {(!isCollapsed || isMobileOpen) && (
              <>
                <span className="flex-1 text-left text-sm">{item.title}</span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </>
            )}
          </Button>
          {isExpanded && (!isCollapsed || isMobileOpen) && (
            <div className="ml-4 space-y-1">
              {item.children?.map((child) => (
                <NavItemComponent key={child.title} item={child} level={level + 1} />
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link href={item.href || '#'}>
        <Button
          variant="ghost"
          className={cn(
            "w-full h-10 transition-colors",
            isCollapsed ? "justify-center px-0" : "justify-start px-2",
            "text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md",
            active && "bg-gray-100 text-gray-900"
          )}
          onClick={() => {
            if (isMobileOpen) {
              setIsMobileOpen(false)
            }
          }}
          title={isCollapsed ? item.title : undefined}
        >
          <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
          {(!isCollapsed || isMobileOpen) && (
            <>
              <span className="text-sm">{item.title}</span>
              {item.badge && (
                <Badge 
                  variant="secondary" 
                  className="ml-auto h-5 px-2 text-xs bg-red-500 text-white hover:bg-red-600 border-0"
                >
                  {item.badge}
                </Badge>
              )}
            </>
          )}
        </Button>
      </Link>
    )
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed z-50 flex flex-col transition-all duration-500 ease-out",
        "bg-gradient-to-br from-white to-gray-50/50 shadow-2xl backdrop-blur-xl",
        // Desktop - Ada tasarımı (sol tarafta)
        "hidden lg:flex",
        "lg:top-3 lg:bottom-3 lg:left-3 lg:rounded-3xl lg:border lg:border-gray-100/50",
        isCollapsed ? "lg:w-16" : "lg:w-64",
        // Mobile - Ada tasarımı (sağ tarafta)
        isMobileOpen ? "flex top-3 bottom-3 left-3 w-64 rounded-3xl border border-gray-100/50" : "hidden lg:flex",
        className
      )}>
        {/* Header with Logo */}
        <div className={cn(
          "flex items-center border-b border-gray-100/50",
          // Mobile: sadece kapatma butonu sağda
          isMobileOpen ? "justify-end px-6 py-5" : 
          // Desktop: logo ve toggle buton
          isCollapsed ? "justify-center px-4 py-5" : "justify-between px-6 py-5"
        )}>
          {/* Logo - sadece desktop'ta göster */}
          {!isMobileOpen && !isCollapsed && (
            <div className="flex items-center space-x-2">
              <img 
                src="/d.png" 
                alt="Logo" 
                className="h-8 w-auto filter brightness-0"
              />
            </div>
          )}
          
          {/* Desktop: Collapse Toggle, Mobile: Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={isMobileOpen ? () => setIsMobileOpen(false) : handleToggleCollapse}
            className="h-8 w-8 p-0 rounded-xl hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:rotate-90"
          >
            {isMobileOpen ? (
              <X className="h-4 w-4" />
            ) : isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick Create - only show when not collapsed */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-4 py-3">
            <Button 
              onClick={() => {
                router.push('/dashboard/requests/create')
                // Mobile'da sidebar'ı kapat
                if (isMobileOpen) {
                  setIsMobileOpen(false)
                }
              }}
              className="w-full h-9 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-2xl"
            >
              
              Hızlı Talep
            </Button>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-2 space-y-1",
          isCollapsed ? "px-2" : "px-4"
        )}>
          {getNavigation(pendingCount || 0, userRole).map((item) => (
            <NavItemComponent key={item.title} item={item} />
          ))}
        </nav>

        {/* User Profile */}
        <div className={cn(
          "py-4 border-t border-gray-100",
          isCollapsed ? "px-2" : "px-4"
        )}>
          {isCollapsed && !isMobileOpen ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {userName || 'Kullanıcı'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {userEmail}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
              {/* Rol Bilgisi */}
              <div className="pl-11">
                <div className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-md inline-block">
                  {getRoleLabel(userRole as any)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
