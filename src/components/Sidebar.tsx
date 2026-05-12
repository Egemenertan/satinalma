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
import RoleAssignmentModal from '@/components/RoleAssignmentModal'
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
  ClipboardList
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
      id: 'inventory',
      title: 'Zimmetlerim',
      href: '/dashboard/inventory',
      icon: ClipboardList
    },
    {
      id: 'all-inventory',
      title: 'Tüm Zimmetler',
      href: '/dashboard/inventory/all',
      icon: Package
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
  const accessibleMenuIds = getAccessibleMenuItems(userRole as any)
  
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
  const [userRole, setUserRole] = useState<string>('user')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [showRoleAssignmentModal, setShowRoleAssignmentModal] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  
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

    if (hasChildren) {
      return (
        <div className="space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full h-10 transition-all duration-200",
              isCollapsed ? "justify-center px-0" : "justify-start px-2",
              active 
                ? "bg-neutral-950 text-white hover:bg-neutral-900" 
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50/50",
              "rounded-full"
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
              active 
                ? "bg-neutral-950 text-white hover:bg-neutral-900" 
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50/50",
              "rounded-full border",
              active ? "border-neutral-950" : "border-gray-200"
            )}
            onClick={() => {
              setIsMobileOpen(false)
            }}
          >
            <item.icon className="h-7 w-7" />
            <span className="text-xs font-medium text-center leading-tight">{item.title}</span>
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
              "w-full h-10 transition-all duration-200",
              isCollapsed ? "justify-center px-0" : "justify-start px-2",
              active 
                ? "bg-neutral-950 text-white hover:bg-neutral-900" 
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50/50",
              "rounded-full"
            )}
            onMouseEnter={() => setHoveredItem(item.title)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
            {!isCollapsed && (
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
            <div className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
              {item.title}
              {item.badge && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-4 px-1.5 text-xs bg-neutral-950 text-white border-0 rounded-full"
                >
                  {item.badge}
                </Badge>
              )}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Role Assignment Modal */}
      <RoleAssignmentModal
        isOpen={showRoleAssignmentModal}
        onClose={() => setShowRoleAssignmentModal(false)}
        onSuccess={() => {
          // Başarılı atama sonrası yapılacaklar
          console.log('✅ Rol ataması başarılı')
        }}
      />


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
                src="/blackdu.webp" 
                alt="Logo" 
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
              className="h-10 w-10 p-0 rounded-full hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:rotate-90"
            >
              <X className="h-5 w-5" />
            </Button>
          ) : (
            <button 
              onClick={() => router.push('/dashboard/requests')}
              className="hover:opacity-80 transition-opacity"
            >
              <img 
                src="/blackdu.webp" 
                alt="Logo" 
                className="h-10 w-10 object-contain"
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
                  className="w-10 h-10 bg-white text-neutral-950 border-2 border-neutral-950 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-neutral-950 hover:text-white"
                >
                  <Plus className="h-5 w-5" />
                </Button>
                
                {/* Tooltip for Quick Create */}
                {hoveredItem === 'quick-create' && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <div className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
                      Hızlı Talep
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Site Manager için Rol Yönetimi - Icon Only */}
              {userRole === 'site_manager' && (
                <div className="relative">
                  <Button 
                    onClick={() => setShowRoleAssignmentModal(true)}
                    onMouseEnter={() => setHoveredItem('role-management')}
                    onMouseLeave={() => setHoveredItem(null)}
                    variant="outline"
                    className="w-full h-10 border-gray-300 text-gray-700 hover:bg-neutral-950 hover:text-white hover:border-neutral-950 rounded-full flex items-center justify-center transition-all duration-200"
                  >
                    <UserCog className="h-4 w-4" />
                  </Button>
                  
                  {/* Tooltip for Role Management */}
                  {hoveredItem === 'role-management' && (
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                      <div className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
                        Rol Yönetimi
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                  "bg-white hover:bg-neutral-950 text-neutral-950 hover:text-white border-2 border-neutral-950 font-medium rounded-full transition-all duration-200",
                  isMobileOpen ? "aspect-square w-full h-auto flex-col gap-2 p-3" : "w-full h-9 text-sm"
                )}
              >
                <Plus className={cn(isMobileOpen ? "h-6 w-6" : "h-4 w-4 mr-2")} />
                <span className={cn(isMobileOpen ? "text-xs" : "text-sm")}>Hızlı Talep</span>
              </Button>
              
              {/* Site Manager için Rol Yönetimi Butonu */}
              {userRole === 'site_manager' && (
                <Button 
                  onClick={() => {
                    setShowRoleAssignmentModal(true)
                    if (isMobileOpen) {
                      setIsMobileOpen(false)
                    }
                  }}
                  variant="outline"
                  className={cn(
                    "border-gray-300 text-gray-700 hover:bg-neutral-950 hover:text-white hover:border-neutral-950 font-medium rounded-full transition-all duration-200",
                    isMobileOpen ? "aspect-square w-full h-auto flex-col gap-2 p-3" : "w-full h-9 text-sm flex items-center justify-center gap-2"
                  )}
                >
                  <UserCog className={cn(isMobileOpen ? "h-6 w-6" : "h-4 w-4")} />
                  <span className={cn(isMobileOpen ? "text-xs" : "text-sm")}>Rol Yönetimi</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-4",
          isCollapsed && !isMobileOpen ? "px-2 space-y-1 overflow-visible" : isMobileOpen ? "px-6 grid grid-cols-2 gap-3 content-start overflow-y-auto" : "px-4 space-y-1 overflow-y-auto"
        )}>
          {getNavigation(pendingCount || 0, userRole).map((item) => (
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
                className="h-10 w-10 p-0 text-gray-400 hover:text-neutral-950 hover:bg-gray-100 rounded-full transition-all duration-200"
                onClick={handleLogout}
                onMouseEnter={() => setHoveredItem('logout')}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <LogOut className="h-4 w-4" />
              </Button>
              
              {/* Logout Tooltip */}
              {hoveredItem === 'logout' && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
                    Çıkış Yap
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
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
                className="w-full h-12 text-neutral-950 hover:text-neutral-950 hover:bg-gray-100 rounded-full font-medium transition-all duration-200"
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
              className="w-full h-10 text-neutral-950 hover:text-neutral-950 hover:bg-gray-100 rounded-full font-medium transition-all duration-200"
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
