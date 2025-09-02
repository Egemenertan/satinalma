'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  Package, 
  Clock, 
  Building2, 
  Calendar,
  BarChart3,
  FileText,
  AlertCircle,
  CheckCircle,
  Users,
  DollarSign,
  ShoppingCart,
  Truck,
  Target
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface DashboardStats {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
  totalSites: number
  totalSuppliers: number
  totalOrders: number
  monthlyGrowth: number
  avgOrderValue: number
  activeProjects: number
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalSites: 0,
    totalSuppliers: 0,
    totalOrders: 0,
    monthlyGrowth: 0,
    avgOrderValue: 0,
    activeProjects: 0
  })
  
  const [chartData, setChartData] = useState({
    requestsByMonth: [] as Array<{ month: string; requests: number }>,
    statusDistribution: [] as Array<{ status: string; count: number; percentage: number }>,
    topSites: [] as Array<{ name: string; requests: number; amount: number }>
  })

  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Paralel veri çekme işlemleri
      const [requestsResult, sitesResult, suppliersResult, ordersResult] = await Promise.all([
        supabase.from('purchase_requests').select('*'),
        supabase.from('sites').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('orders').select('*')
      ])

      // Hata kontrolü
      if (requestsResult.error) throw requestsResult.error
      if (sitesResult.error) throw sitesResult.error
      if (suppliersResult.error) throw suppliersResult.error
      if (ordersResult.error) throw ordersResult.error

      const requests = requestsResult.data || []
      const sites = sitesResult.data || []
      const suppliers = suppliersResult.data || []
      const orders = ordersResult.data || []

      // Temel istatistikler
      const totalRequests = requests.length
      const pendingRequests = requests.filter(r => r.status === 'pending').length
      const approvedRequests = requests.filter(r => r.status === 'approved').length
      const rejectedRequests = requests.filter(r => r.status === 'rejected').length

      // Aylık büyüme hesaplama
      const currentMonth = new Date().getMonth()
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
      const currentYear = new Date().getFullYear()
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

      const currentMonthRequests = requests.filter(r => {
        const date = new Date(r.created_at)
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear
      }).length

      const lastMonthRequests = requests.filter(r => {
        const date = new Date(r.created_at)
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
      }).length

      const monthlyGrowth = lastMonthRequests > 0 
        ? ((currentMonthRequests - lastMonthRequests) / lastMonthRequests) * 100 
        : 0

      // Ortalama sipariş değeri
      const totalOrderValue = orders.reduce((sum, order) => sum + (order.amount || 0), 0)
      const avgOrderValue = orders.length > 0 ? totalOrderValue / orders.length : 0

      // Aktif projeler (bu ay talep alan siteler)
      const activeProjects = new Set(
        requests
          .filter(r => {
            const date = new Date(r.created_at)
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear
          })
          .map(r => r.site_id)
          .filter(Boolean)
      ).size

      setStats({
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        totalSites: sites.length,
        totalSuppliers: suppliers.length,
        totalOrders: orders.length,
        monthlyGrowth,
        avgOrderValue,
        activeProjects
      })

      // Grafik verileri hazırla
      prepareChartData(requests, sites)

    } catch (error) {
      console.error('Dashboard verileri yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const prepareChartData = (requests: any[], sites: any[]) => {
    // Son 6 ayın talepler verisi
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('tr-TR', { month: 'short' })
      const requestCount = requests.filter(r => {
        const requestDate = new Date(r.created_at)
        return requestDate.getMonth() === date.getMonth() && 
               requestDate.getFullYear() === date.getFullYear()
      }).length
      
      months.push({ month: monthName, requests: requestCount })
    }

    // Durum dağılımı
    const statusCounts = {
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    }

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status: status === 'pending' ? 'Beklemede' : 
              status === 'approved' ? 'Onaylandı' : 'Reddedildi',
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))

    // En çok talep alan siteler
    const siteRequestCounts = sites.map(site => {
      const siteRequests = requests.filter(r => r.site_id === site.id)
      const totalAmount = siteRequests.reduce((sum, req) => sum + (parseFloat(req.total_amount) || 0), 0)
      return {
        name: site.name,
        requests: siteRequests.length,
        amount: totalAmount
      }
    }).sort((a, b) => b.requests - a.requests).slice(0, 5)

    setChartData({
      requestsByMonth: months,
      statusDistribution,
      topSites: siteRequestCounts
    })
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₺${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `₺${(amount / 1000).toFixed(0)}K`
    }
    return `₺${amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`
  }

  const formatGrowth = (growth: number) => {
    const sign = growth > 0 ? '+' : ''
    return `${sign}${growth.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-light text-lg">Dashboard yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="text-left mb-8">
          <h1 className="text-5xl font-light text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600 text-xl font-light">Satın alma sistemi genel görünümü</p>
        </div>

        {/* Ana İstatistik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Toplam Talepler */}
          <Card className="rounded-3xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border-0">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-black rounded-2xl">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.totalRequests}</div>
                  <p className="text-sm text-gray-500">Toplam Talep</p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-2 bg-black rounded-full" style={{ width: '100%' }}></div>
              </div>
            </CardContent>
          </Card>

          {/* Bekleyen Talepler */}
          <Card className="rounded-3xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border-0">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-500 rounded-2xl">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.pendingRequests}</div>
                  <p className="text-sm text-gray-500">Beklemede</p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-2 bg-yellow-500 rounded-full" 
                     style={{ width: `${stats.totalRequests > 0 ? (stats.pendingRequests / stats.totalRequests) * 100 : 0}%` }}>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Onaylanan Talepler */}
          <Card className="rounded-3xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border-0">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-500 rounded-2xl">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.approvedRequests}</div>
                  <p className="text-sm text-gray-500">Onaylandı</p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-2 bg-green-500 rounded-full" 
                     style={{ width: `${stats.totalRequests > 0 ? (stats.approvedRequests / stats.totalRequests) * 100 : 0}%` }}>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aylık Büyüme */}
          <Card className="rounded-3xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border-0">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${stats.monthlyGrowth >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{formatGrowth(stats.monthlyGrowth)}</div>
                  <p className="text-sm text-gray-500">Aylık Büyüme</p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className={`h-2 rounded-full ${stats.monthlyGrowth >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                     style={{ width: `${Math.min(Math.abs(stats.monthlyGrowth), 100)}%` }}>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* İkinci Sıra İstatistikler */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          
          <Card className="rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 border-0">
            <CardContent className="p-6 text-center">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-gray-600" />
              <div className="text-2xl font-bold text-gray-900">{stats.totalSites}</div>
              <p className="text-sm text-gray-500">Şantiye</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 border-0">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-3 text-gray-600" />
              <div className="text-2xl font-bold text-gray-900">{stats.totalSuppliers}</div>
              <p className="text-sm text-gray-500">Tedarikçi</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 border-0">
            <CardContent className="p-6 text-center">
              <ShoppingCart className="h-8 w-8 mx-auto mb-3 text-gray-600" />
              <div className="text-2xl font-bold text-gray-900">{stats.totalOrders}</div>
              <p className="text-sm text-gray-500">Sipariş</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 border-0">
            <CardContent className="p-6 text-center">
              <Target className="h-8 w-8 mx-auto mb-3 text-gray-600" />
              <div className="text-2xl font-bold text-gray-900">{stats.activeProjects}</div>
              <p className="text-sm text-gray-500">Aktif Proje</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 border-0">
            <CardContent className="p-6 text-center">
              <DollarSign className="h-8 w-8 mx-auto mb-3 text-gray-600" />
              <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.avgOrderValue)}</div>
              <p className="text-sm text-gray-500">Ort. Sipariş</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-md hover:shadow-lg transition-all duration-300 border-0">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-3 text-gray-600" />
              <div className="text-2xl font-bold text-gray-900">{stats.rejectedRequests}</div>
              <p className="text-sm text-gray-500">Reddedilen</p>
            </CardContent>
          </Card>

        </div>

        {/* Grafik Bölümleri */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          {/* Aylık Talep Trendi */}
          <Card className="rounded-3xl bg-white shadow-lg border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Son 6 Ay Talep Trendi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {chartData.requestsByMonth.length > 0 ? (
                  <div className="space-y-4">
                    {chartData.requestsByMonth.map((item, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-12 text-sm font-medium text-gray-600">{item.month}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-black to-gray-600 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${Math.max((item.requests / Math.max(...chartData.requestsByMonth.map(m => m.requests))) * 100, 5)}%` 
                                }}
                              ></div>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 w-8">{item.requests}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Veri bulunmuyor</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Durum Dağılımı */}
          <Card className="rounded-3xl bg-white shadow-lg border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Talep Durumu Dağılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {chartData.statusDistribution.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{item.status}</span>
                      <span className="text-sm font-bold text-gray-900">{item.count} ({item.percentage}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.status === 'Beklemede' ? 'bg-yellow-500' :
                          item.status === 'Onaylandı' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* En Aktif Şantiyeler */}
        <Card className="rounded-3xl bg-white shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              En Aktif Şantiyeler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.topSites.length > 0 ? (
              <div className="space-y-4">
                {chartData.topSites.map((site, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                    <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{site.name}</div>
                      <div className="text-sm text-gray-600">{site.requests} talep</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{formatCurrency(site.amount)}</div>
                      <div className="text-sm text-gray-500">Toplam tutar</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Henüz şantiye verisi bulunmuyor</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
