'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Download,
  Calendar,
  Building2,
  Users,
  Package,
  DollarSign,
  FileText,
  Eye,
  Filter,
  Clock,
  CheckCircle2
} from 'lucide-react'
// import { type ReportData } from '@/lib/pdf-generator'

interface CompletedRequest {
  id: string
  title: string
  request_number: string
  created_at: string
  requested_by: string
  status: string
  site_name: string
  material_class: string
  delivery_date?: string
  delivered_at?: string
  supplier_name?: string
  total_amount?: number
  currency?: string
}

export default function ReportsPage() {
  const supabase = createClient()
  const [dateRange, setDateRange] = useState('last_30_days')
  const [selectedSite, setSelectedSite] = useState('all')
  const [completedRequests, setCompletedRequests] = useState<CompletedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null)
  const [reportData, setReportData] = useState({
    totalRequests: 45,
    totalSpent: 127650,
    avgProcessTime: 5.2,
    topSuppliers: [
      { name: 'Akçelik İnşaat', orders: 12, amount: 45230 },
      { name: 'Bozkurt Elektrik', orders: 8, amount: 32100 },
      { name: 'Çelik Tesisat', orders: 6, amount: 28900 }
    ],
    costByCategory: [
      { category: 'Yapı Malzemeleri', amount: 68400, percentage: 53.6 },
      { category: 'Elektrik', amount: 32100, percentage: 25.1 },
      { category: 'Tesisat', amount: 18900, percentage: 14.8 },
      { category: 'Diğer', amount: 8250, percentage: 6.5 }
    ],
    monthlyTrend: [
      { month: 'Ocak', requests: 15, amount: 42300 },
      { month: 'Şubat', requests: 18, amount: 38900 },
      { month: 'Mart', requests: 22, amount: 46450 }
    ]
  })

  // Teslim alınan talepleri çek
  const fetchCompletedRequests = async () => {
    try {
      setLoading(true)

      // Önce tüm talep durumlarını kontrol et
      const { data: allRequests } = await supabase
        .from('purchase_requests')
        .select('status')
      
      console.log('📊 Tüm talep durumları:', {
        statuses: allRequests?.reduce((acc, req) => {
          acc[req.status] = (acc[req.status] || 0) + 1
          return acc
        }, {})
      })
      
      const { data: requests, error } = await supabase
        .from('purchase_requests')
        .select('id, title, created_at, status, site_name, material_class, requested_by')
        .in('status', ['teslim alındı', 'sipariş verildi'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Tamamlanan talepler alınırken hata:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        })
        return
      }

      console.log('🔍 Teslim alınan talepler sorgusu sonucu:', {
        count: requests?.length || 0,
        requests: requests?.map(r => ({ id: r.id.slice(0,8), title: r.title, status: r.status }))
      })

      const formattedRequests: CompletedRequest[] = (requests || []).map(request => ({
        id: request.id,
        title: request.title,
        request_number: `REQ-${request.id.slice(0, 8)}`,
        created_at: request.created_at,
        requested_by: 'Kullanıcı', // Basitleştirildi
        status: request.status,
        site_name: request.site_name || 'Belirtilmemiş',
        material_class: request.material_class,
        delivery_date: undefined, // Basitleştirildi
        delivered_at: undefined, // Basitleştirildi
        supplier_name: undefined, // Basitleştirildi
        total_amount: undefined, // Basitleştirildi
        currency: 'TRY'
      }))

      setCompletedRequests(formattedRequests)
    } catch (error) {
      console.error('Hata:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompletedRequests()
  }, [])

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const generatePDFReport = async (request: CompletedRequest) => {
    try {
      setGeneratingPDF(request.id)
      
      // Timeline verilerini API'den al
      const response = await fetch(`/api/reports/timeline?requestId=${request.id}`)
      
      if (!response.ok) {
        throw new Error('Timeline verileri alınamadı')
      }
      
      const timelineData = await response.json()
      
      // PDF generator'ı dynamic import ile yükle
      const { generatePurchaseRequestReport } = await import('@/lib/pdf-generator')
      
      // PDF oluştur ve indir
      await generatePurchaseRequestReport(timelineData)
      
    } catch (error) {
      console.error('PDF raporu oluşturulurken hata:', error)
      alert('Rapor oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const getPerformanceCard = (title: string, value: string, change: number, icon: React.ElementType) => {
    const Icon = icon
    const isPositive = change > 0
    const isNegative = change < 0

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-2xl font-normal text-gray-900">{value}</p>
              <div className="flex items-center mt-1">
                {isPositive && <TrendingUp className="w-4 h-4 text-green-500 mr-1" />}
                {isNegative && <TrendingDown className="w-4 h-4 text-red-500 mr-1" />}
                <span className={`text-sm ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'}`}>
                  {isPositive ? '+' : ''}{change}% geçen aya göre
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Icon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Raporlar ve Analitik</h1>
          <p className="text-gray-600 mt-2">Satın alma performansını analiz edin ve raporları görüntüleyin</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_7_days">Son 7 Gün</SelectItem>
              <SelectItem value="last_30_days">Son 30 Gün</SelectItem>
              <SelectItem value="last_3_months">Son 3 Ay</SelectItem>
              <SelectItem value="last_year">Son 1 Yıl</SelectItem>
              <SelectItem value="custom">Özel Tarih</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Raporu İndir
          </Button>
        </div>
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {getPerformanceCard('Toplam Talep', reportData.totalRequests.toString(), 12.5, Package)}
        {getPerformanceCard('Toplam Harcama', formatCurrency(reportData.totalSpent), -8.2, DollarSign)}
        {getPerformanceCard('Ort. İşlem Süresi', `${reportData.avgProcessTime} gün`, -15.3, Calendar)}
        {getPerformanceCard('Aktif Tedarikçi', '24', 4.2, Users)}
      </div>

      {/* Main Reports */}
      <Tabs defaultValue="completed" className="space-y-6">
        <TabsList>
          <TabsTrigger value="completed">Tamamlanan Talepler</TabsTrigger>
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="procurement">Satın Alma</TabsTrigger>
          <TabsTrigger value="suppliers">Tedarikçiler</TabsTrigger>
          <TabsTrigger value="financial">Finansal</TabsTrigger>
        </TabsList>

        <TabsContent value="completed" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Teslim Alınan Talepler
              </CardTitle>
              <p className="text-sm text-gray-600">
                Tamamlanan taleplerin detaylı raporlarını oluşturun
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Talepler yükleniyor...</span>
                </div>
              ) : completedRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Teslim Alınan Talep Bulunamadı</h3>
                  <p className="text-gray-600">Henüz teslim alınan talep bulunmuyor.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Talep No</TableHead>
                        <TableHead>Talep Başlığı</TableHead>
                        <TableHead>Oluşturan</TableHead>
                        <TableHead>Şantiye</TableHead>
                        <TableHead>Tedarikçi</TableHead>
                        <TableHead>Tutar</TableHead>
                        <TableHead>Oluşturulma</TableHead>
                        <TableHead>Teslim Alma</TableHead>
                        <TableHead>İşlemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {request.request_number}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px] truncate">
                              {request.title}
                            </div>
                          </TableCell>
                          <TableCell>{request.requested_by}</TableCell>
                          <TableCell>{request.site_name}</TableCell>
                          <TableCell>{request.supplier_name || '-'}</TableCell>
                          <TableCell>
                            {request.total_amount 
                              ? `${request.total_amount.toLocaleString('tr-TR')} ${request.currency}`
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(request.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {request.delivered_at 
                                ? formatDate(request.delivered_at)
                                : '-'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => generatePDFReport(request)}
                              disabled={generatingPDF === request.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
                            >
                              {generatingPDF === request.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                                  Oluşturuluyor...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4 mr-1" />
                                  Rapor Oluştur
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Kategori Bazlı Harcama
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.costByCategory.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.category}</span>
                        <span className="text-gray-600">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        %{item.percentage}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Suppliers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  En Çok Çalışılan Tedarikçiler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.topSuppliers.map((supplier, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium">{supplier.name}</div>
                          <div className="text-sm text-gray-600">{supplier.orders} sipariş</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(supplier.amount)}</div>
                        <div className="text-sm text-gray-600">Toplam</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Aylık Trend Analizi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {reportData.monthlyTrend.map((month, index) => (
                  <div key={index} className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-normal text-gray-900">{month.requests}</div>
                    <div className="text-sm text-gray-600 mb-2">{month.month} Talepleri</div>
                    <div className="text-lg font-medium text-green-600">{formatCurrency(month.amount)}</div>
                    <div className="text-xs text-gray-500">Toplam Harcama</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procurement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Talep Durumu Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <span className="font-medium">Teklif Bekleyen</span>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">8</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium">Onay Bekleyen</span>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">5</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="font-medium">Onaylanan</span>
                    <Badge variant="outline" className="bg-green-100 text-green-800">12</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="font-medium">Sipariş Edilen</span>
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">20</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aciliyet Seviyesi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="font-medium text-red-800">Acil</span>
                    <Badge variant="destructive">3</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <span className="font-medium text-yellow-800">Normal</span>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">28</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-green-800">Rutin</span>
                    <Badge variant="outline" className="bg-green-100 text-green-800">14</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tedarikçi Performans Raporu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tedarikçi Analizi</h3>
                <p className="text-gray-600">Detaylı tedarikçi performans raporları geliştiriliyor</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Finansal Analiz</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Maliyet Analizi</h3>
                <p className="text-gray-600">Detaylı finansal raporlar ve maliyet analizi yakında</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı Raporlar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-16 flex-col gap-2">
              <FileText className="w-5 h-5" />
              <span>Aylık Özet</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-2">
              <BarChart3 className="w-5 h-5" />
              <span>Performans Raporu</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-2">
              <DollarSign className="w-5 h-5" />
              <span>Maliyet Analizi</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


