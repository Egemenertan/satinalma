'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loading } from '@/components/ui/loading'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'

import { 
  Search, 
  FileText, 
  Building2, 
  Calendar,
  AlertTriangle,
  Clock,
  Target,
  Package,
  TrendingUp,
  User,
  ArrowUpDown,
  Check,
  Truck,
  Bell,
  RotateCcw,
  Box,
  Hash,
  MoreVertical,
  Trash2
} from 'lucide-react'

interface PurchaseRequestItem {
  id: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  brand?: string
  material_class?: string
  material_group?: string
  specifications?: string
}

interface PurchaseRequest {
  id: string
  request_number: string
  title: string
  description?: string
  site_name: string
  site_id: string
  urgency_level: 'low' | 'normal' | 'high' | 'critical'
  status: string // Basitleştirdik - artık database'den ne geliyorsa onu kullanıyoruz
  requested_by: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  delivery_date?: string
  supplier_id?: string
  created_at: string
  updated_at: string
  sent_quantity?: number
  notifications?: string[] // Bildirimler: ["iade var", "acil"] gibi
  // Relations
  sites?: Array<{
    name: string
  }>
  profiles?: {
    full_name: string
    email: string
  }
}

interface Filters {
  search: string
  status: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

// SWR fetcher fonksiyonu
const fetcherWithAuth = async (url: string) => {
  const supabase = createClient()
  
  // Kullanıcı bilgilerini çek
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  // Kullanıcı rolünü çek
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id')
    .eq('id', user.id)
    .single()

  return { user, profile, supabase }
}

// Kullanıcı rolü için ayrı fetcher
const fetchUserRole = async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id')
    .eq('id', user.id)
    .single()

  return profile?.role || ''
}

// Purchase requests fetcher
const fetchPurchaseRequests = async (key: string) => {
  const [_, currentPage, pageSize] = key.split('/')
  const page = parseInt(currentPage)
  const size = parseInt(pageSize)
  
  const { user, profile, supabase } = await fetcherWithAuth('auth')
  
  let countQuery = supabase
    .from('purchase_requests')
    .select('id', { count: 'exact', head: true })
  
  // Purchasing officer tüm sitelerin taleplerini görebilir ve sadece belirli statuslardakileri görür
  if (profile?.role === 'purchasing_officer') {
    countQuery = countQuery.in('status', ['satın almaya gönderildi', 'sipariş verildi', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered'])
  } else {
    // Diğer tüm roller (site_manager, site_personnel, santiye_depo) sadece kendi sitelerinin taleplerini görebilir
    if (profile?.site_id) {
      countQuery = countQuery.eq('site_id', profile.site_id)
    }
  }
  
  // Önce toplam sayıyı al
  const { count, error: countError } = await countQuery
  
  if (countError) {
    throw new Error(countError.message)
  }
  
  // Pagination ile veriyi çek
  const from = (page - 1) * size
  const to = from + size - 1
  
  let requestsQuery = supabase
    .from('purchase_requests')
    .select(`
      id,
      request_number,
      title,
      status,
      urgency_level,
      created_at,
      delivery_date,
      requested_by,
      site_name,
      site_id,
      sent_quantity,
      notifications,
      sites:site_id (
        name
      )
    `)
    .range(from, to)
    .order('created_at', { ascending: false })
  
  // Purchasing officer tüm sitelerin taleplerini görebilir ve sadece belirli statuslardakileri görür
  if (profile?.role === 'purchasing_officer') {
    requestsQuery = requestsQuery.in('status', ['satın almaya gönderildi', 'sipariş verildi', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered'])
  } else {
    // Diğer tüm roller (site_manager, site_personnel, santiye_depo) sadece kendi sitelerinin taleplerini görebilir
    if (profile?.site_id) {
      requestsQuery = requestsQuery.eq('site_id', profile.site_id)
    }
  }
  
  const { data: requests, error } = await requestsQuery
  
  if (error) {
    console.error('Purchase requests fetch error:', {
      error,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code
    })
    throw new Error('Satın alma talepleri yüklenirken hata oluştu')
  }

  const formattedRequests = await Promise.all((requests || []).map(async request => {
    // Profile bilgisini useOfferData hook'u gibi işle
    let processedProfiles = null
    
    if (request.requested_by) {
      try {
        // Önce profiles tablosundan dene (useOfferData hook'u gibi)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', request.requested_by)
          .single()

        if (!profileError && profileData) {
          // Eğer full_name boş ise email'den isim oluşturmaya çalış
          let displayName = profileData.full_name
          
          if (!displayName || displayName.trim() === '') {
            // Email'den isim oluştur (@ işaretinden öncesini al)
            if (profileData.email) {
              displayName = profileData.email.split('@')[0]
                .replace(/[._-]/g, ' ') // . _ - karakterlerini boşlukla değiştir
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Her kelimenin ilk harfini büyüt
                .join(' ')
            } else {
              displayName = 'İsimsiz Kullanıcı'
            }
          }
          
          processedProfiles = {
            full_name: displayName,
            email: profileData.email
          }
        } else {
          // Eğer profiles'tan bulunamazsa, fallback (useOfferData hook'u gibi olmasa da basit fallback)
          processedProfiles = { 
            full_name: 'Kullanıcı bulunamadı', 
            email: '' 
          }
        }
      } catch (error) {
        console.error('Profile fetch error:', error)
        processedProfiles = { full_name: 'Kullanıcı bulunamadı', email: '' }
      }
    } else {
      processedProfiles = { full_name: 'Bilinmiyor', email: '' }
    }
    
    // Sadece database'den gelen status'u kullan - Supabase trigger'ları otomatik güncelliyor
    const formattedRequest = {
      ...request,
      profiles: processedProfiles,
      request_number: request.request_number ? 
        (() => {
          const parts = request.request_number.split('-')
          if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1] // Son rakamsal kısım (1009)
            const secondLastPart = parts[parts.length - 2] // Önceki kısım (N1ZV1O)
            const lastTwoChars = secondLastPart.slice(-2) // Son 2 hane (VO)
            return `${lastTwoChars}-${lastPart}` // VO-1009 (6 basamak)
          }
          return request.request_number
        })() :
        `REQ-${request.id.slice(-6)}`, // Fallback
      updated_at: request.created_at
      // status zaten database'den doğru geliyor, değiştirmeye gerek yok
    }
    
    return formattedRequest
  })) as PurchaseRequest[]

  return { requests: formattedRequests, totalCount: count || 0 }
}

export default function PurchaseRequestsTable() {
  const router = useRouter()
  const { showToast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [approving, setApproving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>(() => {
    // localStorage'dan son seçilen filtreyi al, yoksa 'approval_pending' kullan
    if (typeof window !== 'undefined') {
      return localStorage.getItem('purchase_requests_active_tab') || 'approval_pending'
    }
    return 'approval_pending'
  })

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  // Tooltip state'leri
  const [hoveredRequestId, setHoveredRequestId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [requestMaterials, setRequestMaterials] = useState<{ [requestId: string]: PurchaseRequestItem[] }>({})
  const [loadingMaterials, setLoadingMaterials] = useState<{ [requestId: string]: boolean }>({})
  
  // Dropdown state'leri
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  
  // Delete modal state'leri
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [requestToDelete, setRequestToDelete] = useState<PurchaseRequest | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // activeTab değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('purchase_requests_active_tab', activeTab)
    }
  }, [activeTab])

  // Malzeme bilgilerini çekme fonksiyonu
  const fetchRequestMaterials = async (requestId: string) => {
    if (requestMaterials[requestId] || loadingMaterials[requestId]) {
      return // Zaten yüklendi veya yükleniyor
    }

    setLoadingMaterials(prev => ({ ...prev, [requestId]: true }))

    try {
      const supabase = createClient()
      const { data: materials, error } = await supabase
        .from('purchase_request_items')
        .select(`
          id,
          item_name,
          quantity,
          unit,
          unit_price,
          brand,
          material_class,
          material_group,
          specifications
        `)
        .eq('purchase_request_id', requestId)
        .order('item_name')

      if (error) {
        console.error('Malzeme bilgileri çekilirken hata:', error)
        return
      }

      setRequestMaterials(prev => ({
        ...prev,
        [requestId]: materials || []
      }))
    } catch (error) {
      console.error('Malzeme bilgileri çekilirken hata:', error)
    } finally {
      setLoadingMaterials(prev => ({ ...prev, [requestId]: false }))
    }
  }

  // SWR ile kullanıcı rolünü hızlı yükle
  const { data: userRole } = useSWR(
    'user_role',
    fetchUserRole,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 300000, // 5 dakika cache
      errorRetryCount: 3,
      fallbackData: '', // Başlangıç değeri
    }
  )

  // SWR ile cache'li veri çekme
  const { data, error, isLoading, mutate: refreshData } = useSWR(
    `purchase_requests/${currentPage}/${pageSize}`,
    fetchPurchaseRequests,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000, // 1 saniye cache - daha hızlı güncelleme
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      refreshInterval: 30000, // 30 saniyede bir otomatik yenile
    }
  )

  const requests = data?.requests || []
  const totalCount = data?.totalCount || 0

  // Real-time updates için subscription
  useEffect(() => {
    const supabase = createClient()
    
    // Purchase requests tablosundaki değişiklikleri dinle
    const subscription = supabase
      .channel('purchase_requests_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'purchase_requests' 
        }, 
        (payload) => {
          console.log('📡 Real-time update received:', payload)
          
          // Global cache invalidation kullan
          invalidatePurchaseRequestsCache()
          
          // SWR cache'ini de manuel olarak temizle
          mutate('purchase_requests_stats')
          mutate('pending_requests_count')
          
          // Tüm purchase_requests cache'lerini temizle
          mutate((key) => typeof key === 'string' && key.startsWith('purchase_requests/'))
          
          // Veriyi yenile
          refreshData()
          
          console.log('✅ PurchaseRequestsTable cache temizlendi ve veri yenilendi')
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [refreshData])

  // Filter uygulaması
  const filteredRequests = requests.filter((req: any) => {
    // Site manager için tab bazlı filtreleme
    if (userRole === 'site_manager' && activeTab === 'approval_pending') {
      if (req.status !== 'kısmen gönderildi' && req.status !== 'depoda mevcut değil') {
        return false
      }
    }
    
    if (filters.status !== 'all' && req.status !== filters.status) return false
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      return (
        req.request_number?.toLowerCase().includes(searchTerm) ||
        req.title?.toLowerCase().includes(searchTerm) ||
        req.description?.toLowerCase().includes(searchTerm)
      )
    }
    return true
  }).sort((a: any, b: any) => {
    const aVal = a[filters.sortBy] || ''
    const bVal = b[filters.sortBy] || ''
    
    if (filters.sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })



  const getStatusBadge = (status: string, notifications?: string[]) => {
    // Purchasing officer için özel görünüm - satın almaya gönderilmiş talepler "Beklemede" olarak görünür
    if (userRole === 'purchasing_officer' && 
        (status === 'satın almaya gönderildi' || status === 'eksik malzemeler talep edildi')) {
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-0 rounded-full text-xs font-medium px-2 py-1">
            Beklemede
          </Badge>
        {notifications && notifications.includes('iade var') && (
          <div className="flex flex-wrap gap-1">
            <Badge 
              variant="outline" 
              className=" text-red-700 border-0 rounded-full text-xs font-medium px-1 py-0.5"
            >
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-red-600" />
                İade Var
              </span>
            </Badge>
          </div>
        )}
        </div>
      )
    }

    const statusConfig = {
      // Temel statuslar
      draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-700 border-0' },
      pending: { label: 'Beklemede', className: 'bg-yellow-100 text-yellow-800 border-0' },
      'onay bekliyor': { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      'teklif bekliyor': { label: 'Teklif Bekliyor', className: 'bg-purple-100 text-purple-800 border-0' },
      'onaylandı': { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-0' },
      'satın almaya gönderildi': { label: 'Satın Almaya Gönderildi', className: 'bg-blue-100 text-blue-800 border-0' },
      'sipariş verildi': { label: 'Sipariş Verildi', className: 'bg-green-100 text-green-800 border-0' },
      'ordered': { label: 'Sipariş Verildi', className: 'bg-green-100 text-green-800 border-0' },
      'gönderildi': { label: 'Gönderildi', className: 'bg-emerald-100 text-emerald-800 border-0' },
      'kısmen gönderildi': { label: 'Kısmen Gönderildi', className: 'bg-orange-100 text-orange-800 border-0' },
      'kısmen teslim alındı': { label: 'Kısmen Teslim Alındı', className: 'bg-orange-100 text-orange-800 border-0' },
      'depoda mevcut değil': { label: 'Depoda Mevcut Değil', className: 'bg-red-100 text-red-800 border-0' },
      'teslim alındı': { label: 'Teslim Alındı', className: 'bg-green-100 text-green-800 border-0' },
      'iade var': { label: 'İade Var', className: 'bg-orange-100 text-orange-800 border-0' },
      'iade nedeniyle sipariş': { label: 'İade Nedeniyle Sipariş', className: 'bg-purple-100 text-purple-800 border-0' },
      'reddedildi': { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-0' },
      rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-0' },
      cancelled: { label: 'İptal Edildi', className: 'bg-gray-100 text-gray-600 border-0' },
      
      // Eski statuslar için backward compatibility
      'şantiye şefi onayladı': { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      awaiting_offers: { label: 'Teklif Bekliyor', className: 'bg-purple-100 text-purple-800 border-0' },
      approved: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-0' },
      delivered: { label: 'Teslim Alındı', className: 'bg-green-100 text-green-800 border-0' },
      'eksik onaylandı': { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      'alternatif onaylandı': { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-0' },
      'eksik malzemeler talep edildi': { label: 'Satın Almaya Gönderildi', className: 'bg-blue-100 text-blue-800 border-0' }
    }

    // Database'den gelen status'u direkt kullan - trigger zaten doğru güncelliyor
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft

    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className={`${config.className} rounded-full text-xs font-medium px-2 py-1`}>
          {config.label}
        </Badge>
        {notifications && notifications.includes('iade var') && (
          <div className="flex flex-wrap gap-1">
            <Badge 
              variant="outline" 
              className="border-red-500 text-red-700 border-1 rounded-full text-xs font-medium px-1 py-0.5"
            >
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-red-600" />
                İade Var
              </span>
            </Badge>
          </div>
        )}
      </div>
    )
  }

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig = {
      critical: { 
        label: 'Kritik', 
        className: 'bg-red-100 text-red-800 border-0',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      high: { 
        label: 'Yüksek', 
        className: 'bg-orange-100 text-orange-800 border-0',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      normal: { 
        label: 'Normal', 
        className: 'bg-blue-100 text-blue-800 border-0',
        icon: <Clock className="w-3 h-3" />
      },
      low: { 
        label: 'Düşük', 
        className: 'bg-green-100 text-green-800 border-0',
        icon: <Target className="w-3 h-3" />
      }
    }

    const config = urgencyConfig[urgency as keyof typeof urgencyConfig] || urgencyConfig.normal

    return (
      <Badge variant="outline" className={`${config.className} rounded-full text-xs font-medium px-2 py-1 flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSort = (field: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleRequestClick = (request: PurchaseRequest) => {
    // Tüm status'lardaki taleplere gidilebilir (draft, cancelled, rejected hariç)
    // Reddedildi talepler de görüntülenebilir (reddedilme nedeni görmek için)
    if (request.status !== 'draft' && request.status !== 'cancelled' && request.status !== 'rejected') {
      router.push(`/dashboard/requests/${request.id}/offers`)
    }
  }

  // Hover event handler'ları
  const handleMouseEnter = (e: React.MouseEvent, requestId: string) => {
    setTooltipPosition({
      x: e.clientX + 15, // İmlecin 15px sağında
      y: e.clientY - 10  // İmlecin 10px üstünde
    })
    setHoveredRequestId(requestId)
    fetchRequestMaterials(requestId)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredRequestId) {
      setTooltipPosition({
        x: e.clientX + 15, // İmlecin 15px sağında
        y: e.clientY - 10  // İmlecin 10px üstünde
      })
    }
  }

  const handleMouseLeave = () => {
    setHoveredRequestId(null)
  }

  // Dropdown toggle fonksiyonu
  const toggleDropdown = (requestId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpenDropdownId(openDropdownId === requestId ? null : requestId)
  }

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownId(null)
    }
    
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openDropdownId])

  // Delete modal açma fonksiyonu
  const openDeleteModal = (request: PurchaseRequest, e: React.MouseEvent) => {
    e.stopPropagation() // Satır tıklamasını engelle
    setRequestToDelete(request)
    setShowDeleteModal(true)
    setOpenDropdownId(null) // Dropdown'ı kapat
  }

  // Delete modal kapatma fonksiyonu
  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setRequestToDelete(null)
    setIsDeleting(false)
  }

  // Talep silme fonksiyonu
  const handleDeleteRequest = async () => {
    if (!requestToDelete) return

    setIsDeleting(true)

    try {
      const supabase = createClient()
      
      // Kullanıcı yetkisini kontrol et
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı')
      }
      
      // Önce talep items'ları sil
      const { error: itemsError } = await supabase
        .from('purchase_request_items')
        .delete()
        .eq('purchase_request_id', requestToDelete.id)

      if (itemsError) {
        console.error('Talep items silme hatası:', itemsError)
        // Items silme hatası olsa da devam et, talep silinebilir
      }

      // Talebi sil
      const { error: requestError } = await supabase
        .from('purchase_requests')
        .delete()
        .eq('id', requestToDelete.id)

      if (requestError) {
        throw new Error(`Talep silinirken hata oluştu: ${requestError.message}`)
      }

      // Cache'i temizle
      invalidatePurchaseRequestsCache()
      mutate('purchase_requests_stats')
      mutate('pending_requests_count')
      mutate((key) => typeof key === 'string' && key.startsWith('purchase_requests/'))
      
      // Veriyi yenile
      await refreshData()
      
      // Başarı toast'ı göster
      showToast('Talep başarıyla kaldırıldı!', 'success')
      
      // Modal'ı kapat
      closeDeleteModal()
      
    } catch (error: any) {
      console.error('Talep silme hatası:', error)
      showToast(`Talep silinirken hata oluştu: ${error.message}`, 'error')
      setIsDeleting(false)
    }
  }

  // Talep silme yetkisi kontrolü
  const canDeleteRequest = (request: PurchaseRequest) => {
    // Sadece "pending" (beklemede) statusundaki talepler silinebilir
    return request.status === 'pending'
  }

  // Delivery confirmation functions
  // Delivery fonksiyonları kaldırıldı - artık offers sayfasında yönetiliyor

  const handleSiteManagerApproval = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Tıklamanın satır tıklamasına etki etmesini engelle
    
    try {
      setApproving(requestId)
      
      // Optimistic update - UI'ı hemen güncelle
      const optimisticUpdate = data ? {
        ...data,
        requests: data.requests.map((req: any) => 
          req.id === requestId 
            ? { ...req, status: 'satın almaya gönderildi' }
            : req
        )
      } : null
      
      if (optimisticUpdate) {
        mutate(`purchase_requests/${currentPage}/${pageSize}`, optimisticUpdate, false)
      }
      
      const supabase = createClient()
      
      // Kullanıcı bilgisini al
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı.')
      }
      
      const { data: updateResult, error } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'satın almaya gönderildi',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
      
      if (error) throw error
      
      // Approval history kaydı ekle
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          purchase_request_id: requestId,
          action: 'approved',
          performed_by: user.id,
          comments: 'Site Manager tarafından satın almaya gönderildi'
        })

      if (historyError) {
        console.error('⚠️ Approval history kaydı eklenirken hata:', historyError)
      } else {
        console.log('✅ Approval history kaydı eklendi')
      }
      
      console.log('✅ Status updated successfully:', {
        requestId,
        newStatus: 'satın almaya gönderildi',
        updateResult
      })
      
      // Teams bildirimi gönder
      try {
        const { handlePurchaseRequestStatusChange } = await import('../lib/teams-webhook')
        await handlePurchaseRequestStatusChange(requestId, 'satın almaya gönderildi')
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
        // Webhook hatası ana işlemi etkilemesin
      }
      
      // Agresif cache temizleme ve veri yenileme
      invalidatePurchaseRequestsCache()
      
      // Tüm ilgili cache'leri manuel temizle
      mutate('purchase_requests_stats')
      mutate('pending_requests_count')
      
      // SWR cache'ini birden fazla kez yenile
      setTimeout(() => {
        refreshData()
      }, 100)
      
      setTimeout(() => {
        refreshData()
      }, 300)
      
    } catch (error: any) {
      console.error('❌ Site Manager Onay Hatası:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        requestId
      })
      
      // Hata durumunda kullanıcıyı bilgilendir (console'da detay var)
    } finally {
      setApproving(null)
    }
  }



  return (
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="p-0">
        {/* Search Bar ve Tab Menu */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Search Bar */}
            <div className="w-full sm:max-w-md order-1 sm:order-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Talep ara..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 h-10 bg-white rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
                />
              </div>
            </div>
            
            {/* Tab Menu - Sadece site manager için */}
            {userRole === 'site_manager' && (
              <div className="order-2 sm:order-1">
                <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-lg border border-gray-100">
                  <button
                    onClick={() => setActiveTab('approval_pending')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      activeTab === 'approval_pending'
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Onay Bekleyenler
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      activeTab === 'all'
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Tümü
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tablo */}
        <div className="space-y-3">
          {/* Header - Desktop Only */}
          <div className="hidden md:grid gap-4 px-4 py-3 bg-white rounded-2xl border border-gray-200" style={{gridTemplateColumns: '1fr 2fr 1.5fr 1.5fr 1.2fr 1fr 200px'}}>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Durum</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Başlık</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Şantiye</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Talep Eden</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Oluşturma Tarihi</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Talep No</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider text-right">İşlemler</div>
          </div>

          {/* Satırlar */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center">
                <Loading size="md" text="Yükleniyor..." />
              </div>
            ) : error ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center text-red-500">
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-red-300" />
                  <span>Veriler yüklenirken hata oluştu</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refreshData()}
                    className="mt-2"
                  >
                    Tekrar Dene
                  </Button>
                </div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center text-gray-500">
                <div className="flex flex-col items-center gap-2">
                  <Package className="w-8 h-8 text-gray-300" />
                  <span>
                    {filters.search || filters.status !== 'all' 
                      ? 'Filtre kriterlerinize uygun talep bulunamadı' 
                      : 'Henüz talep bulunamadı'
                    }
                  </span>
                </div>
              </div>
            ) : (
              filteredRequests.map((request, index) => (
                <div 
                  key={request.id}
                  className={`bg-white rounded-3xl border border-gray-200 p-4 hover:shadow-md transition-all duration-200 relative ${
                    (request.status !== 'draft' && request.status !== 'cancelled' && request.status !== 'rejected') 
                      ? 'cursor-pointer hover:border-gray-300' 
                      : 'cursor-default'
                  }`}
                  onClick={() => handleRequestClick(request)}
                >
                  {/* Desktop Layout */}
                  <div className="hidden md:grid gap-4 items-center" style={{gridTemplateColumns: '1fr 2fr 1.5fr 1.5fr 1.2fr 1fr 200px'}}>
                    {/* Durum */}
                    <div>
                      {getStatusBadge(request.status, request.notifications)}
                    </div>

                    {/* Başlık */}
                    <div 
                      onMouseEnter={(e) => handleMouseEnter(e, request.id)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      className="cursor-help"
                    >
                      <div className="font-normal text-gray-800 mb-1">
                        {request.title && request.title.length > 30 
                          ? `${request.title.substring(0, 30)}...` 
                          : request.title
                        }
                      </div>
                      {request.description && (
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {request.description.length > 50 
                            ? `${request.description.substring(0, 50)}...` 
                            : request.description
                          }
                        </div>
                      )}
                    </div>
                    
                    {/* Şantiye */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-100 rounded-2xl">
                          <Building2 className="w-3 h-3 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-800">
                            {request.sites?.[0]?.name || request.site_name || 'Şantiye Atanmamış'}
                          </div>
                          {request.site_id && (
                            <div className="text-xs text-gray-500">
                              ID: {request.site_id.slice(0, 8)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Talep Eden */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-2xl">
                          <User className="w-3 h-3 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-800">
                            {request.profiles?.full_name || 'Kullanıcı bulunamadı'}
                          </div>
                          {request.profiles?.email && (
                            <div className="text-xs text-gray-500">
                              {request.profiles.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Oluşturma Tarihi */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-100 rounded-2xl">
                          <Calendar className="w-3 h-3 text-black" />
                        </div>
                        <div className="text-sm">
                          <div className="font-medium text-gray-800">{formatDate(request.created_at)}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Talep No */}
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-2xl">
                          <FileText className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-semibold text-gray-800">{request.request_number}</span>
                      </div>
                    </div>
                    
                    {/* Actions - Site Manager için özel buton + Kebab Menu */}
                    <div className="relative flex justify-center items-center gap-2">
                      {/* Site Manager için Satın Almaya Gönder butonu */}
                      {userRole === 'site_manager' && 
                       (request.status === 'kısmen gönderildi' || request.status === 'depoda mevcut değil') && (
                        <Button
                          onClick={(e) => handleSiteManagerApproval(request.id, e)}
                          disabled={approving === request.id}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                        >
                          {approving === request.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                              Gönderiliyor...
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1.5" />
                              Satın Almaya Gönder
                            </>
                          )}
                        </Button>
                      )}
                      
                      {/* Kebab Menu */}
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-gray-100 relative z-10"
                        onClick={(e) => toggleDropdown(request.id, e)}
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </Button>
                      
                      {openDropdownId === request.id && (
                        <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                          {canDeleteRequest(request) ? (
                            <button
                              onClick={(e) => openDeleteModal(request, e)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Kaldır
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Kaldır (İzin yok)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    {/* Header Row - Status & Title */}
                    <div className="flex items-start justify-between gap-3">
                      <div 
                        className="flex-1 cursor-help"
                        onMouseEnter={(e) => handleMouseEnter(e, request.id)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="font-normal text-gray-800 mb-1">
                          {request.title}
                        </div>
                        {request.description && (
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {request.description.length > 80 
                              ? `${request.description.substring(0, 80)}...` 
                              : request.description
                            }
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(request.status, request.notifications)}
                        
                        {/* Kebab Menu */}
                        <div className="relative">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-gray-100 relative z-10"
                            onClick={(e) => toggleDropdown(request.id, e)}
                          >
                            <MoreVertical className="h-4 w-4 text-gray-500" />
                          </Button>
                          
                          {openDropdownId === request.id && (
                            <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                              {canDeleteRequest(request) ? (
                                <button
                                  onClick={(e) => openDeleteModal(request, e)}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Kaldır
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Kaldır (İzin yok)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Site Manager için Satın Almaya Gönder butonu - Mobile */}
                    {userRole === 'site_manager' && 
                     (request.status === 'kısmen gönderildi' || request.status === 'depoda mevcut değil') && (
                      <div className="pt-2">
                        <Button
                          onClick={(e) => handleSiteManagerApproval(request.id, e)}
                          disabled={approving === request.id}
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-5 rounded-xl"
                        >
                          {approving === request.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Gönderiliyor...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Satın Almaya Gönder
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {/* Şantiye */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Şantiye</div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-gray-100 rounded-lg">
                            <Building2 className="w-3 h-3 text-gray-600" />
                          </div>
                          <span className="font-medium text-gray-800 text-xs">
                            {request.sites?.[0]?.name || request.site_name || 'Atanmamış'}
                          </span>
                        </div>
                      </div>

                      {/* Talep Eden */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Talep Eden</div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-blue-100 rounded-lg">
                            <User className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-800 text-xs">
                            {request.profiles?.full_name || 'Bilinmiyor'}
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
                            {formatDate(request.created_at)}
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
                            {request.request_number}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600 order-2 sm:order-1">
              {filteredRequests.length} / {totalCount} kayıt - Sayfa {currentPage} / {Math.ceil(totalCount / pageSize)}
            </div>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-xl"
              >
                Önceki
              </Button>
              
              {/* Sayfa numaraları */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, Math.ceil(totalCount / pageSize)) }, (_, i) => {
                  const pageNum = i + 1
                  const totalPages = Math.ceil(totalCount / pageSize)
                  
                  // Akıllı sayfa gösterimi
                  let showPage = false
                  if (totalPages <= 5) {
                    showPage = true
                  } else if (currentPage <= 3) {
                    showPage = pageNum <= 5
                  } else if (currentPage >= totalPages - 2) {
                    showPage = pageNum > totalPages - 5
                  } else {
                    showPage = Math.abs(pageNum - currentPage) <= 2
                  }
                  
                  if (!showPage) return null
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 p-0 rounded-xl ${
                        currentPage === pageNum 
                          ? 'bg-black text-white' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                className="rounded-xl"
              >
                Sonraki
              </Button>
            </div>
          </div>
        )}
        
      </CardContent>

      {/* Materials Tooltip */}
      {hoveredRequestId && (
        <div 
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 max-w-sm pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y
          }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <Box className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900 text-sm">Talep Edilen Malzemeler</span>
          </div>
          
          {loadingMaterials[hoveredRequestId] ? (
            <div className="flex items-center gap-2 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              <span className="text-xs text-gray-500">Yükleniyor...</span>
            </div>
          ) : requestMaterials[hoveredRequestId]?.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {requestMaterials[hoveredRequestId].map((material, index) => (
                <div key={material.id} className="flex items-start gap-2 py-1.5 px-2 bg-gray-50 rounded-lg">
                  <Hash className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs text-gray-900 truncate">
                      {material.item_name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-600">
                        {material.quantity} {material.unit}
                      </span>
                      {material.brand && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {material.brand}
                        </span>
                      )}
                    </div>
                    {material.material_class && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {material.material_class}
                        {material.material_group && ` • ${material.material_group}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 py-2">
              Malzeme bilgisi bulunamadı
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl border-0 shadow-xl">
          <DialogHeader className="text-center pb-2">
            <DialogTitle className="flex items-center justify-center gap-2 text-gray-800 text-lg font-medium">
              <Trash2 className="w-5 h-5 text-red-500" />
              Talebi Kaldır
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm mt-2">
              Bu işlem geri alınamaz. Talep ve tüm ilgili malzemeler kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>
          
          {requestToDelete && (
            <div className="py-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Talep No</div>
                  <div className="font-medium text-gray-900">
                    {requestToDelete.request_number ? 
                      (() => {
                        const parts = requestToDelete.request_number.split('-')
                        if (parts.length >= 2) {
                          const lastPart = parts[parts.length - 1]
                          const secondLastPart = parts[parts.length - 2]
                          const lastTwoChars = secondLastPart.slice(-2)
                          return `${lastTwoChars}-${lastPart}`
                        }
                        return requestToDelete.request_number
                      })() :
                      `REQ-${requestToDelete.id.slice(-6)}`
                    }
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Başlık</div>
                  <div className="font-medium text-gray-900 truncate">
                    {requestToDelete.title}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              disabled={isDeleting}
              className="flex-1 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRequest}
              disabled={isDeleting}
              className="flex-1 bg-red-500 hover:bg-red-600 rounded-xl border-0"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Siliniyor...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Kaldır
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Confirmation Modal - Artık orders'a ihtiyaç yok, direkt order bilgisi geçiliyor */}
    </Card>
  )
}
