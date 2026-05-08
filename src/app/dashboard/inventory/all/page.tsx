'use client'

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Package, 
  Search, 
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Flame,
  MoreVertical,
  FileText,
  Plus,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import CreateZimmetModal from '@/components/CreateZimmetModal'
import ZimmetDetailModal from './components/ZimmetDetailModal'

interface InventoryItem {
  id: string
  item_name: string
  quantity: number
  unit: string
  assigned_date: string
  status: 'active' | 'returned' | 'lost' | 'damaged'
  notes: string
  category: string | null
  consumed_quantity: number
  serial_number?: string
  owner_name?: string
  owner_email?: string
  pending_user_name?: string
  pending_user_email?: string
  user: {
    id: string
    full_name: string
    email: string
  }
  assigned_by_profile?: {
    full_name: string
    email: string
  }
  purchase_request?: {
    request_number: string
    id: string
  }
}

// Status badge helper - component dışında tanımlandığı için her render'da yeniden oluşmaz
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-[#00E676] text-white"><CheckCircle className="w-3 h-3 mr-1" />Aktif</Badge>
    case 'returned':
      return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />İade Edildi</Badge>
    case 'lost':
      return <Badge className="bg-gray-400 text-gray-900"><XCircle className="w-3 h-3 mr-1" />Kayıp</Badge>
    case 'damaged':
      return <Badge className="bg-orange-500 text-white"><AlertTriangle className="w-3 h-3 mr-1" />Hasarlı</Badge>
    default:
      return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>
  }
}

const isConsumable = (item: InventoryItem) => {
  return item.category === 'kontrollü sarf' || item.category === 'sarf malzemesi'
}

const getRemainingQuantity = (item: InventoryItem) => {
  return item.quantity - (item.consumed_quantity || 0)
}

// Memoized Row Component - sadece item veya callback değişirse re-render olur
interface InventoryRowProps {
  item: InventoryItem
  onRowClick: (id: string) => void
  onExportPDF: (item: InventoryItem, type: 'teslim' | 'sayim') => void
}

const InventoryRow = memo(function InventoryRow({ item, onRowClick, onExportPDF }: InventoryRowProps) {
  const handleRowClick = useCallback(() => {
    onRowClick(item.id)
  }, [item.id, onRowClick])

  const handleTeslimPDF = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onExportPDF(item, 'teslim')
  }, [item, onExportPDF])

  const handleSayimPDF = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onExportPDF(item, 'sayim')
  }, [item, onExportPDF])

  return (
    <button
      type="button"
      onClick={handleRowClick}
      className="group relative w-full bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-200 text-left hover:border-[#00E676]/30 hover:shadow-lg hover:-translate-y-1"
    >
      {/* Image/Icon Area */}
      <div className="relative w-full aspect-[16/9] sm:aspect-square flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 transition-all duration-200">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white shadow-md group-hover:shadow-lg transition-all duration-200 group-hover:scale-110">
          <Package className="w-8 h-8 text-gray-400 group-hover:text-[#00E676] transition-colors duration-200" />
        </div>

        {/* Status Badge - Top Right */}
        <div className="absolute top-3 right-3">
          {getStatusBadge(item.status)}
        </div>

        {/* Consumable Badge - Top Left */}
        {isConsumable(item) && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-[#00E676] text-white text-xs">
              <Flame className="w-3 h-3 mr-1" />
              Sarf
            </Badge>
          </div>
        )}

        {/* Hover Overlay with Actions */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/5">
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleTeslimPDF}
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all hover:scale-110"
              title="Teslim PDF"
            >
              <FileText className="w-5 h-5 text-[#00E676]" />
            </button>
            <button
              onClick={handleSayimPDF}
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all hover:scale-110"
              title="Sayım PDF"
            >
              <FileText className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {/* Product Name */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-2 text-gray-900 group-hover:text-[#00E676] transition-colors duration-200">
          {item.item_name}
        </h3>

        {/* Serial Number */}
        {item.serial_number && (
          <p className="text-xs text-gray-500 mb-3 font-mono">
            S/N: {item.serial_number}
          </p>
        )}

        {/* Info Grid */}
        <div className="space-y-2.5 mb-3">
          {/* User */}
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${item.owner_name ? 'bg-[#00E676]/10' : 'bg-gray-100'}`}>
              <User className={`w-3.5 h-3.5 ${item.owner_name ? 'text-[#00E676]' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">
                {item.owner_name || item.user?.full_name || 'Belirtilmemiş'}
              </div>
              {item.owner_name && (item.pending_user_name || (item.user?.full_name && item.user.full_name !== 'Bekliyor')) && (
                <div className="text-[10px] text-gray-500 truncate">
                  2. Zimmetli: {item.pending_user_name || item.user?.full_name}
                </div>
              )}
            </div>
          </div>

          {/* Quantity & Date */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-1">
              <div className="p-1.5 bg-[#00E676]/10 rounded-lg">
                <Package className="w-3.5 h-3.5 text-[#00E676]" />
              </div>
              <span className="text-xs font-semibold text-gray-900">
                {item.quantity} {item.unit}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <div className="p-1.5 bg-[#00E676]/10 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-[#00E676]" />
              </div>
              <span className="text-xs text-gray-600">
                {new Date(item.assigned_date).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'short'
                })}
              </span>
            </div>
          </div>

          {/* Request Number */}
          {item.purchase_request && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#00E676]/10 rounded-lg flex-shrink-0">
                <FileText className="w-3.5 h-3.5 text-[#00E676]" />
              </div>
              <span className="text-xs font-medium text-gray-800">
                {item.purchase_request.request_number}
              </span>
            </div>
          )}

          {/* Consumable Info */}
          {isConsumable(item) && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-600">Kalan:</span>
              <span className="text-xs font-semibold text-[#00E676]">
                {getRemainingQuantity(item)} {item.unit}
              </span>
            </div>
          )}
        </div>

        {/* Action Area */}
        <div className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-gray-100 text-gray-700 group-hover:bg-gray-900 group-hover:text-white transition-all duration-200">
          <FileText className="w-4 h-4" />
          <span>Detayları Gör</span>
        </div>
      </div>
    </button>
  )
})

export default function AllInventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 30
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedZimmetId, setSelectedZimmetId] = useState<string | null>(null)
  const [hoveredBar, setHoveredBar] = useState<{ name: string; count: number } | null>(null)
  const supabase = createClient()
  const { showToast } = useToast()
  const router = useRouter()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced search - 150ms bekle (daha responsive)
  useEffect(() => {
    // Eğer search temizlendiyse anında güncelle
    if (!searchQuery.trim()) {
      setDebouncedSearch('')
      setCurrentPage(1)
      return
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setCurrentPage(1)
    }, 150)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery])

  // Search temizleme fonksiyonu
  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setDebouncedSearch('')
    setCurrentPage(1)
  }, [])

  useEffect(() => {
    checkUserRole()
  }, [])

  useEffect(() => {
    if (userRole && userRole !== 'user') {
      fetchAllInventory()
    }
  }, [userRole])

  // Filtered items - useMemo ile hesapla, state değil
  // Türkçe karakter desteği için toLocaleLowerCase('tr-TR') kullanılıyor
  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return inventoryItems
    }
    const query = debouncedSearch.toLocaleLowerCase('tr-TR')
    return inventoryItems.filter(item =>
      item.item_name.toLocaleLowerCase('tr-TR').includes(query) ||
      item.user?.full_name?.toLocaleLowerCase('tr-TR').includes(query) ||
      item.user?.email?.toLocaleLowerCase('tr-TR').includes(query) ||
      item.owner_name?.toLocaleLowerCase('tr-TR').includes(query) ||
      item.owner_email?.toLocaleLowerCase('tr-TR').includes(query) ||
      item.pending_user_name?.toLocaleLowerCase('tr-TR').includes(query) ||
      item.pending_user_email?.toLocaleLowerCase('tr-TR').includes(query) ||
      item.serial_number?.toLocaleLowerCase('tr-TR').includes(query) ||
      item.purchase_request?.request_number?.toLocaleLowerCase('tr-TR').includes(query)
    )
  }, [debouncedSearch, inventoryItems])

  // Paginated items - useMemo ile hesapla
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredItems.slice(startIndex, endIndex)
  }, [filteredItems, currentPage, pageSize])

  const checkUserRole = async () => {
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

      if (profile?.role !== 'warehouse_manager' && profile?.role !== 'admin' && profile?.role !== 'manager' && profile?.role !== 'site_manager') {
        showToast('Bu sayfaya erişim yetkiniz yok', 'error')
        router.push('/dashboard')
        return
      }

      setUserRole(profile.role)
    } catch (error) {
      console.error('Rol kontrolü hatası:', error)
      router.push('/dashboard')
    }
  }

  const fetchAllInventory = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // User inventory'den aktif zimmetleri al
      let query = supabase
        .from('user_inventory')
        .select(`
          *,
          user:user_id(id, full_name, email),
          assigned_by_profile:assigned_by(full_name, email),
          purchase_request:purchase_requests(request_number, id)
        `)
        .eq('status', 'active')

      // Site manager ise sadece kendi oluşturduğu zimmetleri göster
      if (userRole === 'site_manager') {
        query = query.eq('assigned_by', user.id)
      }

      const { data, error } = await query.order('assigned_date', { ascending: false })

      if (error) {
        console.error('Zimmet kayıtları alınamadı:', error)
        showToast('Zimmet kayıtları yüklenemedi', 'error')
        return
      }

      setInventoryItems(data || [])
    } catch (error) {
      console.error('Zimmet kayıtları yüklenirken hata:', error)
      showToast('Bir hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(filteredItems.length / pageSize)

  // PDF export handler - useCallback ile memoize edildi
  const handleExportPDF = useCallback(async (item: InventoryItem, type: 'teslim' | 'sayim') => {
    try {
      showToast('PDF oluşturuluyor...', 'info')
      
      const { generateTeslimPDF, generateSayimPDF } = await import('@/lib/pdf/zimmetPdfGenerator')
      
      if (type === 'teslim') {
        await generateTeslimPDF(item)
        showToast('Teslim Tesellüm PDF\'i oluşturuldu', 'success')
      } else {
        await generateSayimPDF(item)
        showToast('Sayım Tutanağı PDF\'i oluşturuldu', 'success')
      }
      
    } catch (error) {
      console.error('PDF export hatası:', error)
      showToast('PDF oluşturulamadı', 'error')
    }
  }, [showToast])

  // Row click handler - useCallback ile memoize edildi
  const handleRowClick = useCallback((id: string) => {
    setSelectedZimmetId(id)
    setShowDetailModal(true)
  }, [])

  const stats = useMemo(() => {
    const activeItems = inventoryItems.filter(item => item.status === 'active')
    const totalQuantity = activeItems.reduce((sum, item) => sum + item.quantity, 0)
    const uniqueUsers = new Set(activeItems.map(item => item.user?.id)).size
    
    // En çok zimmetlenen 5 ürünü hesapla
    const itemCounts = activeItems.reduce((acc, item) => {
      const itemName = item.item_name
      if (!acc[itemName]) {
        acc[itemName] = { name: itemName, count: 0 }
      }
      acc[itemName].count += 1
      return acc
    }, {} as Record<string, { name: string; count: number }>)
    
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    return {
      totalItems: activeItems.length,
      totalQuantity,
      uniqueUsers,
      topItems
    }
  }, [inventoryItems])

  if (loading) {
    return (
      <div className="px-0 pb-6 space-y-6 sm:space-y-8">
        <div className="animate-pulse px-4 pt-2 space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
            <div className="h-32 bg-gray-200 rounded-2xl"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-0 pb-6 space-y-6 sm:space-y-8">
      {/* Header - Desktop */}
      <div className="hidden sm:block px-4 pt-2 space-y-2">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">
            {userRole === 'site_manager' ? 'Oluşturduğum Zimmetler' : 'Tüm Zimmetler'}
          </h1>
          <p className="text-gray-600 mt-4 text-base">
            {userRole === 'site_manager' 
              ? 'Oluşturduğunuz zimmetleri görüntüleyin'
              : 'Kullanıcılara atanmış tüm ürünleri görüntüleyin'
            }
          </p>
        </div>
      </div>

      {/* Header - Mobile */}
      <div className="sm:hidden px-4 pt-2 space-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 pb-2 border-b-2 border-[#00E676] inline-block">
            {userRole === 'site_manager' ? 'Oluşturduğum Zimmetler' : 'Tüm Zimmetler'}
          </h1>
          <p className="text-gray-600 mt-4 text-sm">
            {userRole === 'site_manager' 
              ? 'Oluşturduğunuz zimmetleri görüntüleyin'
              : 'Kullanıcılara atanmış tüm ürünleri görüntüleyin'
            }
          </p>
        </div>
      </div>

      {/* Stats Cards - Desktop */}
      <div className="hidden sm:block px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Zimmet İstatistikleri */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">En Çok Zimmetlenen Ürünler</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-gray-900">{stats.totalItems}</p>
                    <span className="text-sm text-gray-500">toplam zimmet</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">İlk 5 ürün dağılımı</p>
                </div>
              </div>
              
              {/* Bar Chart */}
              <div className="flex items-end justify-between gap-2 h-28 relative">
                {stats.topItems && stats.topItems.length > 0 ? (
                  stats.topItems.map((item, i) => {
                    const maxCount = Math.max(...stats.topItems.map(t => t.count))
                    const height = (item.count / maxCount) * 100
                    const isHovered = hoveredBar?.name === item.name
                    
                    return (
                      <div 
                        key={i} 
                        className="flex-1 flex flex-col items-center gap-2 relative"
                        onMouseEnter={() => setHoveredBar(item)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        <div className="w-full flex items-end justify-center" style={{ height: '90px' }}>
                          <div 
                            className={`w-full rounded-t-lg transition-all duration-300 cursor-pointer ${
                              isHovered ? 'bg-[#00E676] shadow-lg scale-105' : 'bg-gray-900'
                            }`}
                            style={{ 
                              height: `${height}%`,
                              minHeight: '10px'
                            }}
                          />
                        </div>
                        
                        {/* Tooltip */}
                        {isHovered && (
                          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap z-10 shadow-lg">
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-gray-300">{item.count} zimmet</div>
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                              <div className="border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-[10px] font-medium text-gray-600 text-center line-clamp-1">
                          {item.name.length > 8 ? item.name.slice(0, 8) + '...' : item.name}
                        </p>
                      </div>
                    )
                  })
                ) : (
                  <div className="w-full text-center py-8 text-sm text-gray-400">
                    Henüz zimmet kaydı yok
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Toplam Performans - Gradient */}
          <Card className="bg-gradient-to-br from-[#00E676] to-[#00c46a] border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-white/80 mb-1">Toplam Performans</p>
                  <p className="text-3xl font-bold text-white">{stats.totalItems}</p>
                  <p className="text-xs text-white/70 mt-1">Aktif zimmet kayıtları</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/20">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <p className="text-xs text-white/70 mb-1">Toplam Adet</p>
                  <p className="text-xl font-bold text-white">{stats.totalQuantity}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <p className="text-xs text-white/70 mb-1">Kullanıcı</p>
                  <p className="text-xl font-bold text-white">{stats.uniqueUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Cards - Mobile */}
      <div className="sm:hidden px-4">
        <div className="space-y-3">
          {/* Zimmet İstatistikleri */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">En Çok Zimmetlenen</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                    <span className="text-xs text-gray-500">zimmet</span>
                  </div>
                </div>
              </div>
              
              {/* Bar Chart */}
              <div className="flex items-end justify-between gap-1.5 h-20 mb-2 relative">
                {stats.topItems && stats.topItems.length > 0 ? (
                  stats.topItems.map((item, i) => {
                    const maxCount = Math.max(...stats.topItems.map(t => t.count))
                    const height = (item.count / maxCount) * 100
                    
                    return (
                      <div 
                        key={i} 
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <div className="w-full flex items-end justify-center" style={{ height: '60px' }}>
                          <div 
                            className="w-full rounded-t-lg bg-gray-900"
                            style={{ 
                              height: `${height}%`,
                              minHeight: '8px'
                            }}
                          />
                        </div>
                        <p className="text-[8px] font-medium text-gray-600 text-center line-clamp-1">
                          {item.name.length > 6 ? item.name.slice(0, 6) + '...' : item.name}
                        </p>
                      </div>
                    )
                  })
                ) : (
                  <div className="w-full text-center py-4 text-xs text-gray-400">
                    Veri yok
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Toplam Performans - Gradient */}
          <Card className="bg-gradient-to-br from-[#00E676] to-[#00c46a] border-0 rounded-2xl shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-white/80 mb-1">Toplam Performans</p>
                  <p className="text-2xl font-bold text-white">{stats.totalItems}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                  <p className="text-[10px] text-white/70 mb-0.5">Toplam Adet</p>
                  <p className="text-base font-bold text-white">{stats.totalQuantity}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                  <p className="text-[10px] text-white/70 mb-0.5">Kullanıcı</p>
                  <p className="text-base font-bold text-white">{stats.uniqueUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search and Table - Desktop */}
      <div className="hidden sm:block">
        <Card className="bg-white shadow-sm rounded-2xl border border-gray-200">
          <CardHeader className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Zimmet Listesi
              </CardTitle>
              
              {/* Search */}
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Ürün, seri no, kullanıcı ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-10 rounded-xl text-sm border-gray-200 focus:border-[#00E676] focus:ring-[#00E676]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#00E676] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {paginatedItems.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 bg-[#00E676]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-[#00E676]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Zimmet Kaydı Bulunamadı
                </h3>
                <p className="text-sm text-gray-600">
                  {searchQuery 
                    ? 'Arama kriterlerinize uygun kayıt bulunamadı.' 
                    : userRole === 'site_manager'
                      ? 'Henüz hiç zimmet oluşturmadınız.'
                      : 'Henüz hiç zimmet kaydı yok.'
                  }
                </p>
              </div>
            ) : (
              <div className="p-4">
                {/* Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {paginatedItems.map((item) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      onRowClick={handleRowClick}
                      onExportPDF={handleExportPDF}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  {filteredItems.length} kayıt · Sayfa {currentPage}/{totalPages}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl h-9 px-4 text-sm border-gray-200 hover:bg-gray-50"
                  >
                    Önceki
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number
                      if (totalPages <= 5) {
                        page = i + 1
                      } else if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                      
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-xl w-9 h-9 p-0 ${
                            currentPage === page 
                              ? 'bg-[#00E676] text-white hover:bg-[#00c46a]' 
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl h-9 px-4 text-sm border-gray-200 hover:bg-gray-50"
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search and Table - Mobile */}
      <div className="sm:hidden px-4">
        <Card className="bg-white shadow-sm rounded-2xl border border-gray-200">
          <CardHeader className="p-4 border-b border-gray-100">
            <div className="space-y-3">
              <CardTitle className="text-base font-semibold text-gray-900">
                Zimmet Listesi
              </CardTitle>
              
              {/* Search */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Ürün, seri no, kullanıcı ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-10 rounded-xl text-sm border-gray-200 focus:border-[#00E676] focus:ring-[#00E676]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#00E676] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {paginatedItems.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 bg-[#00E676]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package className="w-8 h-8 text-[#00E676]" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  Zimmet Kaydı Bulunamadı
                </h3>
                <p className="text-sm text-gray-600">
                  {searchQuery 
                    ? 'Arama kriterlerinize uygun kayıt bulunamadı.' 
                    : userRole === 'site_manager'
                      ? 'Henüz hiç zimmet oluşturmadınız.'
                      : 'Henüz hiç zimmet kaydı yok.'
                  }
                </p>
              </div>
            ) : (
              <div className="p-3">
                {/* Cards Grid - Mobile */}
                <div className="grid grid-cols-2 gap-3">
                  {paginatedItems.map((item) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      onRowClick={handleRowClick}
                      onExportPDF={handleExportPDF}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Pagination - Mobile */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center gap-3 px-4 py-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  {filteredItems.length} kayıt · Sayfa {currentPage}/{totalPages}
                </div>
                
                <div className="flex items-center gap-2 w-full justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl h-9 px-6 text-sm border-gray-200 hover:bg-gray-50"
                  >
                    Önceki
                  </Button>
                  
                  <div className="flex items-center gap-2 px-4">
                    <span className="text-sm font-medium text-gray-900">{currentPage}</span>
                    <span className="text-sm text-gray-400">/</span>
                    <span className="text-sm text-gray-500">{totalPages}</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-xl h-9 px-6 text-sm border-gray-200 hover:bg-gray-50"
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Zimmet Modal */}
      <CreateZimmetModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          fetchAllInventory()
        }}
        showToast={showToast}
      />

      {/* Zimmet Detail Modal */}
      <ZimmetDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedZimmetId(null)
        }}
        zimmetId={selectedZimmetId}
        onSuccess={() => {
          fetchAllInventory()
        }}
        showToast={showToast}
      />
    </div>
  )
}
