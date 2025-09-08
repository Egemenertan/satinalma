'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown,
  Users,
  Target,
  DollarSign,
  BarChart3,
  MoreHorizontal,
  Plus
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

interface DashboardStats {
  totalRequests: number
  requestGrowth: number
  totalSuppliers: number
  supplierGrowth: number
  totalSites: number
  siteGrowth: number
  totalAmount: number
  amountGrowth: number
}

interface DailyRequestData {
  date: string
  requests: number
  amount: number
}

interface RecentRequest {
  id: string
  title: string
  status: string
  created_at: string
  total_amount: number
  site_name?: string
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    requestGrowth: 0,
    totalSuppliers: 0,
    supplierGrowth: 0,
    totalSites: 0,
    siteGrowth: 0,
    totalAmount: 0,
    amountGrowth: 0
  })
  
  const [dailyData, setDailyData] = useState<DailyRequestData[]>([])
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Kullanıcı rolünü ve site bilgisini çek
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, site_id')
        .eq('id', user.id)
        .single()
      
      // RLS politikaları otomatik filtreleme yapacak, normal sorgular yeterli
      const [requestsResult, suppliersResult, sitesResult] = await Promise.all([
        supabase.from('purchase_requests').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('sites').select('*')
      ])

      if (requestsResult.error) throw requestsResult.error
      if (suppliersResult.error) throw suppliersResult.error
      if (sitesResult.error) throw sitesResult.error

      const requests = requestsResult.data || []
      const suppliers = suppliersResult.data || []
      const sites = sitesResult.data || []

      // Temel istatistikler
      const totalRequests = requests.length
      const totalSuppliers = suppliers.length
      const totalSites = sites.length
      const totalAmount = requests.reduce((sum, req) => sum + (parseFloat(req.total_amount) || 0), 0)

      // Büyüme hesaplamaları (geçen ay vs bu ay)
      const now = new Date()
      const currentMonth = now.getMonth()
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
      const currentYear = now.getFullYear()
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

      const currentMonthRequests = requests.filter(r => {
        const date = new Date(r.created_at)
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear
      })

      const lastMonthRequests = requests.filter(r => {
        const date = new Date(r.created_at)
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
      })

      const requestGrowth = lastMonthRequests.length > 0 
        ? ((currentMonthRequests.length - lastMonthRequests.length) / lastMonthRequests.length) * 100 
        : 0

      const currentMonthAmount = currentMonthRequests.reduce((sum, req) => sum + (parseFloat(req.total_amount) || 0), 0)
      const lastMonthAmount = lastMonthRequests.reduce((sum, req) => sum + (parseFloat(req.total_amount) || 0), 0)
      
      const amountGrowth = lastMonthAmount > 0 
        ? ((currentMonthAmount - lastMonthAmount) / lastMonthAmount) * 100 
        : 0

      setStats({
        totalRequests,
        requestGrowth: Math.round(requestGrowth * 10) / 10,
        totalSuppliers,
        supplierGrowth: 5.2, // Mock değer - suppliers için tarih bilgisi yok
        totalSites,
        siteGrowth: 2.1, // Mock değer - sites için tarih bilgisi yok
        totalAmount,
        amountGrowth: Math.round(amountGrowth * 10) / 10
      })

      // Son 30 günlük günlük veri hazırla
      const dailyRequestData: DailyRequestData[] = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayRequests = requests.filter(r => {
          const reqDate = new Date(r.created_at)
          return reqDate.toISOString().split('T')[0] === dateStr
        })
        
        const dayAmount = dayRequests.reduce((sum, req) => sum + (parseFloat(req.total_amount) || 0), 0)
        
        dailyRequestData.push({
          date: date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
          requests: dayRequests.length,
          amount: dayAmount
        })
      }
      
      setDailyData(dailyRequestData)

      // Son talepleri çek - RLS politikaları otomatik filtreleme yapacak
      const { data: recentRequestsData } = await supabase
        .from('purchase_requests')
        .select(`
          id,
          title,
          status,
          created_at,
          total_amount,
          sites(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      const formattedRecentRequests = (recentRequestsData || []).map(req => ({
        id: req.id,
        title: req.title,
        status: req.status,
        created_at: req.created_at,
        total_amount: parseFloat(req.total_amount) || 0,
        site_name: (req.sites as any)?.name || 'Bilinmeyen'
      }))

      setRecentRequests(formattedRecentRequests)

    } catch (error) {
      console.error('Dashboard verileri yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₺${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `₺${(amount / 1000).toFixed(0)}K`
    }
    return `₺${amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('tr-TR')
  }

  const formatGrowth = (growth: number) => {
    const sign = growth > 0 ? '+' : ''
    return `${sign}${growth.toFixed(1)}%`
  }

  const maxRequests = Math.max(...dailyData.map(d => d.requests), 1)
  const maxAmount = Math.max(...dailyData.map(d => d.amount), 1)

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Beklemede'
      case 'approved': return 'Onaylandı'
      case 'rejected': return 'Reddedildi'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600'
      case 'approved': return 'text-green-600'
      case 'rejected': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-light text-lg">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Requests */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Talep</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalRequests)}</span>
                  <div className={`flex items-center text-sm ${
                    stats.requestGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats.requestGrowth >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    <span>{formatGrowth(stats.requestGrowth)}</span>
        </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.requestGrowth >= 0 ? 'Artış trendi' : 'Azalış trendi'} bu ay
                </p>
                <p className="text-xs text-gray-400">Tüm satın alma talepleri</p>
              </div>
              </div>
            </CardContent>
          </Card>

        {/* Total Suppliers */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Tedarikçi</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalSuppliers)}</span>
                  <div className="flex items-center text-green-600 text-sm">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>+{stats.supplierGrowth}%</span>
                </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Kayıtlı tedarikçi sayısı</p>
                <p className="text-xs text-gray-400">Aktif ve pasif dahil</p>
                </div>
              </div>
            </CardContent>
          </Card>

        {/* Total Sites */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Şantiye</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalSites)}</span>
                  <div className="flex items-center text-green-600 text-sm">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>+{stats.siteGrowth}%</span>
                </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Kayıtlı şantiye sayısı</p>
                <p className="text-xs text-gray-400">Aktif lokasyonlar</p>
                </div>
              </div>
            </CardContent>
          </Card>

        {/* Total Amount */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Tutar</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</span>
                  <div className={`flex items-center text-sm ${
                    stats.amountGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats.amountGrowth >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    <span>{formatGrowth(stats.amountGrowth)}</span>
                </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.amountGrowth >= 0 ? 'Artış' : 'Azalış'} bu ay
                </p>
                <p className="text-xs text-gray-400">Tüm taleplerin toplam tutarı</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Chart Section */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Günlük Talep Trendi</CardTitle>
              <p className="text-sm text-gray-500">Son 30 günlük talep sayıları ve tutarları</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                Son 3 ay
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-900 bg-gray-100">
                Son 30 gün
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                Son 7 gün
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full relative">
            {/* Chart Area */}
            <div className="absolute inset-0">
              <svg className="w-full h-full" viewBox="0 0 800 300">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                
                {/* Request count area (blue) */}
                {dailyData.length > 0 && (
                  <path
                    d={`M 50 ${250 - (dailyData[0].requests / maxRequests) * 200} ${dailyData.map((d, i) => 
                      `L ${50 + (i * 25)} ${250 - (d.requests / maxRequests) * 200}`
                    ).join(' ')} L ${50 + (dailyData.length - 1) * 25} 250 L 50 250 Z`}
                    fill="url(#blueGradient)"
                    opacity="0.6"
                  />
                )}
                
                {/* Amount area (orange) */}
                {dailyData.length > 0 && (
                  <path
                    d={`M 50 ${250 - (dailyData[0].amount / maxAmount) * 200} ${dailyData.map((d, i) => 
                      `L ${50 + (i * 25)} ${250 - (d.amount / maxAmount) * 200}`
                    ).join(' ')} L ${50 + (dailyData.length - 1) * 25} 250 L 50 250 Z`}
                    fill="url(#orangeGradient)"
                    opacity="0.8"
                  />
                )}
                
                {/* Define gradients */}
                <defs>
                  <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                
                {/* X-axis labels - show every 5th day */}
                {dailyData.map((d, i) => {
                  if (i % 5 === 0 || i === dailyData.length - 1) {
                    return (
                      <text
                        key={i}
                        x={50 + (i * 25)}
                        y={280}
                        textAnchor="middle"
                        className="text-xs fill-gray-500"
                      >
                        {d.date}
                      </text>
                    )
                  }
                  return null
                })}
              </svg>
            </div>
          </div>
            </CardContent>
          </Card>

      {/* Tabs Section */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-0">
          <Tabs defaultValue="outline" className="w-full">
            <div className="border-b border-gray-200">
              <div className="flex items-center justify-between px-6 py-4">
                <TabsList className="bg-transparent h-auto p-0 space-x-8">
                  <TabsTrigger 
                    value="outline" 
                    className="bg-transparent border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent rounded-none px-0 pb-2 text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:shadow-none"
                  >
                    Son Talepler
                  </TabsTrigger>
                  <TabsTrigger 
                    value="performance" 
                    className="bg-transparent border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent rounded-none px-0 pb-2 text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:shadow-none"
                  >
                    <span>Performans</span>
                    <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600 text-xs">Bu Ay</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="personnel" 
                    className="bg-transparent border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent rounded-none px-0 pb-2 text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:shadow-none"
                  >
                    <span>Şantiyeler</span>
                    <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600 text-xs">{stats.totalSites}</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="documents" 
                    className="bg-transparent border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent rounded-none px-0 pb-2 text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:shadow-none"
                  >
                    Tedarikçiler
                  </TabsTrigger>
                </TabsList>
                
                          <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Rapor Al
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                    <Plus className="h-4 w-4 mr-1" />
                    Yeni Talep
                  </Button>
                            </div>
                          </div>
                        </div>
            
            <TabsContent value="outline" className="mt-0">
              <div className="p-6">
                {/* Table Header */}
                <div className="grid grid-cols-6 gap-4 pb-4 text-sm font-medium text-gray-500 border-b border-gray-200">
                  <div></div>
                  <div>Talep Başlığı</div>
                  <div>Şantiye</div>
                  <div>Durum</div>
                  <div>Tutar</div>
                  <div>Tarih</div>
                </div>
                
                {/* Table Rows */}
                <div className="space-y-4 pt-4">
                  {recentRequests.slice(0, 5).map((request, index) => (
                    <div key={request.id} className="grid grid-cols-6 gap-4 items-center py-3 hover:bg-gray-50 rounded-lg px-2">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                      </div>
                      <div className="font-medium text-gray-900 truncate">{request.title}</div>
                      <div className="text-gray-600 truncate">{request.site_name}</div>
                      <div className={`text-sm font-medium ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                  </div>
                      <div className="text-gray-900 font-medium">{formatCurrency(request.total_amount)}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">
                          {new Date(request.created_at).toLocaleDateString('tr-TR')}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
              </div>
                    </div>
                  ))}
                  
                  {recentRequests.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Henüz talep bulunmuyor</p>
                    </div>
                  )}
                  </div>
              </div>
            </TabsContent>
            
            <TabsContent value="performance" className="mt-0">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.totalRequests}</div>
                    <div className="text-sm text-gray-600 mt-1">Toplam Talep</div>
        </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalAmount)}</div>
                    <div className="text-sm text-gray-600 mt-1">Toplam Tutar</div>
                    </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{stats.totalSuppliers}</div>
                    <div className="text-sm text-gray-600 mt-1">Aktif Tedarikçi</div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="personnel" className="mt-0">
              <div className="p-6">
                <div className="text-center py-8 text-gray-500">
                  <p>Şantiye detayları burada görüntülenecek...</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="documents" className="mt-0">
              <div className="p-6">
                <div className="text-center py-8 text-gray-500">
                  <p>Tedarikçi listesi burada görüntülenecek...</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </CardContent>
        </Card>
    </div>
  )
}