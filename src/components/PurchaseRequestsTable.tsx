'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { 
  Search, 
  Filter, 
  Eye, 
  Edit2, 
  FileText, 
  Building2, 
  Calendar,
  AlertTriangle,
  Clock,
  Target,
  Package,
  TrendingUp,
  User,
  ChevronRight,
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
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'awaiting_offers'
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

export default function PurchaseRequestsTable() {
  const router = useRouter()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    urgency: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })


  useEffect(() => {
    fetchRequests()
  }, [filters])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      // Actions'dan veri çek
      const { getPurchaseRequests } = await import('@/lib/actions')
      const result = await getPurchaseRequests()
      
      if (!result.success) {
        throw new Error(result.error)
      }

      let data = result.data || []

      // Filtreleri uygula
      if (filters.status !== 'all') {
        data = data.filter((req: any) => req.status === filters.status)
      }

      if (filters.urgency !== 'all') {
        data = data.filter((req: any) => req.urgency_level === filters.urgency)
      }

      if (filters.search) {
        data = data.filter((req: any) => 
          req.request_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
          req.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
          req.description?.toLowerCase().includes(filters.search.toLowerCase())
        )
      }

      // Sıralama
      data.sort((a: any, b: any) => {
        const aVal = a[filters.sortBy] || ''
        const bVal = b[filters.sortBy] || ''
        
        if (filters.sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1
        } else {
          return aVal < bVal ? 1 : -1
        }
      })

      setRequests(data)
    } catch (error) {
      console.error('Talepler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }



  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      pending: { label: 'Beklemede', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      awaiting_offers: { label: 'Onay Bekliyor', className: 'bg-black text-white border-black' },
      approved: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-green-200' },
      rejected: { label: 'Reddedildi', className: 'bg-black text-white border-black' },
      cancelled: { label: 'İptal Edildi', className: 'bg-gray-100 text-gray-600 border-gray-200' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft

    return (
      <Badge variant="outline" className={`${config.className} rounded-2xl`}>
        {config.label}
      </Badge>
    )
  }

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig = {
      critical: { 
        label: 'Kritik', 
        className: 'bg-black text-white border-black',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      high: { 
        label: 'Yüksek', 
        className: 'bg-black text-white border-black',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      normal: { 
        label: 'Normal', 
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: <Clock className="w-3 h-3" />
      },
      low: { 
        label: 'Düşük', 
        className: 'bg-green-100 text-green-800 border-green-200',
        icon: <Target className="w-3 h-3" />
      }
    }

    const config = urgencyConfig[urgency as keyof typeof urgencyConfig] || urgencyConfig.normal

    return (
      <Badge variant="outline" className={`${config.className} rounded-2xl flex items-center gap-1`}>
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
    // Pending ve awaiting_offers status'undaki taleplere teklif girilebilir
    if (request.status === 'pending' || request.status === 'awaiting_offers') {
      router.push(`/dashboard/requests/${request.id}/offers`)
    }
  }



  return (
    <Card className="rounded-2xl bg-transparent border-0 shadow-none">
      
      
      <CardContent className="p-4 sm:p-6">
        {/* Filtreler */}
        <div className="mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Talep ara..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 rounded-xl bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <Select 
              value={filters.status} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="draft">Taslak</SelectItem>
                <SelectItem value="pending">Beklemede</SelectItem>
                <SelectItem value="awaiting_offers">Onay Bekliyor</SelectItem>
                <SelectItem value="approved">Onaylandı</SelectItem>
                <SelectItem value="rejected">Reddedildi</SelectItem>
                <SelectItem value="cancelled">İptal Edildi</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.urgency} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, urgency: value }))}
            >
              <SelectTrigger className="rounded-2xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Aciliyet" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">Tüm Aciliyet</SelectItem>
                <SelectItem value="critical">Kritik</SelectItem>
                <SelectItem value="high">Yüksek</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Düşük</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setFilters({
                search: '',
                status: 'all',
                urgency: 'all',
                sortBy: 'created_at',
                sortOrder: 'desc'
              })}
              className="flex items-center gap-2 rounded-2xl border-gray-200 hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Temizle
            </Button>
          </div>
        </div>

        {/* Tablo */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-0 hover:bg-gray-100">
                <TableHead className="w-[120px] py-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('request_number')}
                    className="h-8 p-0 flex items-center gap-1 font-medium text-gray-700 hover:text-black hover:bg-gray-100 rounded-2xl"
                  >
                    Talep No
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="py-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('title')}
                    className="h-8 p-0 flex items-center gap-1 font-medium text-gray-700 hover:text-black hover:bg-gray-100 rounded-2xl"
                  >
                    Başlık
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="py-4 text-gray-700">Departman</TableHead>
                <TableHead className="py-4 text-gray-700">Öğeler</TableHead>
                <TableHead className="py-4 text-gray-700">Toplam Tutar</TableHead>
                <TableHead className="py-4 text-gray-700">Aciliyet</TableHead>
                <TableHead className="py-4 text-gray-700">Durum</TableHead>
                <TableHead className="py-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('created_at')}
                    className="h-8 p-0 flex items-center gap-1 font-medium text-gray-700 hover:text-black hover:bg-gray-100 rounded-2xl"
                  >
                    Tarih
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                </TableHead>
                <TableHead className="py-4 text-gray-700">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-0">
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">Yükleniyor...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow className="border-0">
                  <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-gray-300" />
                      <span>Henüz talep bulunamadı</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request, index) => (
                  <TableRow 
                    key={request.id}
                    className={`border-0 hover:bg-yellow-50/50 transition-colors duration-200 ${
                      (request.status === 'pending' || request.status === 'awaiting_offers') ? 'cursor-pointer' : ''
                    } ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    onClick={() => handleRequestClick(request)}
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-2xl">
                          <FileText className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-semibold text-gray-800">{request.request_number}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="py-4">
                      <div className="max-w-xs">
                        <div className="font-semibold text-gray-800 mb-1">{request.title}</div>
                        {request.description && (
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {request.description}
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
                      {getStatusBadge(request.status)}
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-2xl hover:bg-gray-100 hover:text-black">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-2xl hover:bg-green-100 hover:text-green-600">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-2xl hover:bg-yellow-100 hover:text-yellow-800">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        
      </CardContent>
    </Card>
  )
}

