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
      return <Badge className="bg-gray-900 text-white"><CheckCircle className="w-3 h-3 mr-1" />Aktif</Badge>
    case 'returned':
      return <Badge className="bg-gray-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />İade Edildi</Badge>
    case 'lost':
      return <Badge className="bg-gray-400 text-gray-900"><XCircle className="w-3 h-3 mr-1" />Kayıp</Badge>
    case 'damaged':
      return <Badge className="bg-gray-300 text-gray-900"><AlertTriangle className="w-3 h-3 mr-1" />Hasarlı</Badge>
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
    <div 
      className="bg-white rounded-3xl border border-gray-200 p-4 transition-all duration-200 cursor-pointer hover:border-gray-300 hover:shadow-md"
      onClick={handleRowClick}
    >
      {/* Desktop Layout */}
      <div className="hidden lg:grid gap-4 items-center" style={{gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr 100px'}}>
        {/* Kullanıcı */}
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-2xl ${item.owner_name ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <User className={`w-3 h-3 ${item.owner_name ? 'text-blue-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <div className="font-medium text-sm text-gray-800">
                {item.owner_name || item.user?.full_name || 'Belirtilmemiş'}
              </div>
              {item.owner_name && (item.pending_user_name || (item.user?.full_name && item.user.full_name !== 'Bekliyor')) && (
                <div className="text-xs text-gray-500">
                  2. Zimmetli: {item.pending_user_name || item.user?.full_name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ürün */}
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 rounded-2xl">
              <Package className="w-3 h-3 text-gray-600" />
            </div>
            <div>
              <div className="font-medium text-sm text-gray-800">{item.item_name}</div>
              {item.serial_number && (
                <div className="text-xs text-gray-500">S/N: {item.serial_number}</div>
              )}
            </div>
          </div>
          {isConsumable(item) && (
            <div className="flex items-center gap-1 mt-1 ml-8">
              <Flame className="w-3 h-3 text-orange-500" />
              <span className="text-xs text-orange-600">Sarf</span>
              <span className="text-xs text-gray-400 ml-1">
                (Kalan: {getRemainingQuantity(item)} {item.unit})
              </span>
            </div>
          )}
        </div>

        {/* Miktar */}
        <div>
          <span className="font-semibold text-sm text-gray-900">{item.quantity} {item.unit}</span>
        </div>

        {/* Tarih */}
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 rounded-2xl">
              <Calendar className="w-3 h-3 text-black" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-gray-800">
                {new Date(item.assigned_date).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Talep No */}
        <div>
          {item.purchase_request ? (
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-2xl">
                <FileText className="w-3 h-3 text-black" />
              </div>
              <span className="font-medium text-sm text-gray-800">{item.purchase_request.request_number}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>

        {/* Durum */}
        <div>
          {getStatusBadge(item.status)}
        </div>

        {/* İşlem */}
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg inline-flex items-center justify-center transition-colors">
                <MoreVertical className="h-4 w-4 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white z-[100]">
              <DropdownMenuItem
                onClick={handleTeslimPDF}
                className="cursor-pointer hover:bg-gray-100"
              >
                <FileText className="w-4 h-4 mr-2 text-gray-600" />
                <span className="text-gray-900">Teslim Tesellüm PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSayimPDF}
                className="cursor-pointer hover:bg-gray-100"
              >
                <FileText className="w-4 h-4 mr-2 text-gray-600" />
                <span className="text-gray-900">Sayım Tutanağı PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden space-y-3">
        {/* Header Row - Product & Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-normal text-gray-800 mb-1">{item.item_name}</div>
            {item.serial_number && (
              <div className="text-sm text-gray-600">S/N: {item.serial_number}</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {getStatusBadge(item.status)}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg flex items-center justify-center transition-colors">
                    <MoreVertical className="h-4 w-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white z-[100]">
                  <DropdownMenuItem
                    onClick={handleTeslimPDF}
                    className="cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-2 text-gray-600" />
                    <span>Teslim PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSayimPDF}
                    className="cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-2 text-gray-600" />
                    <span>Sayım PDF</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Kullanıcı */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Kullanıcı</div>
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-lg ${item.owner_name ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <User className={`w-3 h-3 ${item.owner_name ? 'text-blue-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <span className="font-medium text-gray-800 text-xs">
                  {item.owner_name || item.user?.full_name || 'Belirtilmemiş'}
                </span>
                {item.owner_name && (item.pending_user_name || (item.user?.full_name && item.user.full_name !== 'Bekliyor')) && (
                  <div className="text-[10px] text-gray-500">
                    2. Zimmetli: {item.pending_user_name || item.user?.full_name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Miktar */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Miktar</div>
            <div className="flex items-center gap-2">
              <div className="p-1 bg-gray-100 rounded-lg">
                <Package className="w-3 h-3 text-gray-600" />
              </div>
              <span className="font-medium text-gray-800 text-xs">
                {item.quantity} {item.unit}
              </span>
            </div>
          </div>

          {/* Tarih */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Tarih</div>
            <div className="flex items-center gap-2">
              <div className="p-1 bg-gray-100 rounded-lg">
                <Calendar className="w-3 h-3 text-black" />
              </div>
              <span className="font-medium text-gray-800 text-xs">
                {new Date(item.assigned_date).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'short'
                })}
              </span>
            </div>
          </div>

          {/* Talep No */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Talep No</div>
            <div className="flex items-center gap-2">
              <div className="p-1 bg-gray-100 rounded-lg">
                <FileText className="w-3 h-3 text-black" />
              </div>
              <span className="font-medium text-gray-800 text-xs">
                {item.purchase_request?.request_number || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Consumable indicator */}
        {isConsumable(item) && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-orange-600 font-medium">Sarf Malzemesi</span>
            <span className="text-xs text-gray-400 ml-auto">
              Kalan: {getRemainingQuantity(item)} {item.unit}
            </span>
          </div>
        )}
      </div>
    </div>
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
    
    return {
      totalItems: activeItems.length,
      totalQuantity,
      uniqueUsers
    }
  }, [inventoryItems])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-2 sm:px-6 py-3 sm:py-6">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/3 sm:w-1/4"></div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-6">
              <div className="h-20 sm:h-32 bg-gray-200 rounded-xl"></div>
              <div className="h-20 sm:h-32 bg-gray-200 rounded-xl"></div>
              <div className="h-20 sm:h-32 bg-gray-200 rounded-xl"></div>
            </div>
            <div className="h-48 sm:h-64 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              {userRole === 'site_manager' ? 'Oluşturduğum Zimmetler' : 'Tüm Zimmetler'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {userRole === 'site_manager' 
                ? 'Oluşturduğunuz zimmetleri görüntüleyin'
                : 'Kullanıcılara atanmış tüm ürünleri görüntüleyin'
              }
            </p>
          </div>
        </div>

        {/* Stats Cards - Desktop: 3 columns, Mobile: 3 compact cards in row */}
        <div className="grid grid-cols-3 md:grid-cols-3 gap-1.5 sm:gap-6">
          <Card className="bg-white shadow-sm rounded-xl sm:rounded-2xl border border-gray-100">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 sm:w-7 sm:h-7 text-gray-700" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Toplam Zimmet</p>
                  <p className="text-lg sm:text-3xl font-bold text-gray-900">{stats.totalItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm rounded-xl sm:rounded-2xl border border-gray-100">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-gray-700" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Toplam Adet</p>
                  <p className="text-lg sm:text-3xl font-bold text-gray-900">{stats.totalQuantity}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm rounded-xl sm:rounded-2xl border border-gray-100">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 sm:w-7 sm:h-7 text-gray-700" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Kullanıcı Sayısı</p>
                  <p className="text-lg sm:text-3xl font-bold text-gray-900">{stats.uniqueUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card className="bg-white shadow-sm rounded-xl sm:rounded-2xl border border-gray-100">
          <CardHeader className="px-2 py-2.5 sm:p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
              <CardTitle className="text-base sm:text-xl font-semibold text-gray-900">
                Zimmet Listesi
              </CardTitle>
              
              {/* Search */}
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <Input
                  type="text"
                  placeholder="Ürün, seri no, kullanıcı ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 sm:pl-10 pr-9 h-9 sm:h-10 rounded-lg sm:rounded-xl text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {paginatedItems.length === 0 ? (
              <div className="text-center py-10 sm:py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Package className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  Zimmet Kaydı Bulunamadı
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  {searchQuery 
                    ? 'Arama kriterlerinize uygun kayıt bulunamadı.' 
                    : userRole === 'site_manager'
                      ? 'Henüz hiç zimmet oluşturmadınız.'
                      : 'Henüz hiç zimmet kaydı yok.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-2 sm:p-4">
                {/* Desktop Header - Hidden on mobile */}
                <div className="hidden lg:grid gap-4 px-4 pb-3 border-b border-gray-200" style={{gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1fr 1fr 100px'}}>
                  <div className="text-xs font-medium text-black uppercase tracking-wider">Kullanıcı</div>
                  <div className="text-xs font-medium text-black uppercase tracking-wider">Ürün</div>
                  <div className="text-xs font-medium text-black uppercase tracking-wider">Miktar</div>
                  <div className="text-xs font-medium text-black uppercase tracking-wider">Tarih</div>
                  <div className="text-xs font-medium text-black uppercase tracking-wider">Talep No</div>
                  <div className="text-xs font-medium text-black uppercase tracking-wider">Durum</div>
                  <div className="text-xs font-medium text-black uppercase tracking-wider text-right">İşlem</div>
                </div>

                {/* Rows - Memoized component kullanılıyor */}
                {paginatedItems.map((item) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    onRowClick={handleRowClick}
                    onExportPDF={handleExportPDF}
                  />
                ))}
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 sm:px-6 py-2.5 sm:py-4 border-t border-gray-100">
                <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
                  {filteredItems.length} kayıt · Sayfa {currentPage}/{totalPages}
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg sm:rounded-xl h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm"
                  >
                    Önceki
                  </Button>
                  
                  <div className="hidden sm:flex items-center gap-1">
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
                              ? 'bg-gray-900 text-white hover:bg-gray-800' 
                              : ''
                          }`}
                        >
                          {page}
                        </Button>
                      )
                    })}
                  </div>
                  
                  {/* Mobile: Simple page indicator */}
                  <div className="flex sm:hidden items-center gap-1 px-3">
                    <span className="text-sm font-medium text-gray-900">{currentPage}</span>
                    <span className="text-sm text-gray-400">/</span>
                    <span className="text-sm text-gray-500">{totalPages}</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg sm:rounded-xl h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm"
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
    </div>
  )
}
