'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Building2,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  Truck,
  CreditCard,
  BarChart3,
  UserCheck,
  ChevronLeft
} from 'lucide-react'

interface NavItem {
  title: string
  href?: string
  icon: React.ElementType
  badge?: string
  children?: NavItem[]
}

const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    title: 'Talepler',
    href: '/dashboard/requests',
    icon: FileText
  },
  {
    title: 'Şantiyeler',
    href: '/dashboard/sites',
    icon: Building2
  },
  {
    title: 'Ayarlar',
    href: '/dashboard/settings',
    icon: Settings
  }
]

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
  
  // External prop varsa onu kullan, yoksa internal state kullan
  const isMobileOpen = externalSetIsMobileOpen ? externalIsMobileOpen : internalIsMobileOpen
  const setIsMobileOpen = externalSetIsMobileOpen || setInternalIsMobileOpen
  const pathname = usePathname()
  const router = useRouter()

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

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed
    setIsCollapsed(newCollapsed)
    onCollapsedChange?.(newCollapsed)
  }

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen)
  }

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
              "w-full justify-start h-12 transition-all duration-200 rounded-xl bg-transparent border border-transparent hover:bg-white/10 hover:border hover:border-white hover:text-gray-300 text-gray-300 text-sm font-light mb-1",
              isCollapsed ? "px-2 justify-center w-full" : "px-4",
              level > 0 && "ml-4 w-[calc(100%-1rem)]",
              active && "bg-white/20 text-white font-medium"
            )}
            onClick={() => toggleExpanded(item.title)}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", !isCollapsed && "mr-3")} />
            {(!isCollapsed || isMobileOpen) && (
              <>
                <span className="flex-1 text-left font-light">{item.title}</span>
                {/* Chevron'u sadece desktop'ta göster */}
                <div className="hidden lg:block">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </>
            )}
          </Button>
          {isExpanded && (!isCollapsed || isMobileOpen) && (
            <div className="space-y-1">
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
            "w-full justify-start h-12 transition-all duration-200 rounded-xl bg-transparent border border-transparent hover:bg-white/10 hover:border hover:border-white hover:text-gray-300 text-gray-300 text-sm font-light mb-1",
            isCollapsed ? "px-2 justify-center w-12" : "px-4",
            level > 0 && "ml-4 w-[calc(100%-1rem)]",
            active && "bg-white/20 text-white font-medium"
          )}
          onClick={() => {
            // Mobilde sidebar'ı kapat
            if (isMobileOpen) {
              setIsMobileOpen(false)
            }
          }}
        >
          <item.icon className={cn("h-4 w-4 shrink-0", !isCollapsed && "mr-3")} />
          {(!isCollapsed || isMobileOpen) && (
            <>
              <span className="flex-1 text-left font-extralight">{item.title}</span>
              {item.badge && (
                <Badge variant="secondary" className="h-5 text-xs bg-white/20 text-white rounded-full border-0">
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed top-4 bottom-4 z-50 flex flex-col transition-all duration-300",
        "bg-black backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl",
        // Desktop
        "hidden lg:flex",
        isCollapsed ? "w-16 left-4" : "w-64 left-4",
        // Mobile
        "lg:flex",
        isMobileOpen ? "flex right-4 left-4 w-auto" : "hidden",
        className
      )}>
        {/* Logo and Toggle */}
        <div className={cn(
          "px-4 pt-6 pb-4 flex items-center",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {(!isCollapsed || isMobileOpen) && (
            <div className="flex items-center pl-4">
              <img 
                src="/d.png" 
                alt="Logo" 
                className="h-8 w-auto"
              />
            </div>
          )}
          
          {/* Desktop: Collapse Toggle, Mobile: Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={isMobileOpen ? () => setIsMobileOpen(false) : handleToggleCollapse}
            className="h-8 w-8 p-0 rounded-lg bg-transparent border border-transparent hover:bg-white/10 hover:border hover:border-white hover:text-gray-400 text-gray-400 transition-all duration-200"
          >
            {isMobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",
          isCollapsed ? "px-2" : "px-4"
        )}>
          {navigation.map((item) => (
            <NavItemComponent key={item.title} item={item} />
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4">
          {isCollapsed && !isMobileOpen ? (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full h-10 p-0 rounded-lg bg-transparent border border-transparent hover:bg-white/10 hover:border hover:border-white hover:text-gray-400 text-gray-400 transition-all duration-200" 
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-xs font-medium text-white">EY</span>
              </div>
             
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 rounded-lg bg-transparent border border-transparent hover:bg-white/10 hover:border hover:border-white hover:text-gray-400 text-gray-400 transition-all duration-200" 
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
