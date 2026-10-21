'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getAccessibleMenuItems } from '@/lib/roles'
import {
  WAREHOUSE_ACCESS_SWR_KEY,
  fetchMyWarehouseAccessScope,
} from '@/lib/warehouse-access'
import { useCurrentProfile, clearCurrentProfileCache } from '@/lib/auth/current-profile'
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  Truck,
  Package,
  Tag,
  UserCog,
  Plus,
  BarChart3
} from 'lucide-react'

const fetchPendingRequestsCount = async (role: string) => {
  const supabase = createClient()
  let query = supabase
    .from('purchase_requests')
    .select('id', { count: 'exact', head: true })

  if (role === 'purchasing_officer') {
    query = query.eq('status', 'şantiye şefi onayladı')
  } else {
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
  id?: string
  title: string
  href?: string
  icon?: React.ElementType
  logoSrc?: string
  badge?: string
  children?: NavItem[]
}

// Navigation - pendingCount ve userRole'u prop olarak alacak fonksiyon
const getNavigation = (pendingCount: number, userRole: string, extraMenuIds: string[] = []): NavItem[] => {
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
      id: 'contracts',
      title: 'Sözleşmeler',
      href: '/dashboard/contracts',
      icon: FileText
    },
    {
      id: 'quote-comparison',
      title: 'DLX AI',
      href: '/dashboard/quote-comparison',
      logoSrc: '/dlxai.png'
    },
    {
      id: 'orders',
      title: 'Siparişler',
      href: '/dashboard/orders',
      icon: Truck
    },
    {
      id: 'products',
      title: 'Ürünler',
      href: '/dashboard/products',
      icon: Package
    },
    {
      id: 'brands',
      title: 'Markalar',
      href: '/dashboard/brands',
      icon: Tag
    },
    {
      id: 'reports',
      title: 'Raporlar',
      href: '/dashboard/reports',
      icon: BarChart3
    },
    {
      id: 'admin',
      title: 'Admin Paneli',
      href: '/dashboard/admin',
      icon: UserCog
    },
    {
      id: 'settings',
      title: 'Ayarlar',
      href: '/dashboard/settings',
      icon: Settings
    }
  ]

  // Kullanıcı rolüne göre erişilebilir menü öğelerini filtrele
  const accessibleMenuIds = [
    ...getAccessibleMenuItems(userRole as any),
    ...extraMenuIds,
  ]
  
  return allMenuItems.filter(item => accessibleMenuIds.includes(item.id))
}

interface SidebarProps {
  className?: string
  isMobileOpen?: boolean
  setIsMobileOpen?: (open: boolean) => void
}

export default function Sidebar({ 
  className, 
  isMobileOpen: externalIsMobileOpen = false,
  setIsMobileOpen: externalSetIsMobileOpen
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(['Satın Alma'])
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const isMobileOpen = externalSetIsMobileOpen ? externalIsMobileOpen : internalIsMobileOpen
  const setIsMobileOpen = externalSetIsMobileOpen || setInternalIsMobileOpen
  const pathname = usePathname()
  const router = useRouter()
  const { data: profile } = useCurrentProfile()
  const userRole = profile?.role || 'user'
  const userEmail = profile?.email || ''
  const userName = profile?.fullName || ''
  const userSiteIds = profile?.siteId
    ? (Array.isArray(profile.siteId) ? profile.siteId : [profile.siteId])
    : []

  const { data: warehouseScope } = useSWR(
    userRole === 'site_manager' ? WAREHOUSE_ACCESS_SWR_KEY : null,
    fetchMyWarehouseAccessScope,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
    }
  )
  const canSeeDepotProducts = (warehouseScope?.manageWarehouseIds.length ?? 0) > 0

  const { data: pendingCount, mutate: refreshPendingCount } = useSWR(
    profile?.role ? `pending_requests_count_${profile.role}` : null,
    () => fetchPendingRequestsCount(profile!.role),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      fallbackData: 0
    }
  )

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

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen)
  }

  const supabase = createClient()
  
  const handleLogout = async () => {
    try {
      clearCurrentProfileCache()
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
    // Dashboard için tam eşleşme kontrolü
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    // Diğer sayfalar için normal kontrol
    return pathname === href || pathname.startsWith(href + '/')
  }

  const NavItemComponent = ({ item, level = 0 }: { item: NavItem; level?: number }) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.includes(item.title)
    const active = isActive(item.href)
    const showTooltip = isCollapsed && !isMobileOpen && hoveredItem === item.title
    const Icon = item.icon
    const logoActiveClasses = item.logoSrc
      ? '!bg-transparent hover:!bg-transparent focus-visible:!bg-transparent active:!bg-transparent shadow-none'
      : active
        ? 'bg-neutral-950 text-white hover:bg-neutral-950'
        : 'text-gray-700 hover:bg-neutral-950 hover:text-white'

    const renderLogo = (opts: { collapsed?: boolean; mobile?: boolean }) => (
      <img
        src={item.logoSrc}
        alt={item.title}
        className={cn(
          'object-contain',
          opts.mobile ? 'h-7 w-auto max-w-full' : opts.collapsed ? 'h-4 w-auto' : 'h-5 w-auto'
        )}
      />
    )

    if (hasChildren) {
      return (
        <div className="space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full h-10 transition-all duration-200",
              isCollapsed ? "justify-center px-0" : "justify-start px-2",
              logoActiveClasses,
              "rounded-sm"
            )}
            onClick={() => toggleExpanded(item.title)}
            onMouseEnter={() => setHoveredItem(item.title)}
            onMouseLeave={() => setHoveredItem(null)}
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

    // Mobile için kare buton tasarımı
    if (isMobileOpen) {
      return (
        <Link href={item.href || '#'}>
          <Button
            variant="ghost"
            className={cn(
              "aspect-square w-full transition-all duration-200 flex flex-col items-center justify-center gap-2 relative p-2",
              logoActiveClasses,
              item.logoSrc ? "rounded-none overflow-visible border-0" : "rounded-sm border",
              !item.logoSrc && (active ? "border-neutral-950" : "border-gray-200 hover:border-neutral-950")
            )}
            onClick={() => {
              setIsMobileOpen(false)
            }}
          >
            {item.logoSrc ? (
              renderLogo({ mobile: true })
            ) : (
              <>
                {Icon && <Icon className="h-7 w-7" />}
                <span className="text-xs font-medium text-center leading-tight">{item.title}</span>
              </>
            )}
            {item.badge && (
              <Badge 
                variant="secondary" 
                className="absolute top-2 right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-neutral-950 text-white hover:bg-neutral-900 border-0 rounded-full"
              >
                {item.badge}
              </Badge>
            )}
          </Button>
        </Link>
      )
    }

    // Desktop için normal tasarım
    return (
      <div className="relative">
        <Link href={item.href || '#'}>
          <Button
            variant="ghost"
            className={cn(
              "w-full h-10 transition-all duration-200 overflow-visible",
              isCollapsed ? "justify-center px-0" : "justify-start px-2",
              logoActiveClasses,
              item.logoSrc ? "rounded-none" : "rounded-sm"
            )}
            onMouseEnter={() => setHoveredItem(item.title)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {item.logoSrc ? (
              renderLogo({ collapsed: isCollapsed })
            ) : (
              Icon && <Icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
            )}
            {!isCollapsed && !item.logoSrc && (
              <>
                <span className="text-sm">{item.title}</span>
                {item.badge && (
                  <Badge 
                    variant="secondary" 
                    className="ml-auto h-5 min-w-5 shrink-0 px-2 text-xs bg-neutral-950 text-white hover:bg-neutral-900 border-0 rounded-full"
                  >
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </Link>
        
        {/* Modern Tooltip */}
        {showTooltip && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className="bg-black text-white px-5 py-2.5 rounded-md text-base font-medium shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
              {item.title}
              {item.badge && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-4 px-1.5 text-xs bg-neutral-950 text-white border-0 rounded-full"
                >
                  {item.badge}
                </Badge>
              )}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-black" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Sidebar */}
      <div 
        className={cn(
          "fixed z-50 flex flex-col transition-all duration-500 ease-out overflow-visible",
          "bg-white shadow-lg",
          // Desktop - Ada tasarımı (sol tarafta)
          "hidden lg:flex",
          "lg:top-3 lg:bottom-3 lg:left-3 lg:rounded-xl lg:border lg:border-gray-200/60",
          isCollapsed ? "lg:w-16" : "lg:w-64",
          // Mobile - Tam sayfa
          isMobileOpen ? "flex inset-0 w-full h-full" : "hidden lg:flex",
          className
        )}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Header with Logo */}
        <div className={cn(
          "flex items-center border-b border-gray-100",
          isMobileOpen ? "justify-between px-6 py-6" : "justify-center px-4 py-5"
        )}>
          {/* Logo - sadece mobile'da göster */}
          {isMobileOpen && (
            <button 
              onClick={() => router.push('/dashboard/requests')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <img 
                src="/DLX.png" 
                alt="DLX" 
                className="h-10 w-auto"
              />
            </button>
          )}
          
          {/* Desktop: Logo icon, Mobile: Close Button */}
          {isMobileOpen ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileOpen(false)}
              className="h-10 w-10 p-0 rounded-sm hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:rotate-90"
            >
              <X className="h-5 w-5" />
            </Button>
          ) : (
            <button 
              onClick={() => router.push('/dashboard/requests')}
              className="hover:opacity-80 transition-opacity"
            >
              <img 
                src="/DLX.png" 
                alt="DLX" 
                className="h-8 w-auto object-contain"
              />
            </button>
          )}
        </div>

        {/* Quick Create */}
        <div className={cn("py-4", isCollapsed && !isMobileOpen ? "px-2" : isMobileOpen ? "px-6" : "px-4")}>
          {isCollapsed && !isMobileOpen ? (
            <div className="space-y-2 flex flex-col items-center">
              {/* Hızlı Talep - Icon Only */}
              <div className="relative">
                <Button 
                  onClick={() => router.push('/dashboard/requests/create')}
                  onMouseEnter={() => setHoveredItem('quick-create')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="w-10 h-10 bg-white text-neutral-950 border-2 border-neutral-950 rounded-sm flex items-center justify-center transition-all duration-200 hover:bg-neutral-950 hover:text-white"
                >
                  <Plus className="h-5 w-5" />
                </Button>
                
                {/* Tooltip for Quick Create */}
                {hoveredItem === 'quick-create' && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <div className="bg-black text-white px-5 py-2.5 rounded-md text-base font-medium shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
                      Hızlı Talep
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-black" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={cn("space-y-3", isMobileOpen && "grid grid-cols-2 gap-3")}>
              <Button 
                onClick={() => {
                  router.push('/dashboard/requests/create')
                  if (isMobileOpen) {
                    setIsMobileOpen(false)
                  }
                }}
                className={cn(
                  "bg-white hover:bg-neutral-950 text-neutral-950 hover:text-white border-2 border-neutral-950 font-medium rounded-sm transition-all duration-200",
                  isMobileOpen ? "aspect-square w-full h-auto flex-col gap-2 p-3" : "w-full h-9 text-sm"
                )}
              >
                <Plus className={cn(isMobileOpen ? "h-6 w-6" : "h-4 w-4 mr-2")} />
                <span className={cn(isMobileOpen ? "text-xs" : "text-sm")}>Hızlı Talep</span>
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-4",
          isCollapsed && !isMobileOpen ? "px-2 space-y-1 overflow-visible" : isMobileOpen ? "px-6 grid grid-cols-2 gap-3 content-start overflow-y-auto" : "px-4 space-y-1 overflow-y-auto"
        )}>
          {getNavigation(
            pendingCount || 0,
            userRole,
            userRole === 'site_manager' && canSeeDepotProducts ? ['products'] : []
          )
            .filter(item => {
              // f7f3d36e-0c31-4e9a-8883-94c39330660b site ID'sine ait kullanıcılar tedarikçiler sayfasına erişemez
              const restrictedSiteId = 'f7f3d36e-0c31-4e9a-8883-94c39330660b'
              if (item.id === 'suppliers' && userSiteIds.includes(restrictedSiteId)) {
                return false
              }
              return true
            })
            .map((item) => (
              <NavItemComponent key={item.title} item={item} />
            ))}
        </nav>

        {/* User Profile */}
        <div className={cn(
          "py-5 border-t border-gray-100",
          isCollapsed && !isMobileOpen ? "px-2" : isMobileOpen ? "px-6" : "px-4"
        )}>
          {isCollapsed && !isMobileOpen ? (
            // Desktop collapsed - Sadece logout butonu
            <div className="relative flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 text-gray-400 hover:text-white hover:bg-neutral-950 rounded-sm transition-all duration-200"
                onClick={handleLogout}
                onMouseEnter={() => setHoveredItem('logout')}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <LogOut className="h-4 w-4" />
              </Button>
              
              {/* Logout Tooltip */}
              {hoveredItem === 'logout' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                  <div className="bg-black text-white px-5 py-2.5 rounded-md text-base font-medium shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
                    Çıkış Yap
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-black" />
                  </div>
                </div>
              )}
            </div>
          ) : isMobileOpen ? (
            // Mobile için özel tasarım
            <div className="space-y-3">
              <div className="flex items-center space-x-3 bg-gray-50/50 rounded-full p-4 border border-gray-100">
                <div className="w-12 h-12 bg-neutral-950 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-medium text-white">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {userName || 'Kullanıcı'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {userEmail}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full h-12 text-neutral-950 hover:text-white hover:bg-neutral-950 rounded-sm font-medium transition-all duration-200"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 mr-2" />
                Çıkış Yap
              </Button>
            </div>
          ) : (
            // Desktop expanded - Sadece logout butonu
            <Button
              variant="ghost"
              className="w-full h-10 text-neutral-950 hover:text-white hover:bg-neutral-950 rounded-sm font-medium transition-all duration-200"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="text-sm">Çıkış Yap</span>
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
