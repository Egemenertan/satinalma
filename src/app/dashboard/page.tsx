'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  TrendingUp, 
  Package, 
  Clock, 
  Building2, 
  Calendar,
  BarChart3,
  FileText,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle,
  Users,
  DollarSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    urgentRequests: 0,
    totalSites: 0,
    activeSites: 0,
    totalAmount: 0,
    monthlyRequests: 0
  })
  const [recentRequests, setRecentRequests] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      console.log('🔍 Dashboard: Fetching data...')
      
      // Auth durumunu kontrol et
      const { data: { user } } = await supabase.auth.getUser()
      console.log('🔍 Dashboard: Current user:', user?.id)
      
      // Talepler verilerini çek - önce sadece temel alanlar
      const { data: requestsData, error: requestsError } = await supabase
        .from('purchase_requests')
        .select('id, title, status, urgency_level, created_at, requested_by, total_amount, site_id, department, profiles(full_name), sites(name), purchase_request_items(id)')
        .order('created_at', { ascending: false })

      console.log('📊 Dashboard: Requests query result:', { 
        count: requestsData?.length, 
        error: requestsError 
      })

      if (requestsError) {
        console.error('Dashboard requests error:', requestsError)
        throw requestsError
      }

      // Şantiye verilerini çek
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('*')

      console.log('🏗️ Dashboard: Sites query result:', { 
        count: sitesData?.length, 
        error: sitesError 
      })

      if (sitesError) {
        console.error('Dashboard sites error:', sitesError)
        throw sitesError
      }

      // İstatistikleri hesapla
      const requests = requestsData || []
      const sites = sitesData || []
      
      const totalRequests = requests.length
      const pendingRequests = requests.filter(r => r.status === 'pending').length
      const approvedRequests = requests.filter(r => r.status === 'approved').length
      const urgentRequests = requests.filter(r => r.urgency_level === 'critical' || r.urgency_level === 'high').length
      
      // Bu ay oluşturulan talepler
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const monthlyRequests = requests.filter(r => {
        const requestDate = new Date(r.created_at)
        return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear
      }).length

      // Toplam tutar hesaplama
      const totalAmount = requests.reduce((sum, req) => {
        return sum + (parseFloat(req.total_amount) || 0)
      }, 0)

      // Aktif şantiyeler (talepleri olan)
      const requestSiteIds = new Set(requests.map(r => r.site_id).filter(Boolean))
      const activeSites = requestSiteIds.size

      setStats({
        totalRequests,
        pendingRequests,
        approvedRequests,
        urgentRequests,
        totalSites: sites.length,
        activeSites,
        totalAmount,
        monthlyRequests
      })

      // Son 5 talebi al
      setRecentRequests(requests.slice(0, 5))
      
      console.log('✅ Dashboard: Data processed successfully', {
        totalRequests,
        pendingRequests,
        approvedRequests,
        urgentRequests,
        totalSites: sites.length,
        activeSites,
        recentRequestsCount: requests.slice(0, 5).length
      })

    } catch (error) {
      console.error('❌ Dashboard verileri yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-medium">Dashboard yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 pb-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2 text-lg font-light">Satın alma sistemi özet görünümü</p>
        </div>
      </div>

      {/* Stats Cards - Üst sıra */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Toplam Talepler */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Toplam Talep</CardTitle>
            <FileText className="h-5 w-5 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalRequests}</div>
            <p className="text-xs text-white/70">Sistemdeki tüm talepler</p>
          </CardContent>
        </Card>

        {/* Bekleyen Talepler */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-black/70">Bekleyen</CardTitle>
            <Clock className="h-5 w-5 text-black/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">{stats.pendingRequests}</div>
            <p className="text-xs text-black/70">İşlem bekliyor</p>
          </CardContent>
        </Card>

        {/* Onaylanan Talepler */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Onaylanan</CardTitle>
            <CheckCircle className="h-5 w-5 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.approvedRequests}</div>
            <p className="text-xs text-white/70">Tamamlanan talepler</p>
          </CardContent>
        </Card>

        {/* Acil Talepler */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-black/70">Acil</CardTitle>
            <AlertCircle className="h-5 w-5 text-black/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">{stats.urgentRequests}</div>
            <p className="text-xs text-black/70">Yüksek öncelikli</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Alt sıra */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Toplam Şantiyeler */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-black/70">Toplam Şantiye</CardTitle>
            <Building2 className="h-5 w-5 text-black/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">{stats.totalSites}</div>
            <p className="text-xs text-black/70">Kayıtlı şantiye</p>
          </CardContent>
        </Card>

        {/* Aktif Şantiyeler */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Aktif Şantiye</CardTitle>
            <TrendingUp className="h-5 w-5 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.activeSites}</div>
            <p className="text-xs text-white/70">Talep olan şantiyeler</p>
          </CardContent>
        </Card>

        {/* Bu Ay Talep */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#EFE248' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-black/70">Bu Ay</CardTitle>
            <Calendar className="h-5 w-5 text-black/60" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-black">{stats.monthlyRequests}</div>
            <p className="text-xs text-black/70">Aylık yeni talep</p>
          </CardContent>
        </Card>

        {/* Toplam Tutar */}
        <Card className="rounded-2xl backdrop-blur-lg border border-white/30 shadow-xl" style={{ backgroundColor: '#000000' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Toplam Tutar</CardTitle>
            <DollarSign className="h-5 w-5 text-white/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalAmount > 999999 ? `₺${(stats.totalAmount / 1000000).toFixed(1)}M` : 
               stats.totalAmount > 999 ? `₺${(stats.totalAmount / 1000).toFixed(0)}K` : 
               formatCurrency(stats.totalAmount)}
            </div>
            <p className="text-xs text-white/70">Tahmini değer</p>
          </CardContent>
        </Card>
      </div>

      {/* Son Talepler */}
      <Card className="rounded-2xl bg-white/60 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900">Son Talepler</CardTitle>
              <p className="text-sm text-gray-500 mt-1">En son oluşturulan satın alma talepleri</p>
            </div>
            <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
              Tümünü Gör
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Henüz talep bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50/50 to-gray-100/50 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{request.title}</h4>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status === 'pending' ? 'Beklemede' : 
                         request.status === 'approved' ? 'Onaylandı' : request.status}
                      </Badge>
                      <Badge className={getUrgencyColor(request.urgency_level)}>
                        {request.urgency_level === 'critical' ? 'Kritik' : 
                         request.urgency_level === 'high' ? 'Yüksek' :
                         request.urgency_level === 'normal' ? 'Normal' : 'Düşük'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {request.profiles?.full_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {request.sites?.name || request.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(request.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(parseFloat(request.total_amount) || 0)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {request.purchase_request_items?.length || 0} ürün
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
