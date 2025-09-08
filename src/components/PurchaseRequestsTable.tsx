'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  ArrowUpDown
} from 'lucide-react'

interface PurchaseRequest {
  id: string
  request_number: string
  title: string
  description?: string
  department: string
  total_amount: number
  currency?: string
  urgency_level: 'low' | 'normal' | 'high' | 'critical'
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'awaiting_offers' | 'sipariş verildi' | 'şantiye şefi onayladı'
  requested_by: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  delivery_date?: string
  supplier_id?: string
  created_at: string
  updated_at: string
  // Relations
  profiles?: {
    full_name: string
    email: string
    department: string
  }
  purchase_request_items?: Array<{
    id: string
    item_name: string
    quantity: number
    unit: string
    unit_price: number
    total_price: number
  }>
}

interface Filters {
  search: string
  status: string
  urgency: string
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
    .select('role')
    .eq('id', user.id)
    .single()

  return { user, profile, supabase }
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
  
  // Purchasing officer sadece onaylanmış ve sipariş verilmiş talepleri görebilir
  if (profile?.role === 'purchasing_officer') {
    countQuery = countQuery.in('status', ['şantiye şefi onayladı', 'sipariş verildi'])
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
      title,
      status,
      urgency_level,
      created_at,
      requested_by,
      total_amount,
      department,
      orders!left (
        id
      )
    `)
    .range(from, to)
    .order('created_at', { ascending: false })
  
  // Purchasing officer sadece onaylanmış ve sipariş verilmiş talepleri görebilir
  if (profile?.role === 'purchasing_officer') {
    requestsQuery = requestsQuery.in('status', ['şantiye şefi onayladı', 'sipariş verildi'])
  }
  
  const { data: requests, error } = await requestsQuery
  
  if (error) {
    throw new Error(error.message)
  }

  const formattedRequests = (requests || []).map(request => ({
    ...request,
    request_number: `REQ-${request.id.slice(0, 8)}`,
    updated_at: request.created_at,
    // Eğer orders varsa ve boş değilse status'u güncelle
    status: request.orders && request.orders.length > 0 ? 'sipariş verildi' : request.status
  })) as PurchaseRequest[]

  return { requests: formattedRequests, totalCount: count || 0 }
}

export default function PurchaseRequestsTable() {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [userRole, setUserRole] = useState<string>('')
  const [approving, setApproving] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    urgency: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  // SWR ile cache'li veri çekme
  const { data, error, isLoading, mutate: refreshData } = useSWR(
    `purchase_requests/${currentPage}/${pageSize}`,
    fetchPurchaseRequests,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 dakika cache
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  )

  const requests = data?.requests || []
  const totalCount = data?.totalCount || 0

  // Kullanıcı rolünü çek
  useEffect(() => {
    const fetchUserRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (profile?.role) {
          setUserRole(profile.role)
        }
      }
    }
    
    fetchUserRole()
  }, [])

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
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [refreshData])

  // Filter uygulaması
  const filteredRequests = requests.filter((req: any) => {
    if (filters.status !== 'all' && req.status !== filters.status) return false
    if (filters.urgency !== 'all' && req.urgency_level !== filters.urgency) return false
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



  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-700 border-0' },
      pending: { label: 'Beklemede', className: 'bg-yellow-100 text-yellow-800 border-0' },
      'şantiye şefi onayladı': { label: 'Şantiye Şefi Onayladı', className: 'bg-blue-100 text-blue-800 border-0' },
      awaiting_offers: { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      approved: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-0' },
      rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-0' },
      cancelled: { label: 'İptal Edildi', className: 'bg-gray-100 text-gray-600 border-0' },
      'sipariş verildi': { label: 'Sipariş Verildi', className: 'bg-green-100 text-green-800 border-0' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft

    return (
      <Badge variant="outline" className={`${config.className} rounded-full text-xs font-medium px-2 py-1`}>
        {config.label}
      </Badge>
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

  const formatCurrency = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const handleSort = (field: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleRequestClick = (request: PurchaseRequest) => {
    // Pending, awaiting_offers ve sipariş verildi status'undaki taleplere gidilebilir
    if (request.status === 'pending' || request.status === 'awaiting_offers' || request.status === 'şantiye şefi onayladı' || request.status === 'sipariş verildi') {
      router.push(`/dashboard/requests/${request.id}/offers`)
    }
  }

  const handleSiteManagerApproval = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Tıklamanın satır tıklamasına etki etmesini engelle
    
    try {
      setApproving(requestId)
      const supabase = createClient()
      
      const { error } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'şantiye şefi onayladı',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (error) throw error
      
      // Verileri yenile
      refreshData()
      invalidatePurchaseRequestsCache()
      
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
        {/* Search Bar */}
        <div className="mb-6 px-4">
          <div className="w-full sm:max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Talep ara..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 h-10 rounded-lg border-gray-200 focus:border-gray-900 focus:ring-gray-900/20"
              />
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="rounded-lg border-0 overflow-hidden overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                <TableHead className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</TableHead>
                <TableHead className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('title')}
                    className="h-auto p-0 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
                  >
                    Başlık
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Departman</TableHead>
                <TableHead className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Öğeler</TableHead>
                <TableHead className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Tutar</TableHead>
                <TableHead className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Aciliyet</TableHead>
                <TableHead className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('created_at')}
                    className="h-auto p-0 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
                  >
                    Tarih
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-[120px] py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('request_number')}
                    className="h-auto p-0 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 flex items-center gap-1"
                  >
                    Talep No
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                {userRole === 'site_manager' && (
                  <TableHead className="w-[120px] py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-0">
                  <TableCell colSpan={userRole === 'site_manager' ? 9 : 8} className="text-center py-12">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">Yükleniyor...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow className="border-0">
                  <TableCell colSpan={userRole === 'site_manager' ? 9 : 8} className="text-center py-12 text-red-500">
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
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow className="border-0">
                  <TableCell colSpan={userRole === 'site_manager' ? 9 : 8} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-gray-300" />
                      <span>
                        {filters.search || filters.status !== 'all' || filters.urgency !== 'all' 
                          ? 'Filtre kriterlerinize uygun talep bulunamadı' 
                          : 'Henüz talep bulunamadı'
                        }
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request, index) => (
                  <TableRow 
                    key={request.id}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${
                      (request.status === 'pending' || request.status === 'awaiting_offers' || request.status === 'sipariş verildi') 
                        ? 'hover:bg-blue-50' 
                        : 'cursor-default'
                    }`}
                    onClick={() => handleRequestClick(request)}
                  >
                    <TableCell className="py-4">
                      {getStatusBadge(request.status)}
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="max-w-xs">
                        <div className="font-semibold text-gray-800 mb-1">
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
                    </TableCell>
                    
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-100 rounded-2xl">
                          <Building2 className="w-3 h-3 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-800">
                            {request.department}
                          </div>
                          {request.profiles?.department && (
                            <div className="text-xs text-gray-500">
                              {request.profiles.department}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded-2xl">
                          <Package className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="font-medium text-gray-800">
                          {request.purchase_request_items?.length || 0} öğe
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="py-4">
                      {request.total_amount ? (
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-green-100 rounded-2xl">
                            <TrendingUp className="w-3 h-3 text-green-600" />
                          </div>
                          <span className="font-semibold text-green-700">
                            {formatCurrency(request.total_amount)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    
                    <TableCell className="py-4">
                      {getUrgencyBadge(request.urgency_level)}
                    </TableCell>
                    
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-100 rounded-2xl">
                          <Calendar className="w-3 h-3 text-black" />
                        </div>
                        <div className="text-sm">
                          <div className="font-medium text-gray-800">{formatDate(request.created_at)}</div>
                          {request.profiles?.full_name && (
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <User className="w-2 h-2" />
                              {request.profiles.full_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    


                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-2xl">
                          <FileText className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-semibold text-gray-800">{request.request_number}</span>
                      </div>
                    </TableCell>
                    
                    {userRole === 'site_manager' && (
                      <TableCell className="py-4">
                        {request.status === 'pending' ? (
                          <Button
                            size="sm"
                            onClick={(e) => handleSiteManagerApproval(request.id, e)}
                            disabled={approving === request.id}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-8 rounded-lg"
                          >
                            {approving === request.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                Onaylanıyor...
                              </>
                            ) : (
                              'Talebi Onayla'
                            )}
                          </Button>
                        ) : request.status === 'şantiye şefi onayladı' ? (
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                            ✓ Onaylandı
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
    </Card>
  )
}

