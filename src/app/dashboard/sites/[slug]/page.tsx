'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { 
  Building2,
  Calendar,
  DollarSign,
  Package,
  User,
  Clock,
  Truck,
  ArrowLeft,
  FileText,
  TrendingUp
} from 'lucide-react'

interface PurchaseRequest {
  id: string
  title: string
  request_number: string
  status: 'draft' | 'pending' | 'awaiting_offers' | 'approved' | 'rejected' | 'cancelled'
  created_at: string
  total_amount: number
  currency: string
  urgency_level: 'low' | 'normal' | 'high' | 'critical'
  profiles: {
    full_name: string
    email: string
  }
}

interface Site {
  id: string
  name: string
  created_at: string
  updated_at: string
  approved_expenses?: number
  total_budget?: number
  total_requests: number
  total_amount: number
  requests_total?: number
  orders_total?: number
  orders_count?: number
  pending_requests: number
  approved_requests: number
  recent_requesters: string[]
  last_request_date?: string
  purchase_requests: PurchaseRequest[]
  orders?: Array<{
    id: string
    amount: number
    currency: string
    status: string
    delivery_date: string
    created_at: string
    purchase_request_id: string
  }>
  approved_offers?: Array<{
    id: string
    supplier_name: string
    total_price: number
    currency: string
    delivery_days: number
    request_title: string
    created_at: string
    offer_date: string
  }>
}

export default function SiteDetailPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const [site, setSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchSiteDetails()
  }, [params.slug])

  const createSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const fetchSiteDetails = async () => {
    try {
      setLoading(true)
      console.log('🔍 Aranan slug:', params.slug)
      
      // Auth durumunu kontrol et
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('👤 Auth user:', user)
      console.log('🔐 Auth error:', authError)
      
      // Önce sadece şantiyeleri çek (join olmadan)
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('*')

      if (sitesError) {
        console.error('❌ Şantiyeler çekilirken hata:', sitesError)
        console.error('❌ Hata detayları:', {
          message: sitesError.message,
          details: sitesError.details,
          hint: sitesError.hint,
          code: sitesError.code
        })
        throw sitesError
      }

      console.log('📊 Tüm şantiyeler:', sitesData)

      // Slug'a göre şantiyeyi bul
      const site = sitesData?.find(s => createSlug(s.name) === params.slug)
      console.log('🏗️ Bulunan şantiye:', site)
      
      if (!site) {
        setSite(null)
        return
      }

      // Purchase requests'i ayrı sorguda çek
      console.log('📋 Site ID için talepleri çekiliyor:', site.id)
      const { data: purchaseRequestsData, error: requestsError } = await supabase
        .from('purchase_requests')
        .select('id, title, request_number, status, created_at, total_amount, currency, urgency_level, requested_by')
        .eq('site_id', site.id)

      if (requestsError) {
        console.error('❌ Purchase requests hatası:', requestsError)
      } else {
        console.log('📋 Çekilen talepler:', purchaseRequestsData)
        // Purchase requests'i site objesine ekle
        site.purchase_requests = purchaseRequestsData || []
      }

      // Orders'ları site'a ait purchase requests'ler üzerinden çek
      console.log('📦 Site için siparişleri çekiliyor...')
      const purchaseRequestIds = site.purchase_requests?.map(pr => pr.id) || []
      
      let ordersData = []
      if (purchaseRequestIds.length > 0) {
        const { data: fetchedOrders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            amount,
            currency,
            status,
            delivery_date,
            created_at,
            purchase_request_id
          `)
          .in('purchase_request_id', purchaseRequestIds)

        if (ordersError) {
          console.error('❌ Orders hatası:', ordersError)
        } else {
          console.log('📦 Çekilen siparişler:', fetchedOrders)
          ordersData = fetchedOrders || []
        }
      }

      // Onaylanan teklifleri çek (basitleştirilmiş sorgu)
      console.log('🎯 Site ID için teklifler aranıyor:', site.id)
      const { data: offersData, error: offersError } = await supabase
        .from('offers')
        .select('id, supplier_name, total_price, currency, delivery_days, created_at, offer_date, purchase_request_id')
        .eq('site_id', site.id)
        .eq('is_selected', true)
        .order('created_at', { ascending: false })

      if (offersError) {
        console.error('❌ Teklifler çekilirken hata:', offersError)
        console.error('❌ Teklif hata detayları:', {
          message: offersError.message,
          details: offersError.details,
          hint: offersError.hint,
          code: offersError.code
        })
        throw offersError
      }
      
      console.log('💰 Çekilen teklifler:', offersData)

      // İstatistikleri hesapla
      const requests = site.purchase_requests || []
      console.log('📝 Şantiyenin talepleri:', requests)

      // İstatistikleri hesapla
      const totalRequests = requests.length
      const pendingRequests = requests.filter(r => r.status === 'pending').length
      const approvedRequests = requests.filter(r => r.status === 'approved').length
      
      // Purchase requests toplam tutarı
      const requestsTotalAmount = requests.reduce((sum, req) => {
        const amount = typeof req.total_amount === 'string' 
          ? parseFloat(req.total_amount) 
          : req.total_amount
        return sum + (amount || 0)
      }, 0)

      // Orders toplam tutarı
      const ordersTotalAmount = ordersData.reduce((sum, order) => {
        const amount = typeof order.amount === 'string' 
          ? parseFloat(order.amount) 
          : order.amount
        return sum + (amount || 0)
      }, 0)

      // Toplam tutar (requests + orders)
      const totalAmount = requestsTotalAmount + ordersTotalAmount
      
      console.log('💰 İstatistikler:', {
        requestsTotal: requestsTotalAmount,
        ordersTotal: ordersTotalAmount,
        grandTotal: totalAmount,
        ordersCount: ordersData.length
      })

      // Son talep edenleri al
      const requesterNames = requests
        .slice(0, 5)
        .map(req => {
          const profile = req.profiles as { full_name?: string } | null
          return profile?.full_name
        })
        .filter((name): name is string => Boolean(name))
      
      const uniqueRequesters = Array.from(new Set(requesterNames))
      const recentRequesters = uniqueRequesters.slice(0, 3)

      // Son talep tarihini bul
      const sortedRequests = [...requests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const lastRequestDate = sortedRequests.length > 0 ? sortedRequests[0].created_at : undefined

      // Onaylanan teklifleri formatla (purchase request bilgilerini manuel olarak eşleştir)
      const approvedOffers = offersData?.map(offer => {
        // İlgili purchase request'i bul
        const relatedRequest = site.purchase_requests?.find(pr => pr.id === offer.purchase_request_id)
        return {
          id: offer.id,
          supplier_name: offer.supplier_name,
          total_price: offer.total_price,
          currency: offer.currency,
          delivery_days: offer.delivery_days,
          request_title: relatedRequest?.title || 'Bilinmeyen Talep',
          created_at: offer.created_at,
          offer_date: offer.offer_date || offer.created_at
        }
      }) || []

      // Tüm verileri birleştir
      setSite({
        ...site,
        total_requests: totalRequests,
        total_amount: totalAmount,
        requests_total: requestsTotalAmount,
        orders_total: ordersTotalAmount,
        orders_count: ordersData.length,
        pending_requests: pendingRequests,
        approved_requests: approvedRequests,
        recent_requesters: recentRequesters,
        last_request_date: lastRequestDate,
        approved_offers: approvedOffers,
        orders: ordersData
      })

    } catch (error: any) {
      console.error('Şantiye detayları yüklenirken hata:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error: error
      })
      
      // Supabase hata detaylarını kontrol et
      if (error?.code === 'PGRST116') {
        console.error('Foreign key violation - İlişkili tablolarda hata var')
      }
      
      setSite(null)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-medium">Şantiye detayları yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Şantiye Bulunamadı</h2>
          <p className="text-gray-600 mb-4">İstediğiniz şantiye bilgilerine ulaşılamadı.</p>
          <Button onClick={() => router.back()}>Geri Dön</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-normal text-gray-900">{site.name}</h1>
            <p className="text-gray-600 mt-1">Şantiye Detayları</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="bg-white border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-300 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 bg-gray-50 rounded-lg flex-shrink-0">
                  <FileText className="w-4 h-4 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-gray-900 truncate">{site.total_requests}</div>
                  <p className="text-xs text-gray-600 truncate">Toplam Talep</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-medium text-gray-900">Bugün</div>
                <div className="text-xs text-gray-500">+{Math.floor(Math.random() * 3)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-300 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 bg-green-50 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-green-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-gray-900 truncate">{site.approved_requests}</div>
                  <p className="text-xs text-gray-600 truncate">Onaylanan</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-medium text-gray-900">Bu Ay</div>
                <div className="text-xs text-gray-500">{site.approved_requests}/{site.total_requests}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-300 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 bg-yellow-50 rounded-lg flex-shrink-0">
                  <Clock className="w-4 h-4 text-yellow-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-gray-900 truncate">{site.pending_requests}</div>
                  <p className="text-xs text-gray-600 truncate">Bekleyen</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-medium text-gray-900">Aktif</div>
                <div className="text-xs text-gray-500">{((site.pending_requests / site.total_requests) * 100).toFixed(0)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-300 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 bg-blue-50 rounded-lg flex-shrink-0">
                  <Package className="w-4 h-4 text-blue-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-gray-900 truncate">{site.orders_count || 0}</div>
                  <p className="text-xs text-gray-600 truncate">Sipariş</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-medium text-gray-900">Tutar</div>
                <div className="text-xs text-gray-500 truncate">
                  {(site.orders_total || 0) > 1000000 
                    ? ((site.orders_total || 0) / 1000000).toFixed(1) + 'M' 
                    : ((site.orders_total || 0) / 1000).toFixed(1) + 'K'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-300 min-w-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="p-1.5 bg-purple-50 rounded-lg flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-purple-700" />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-gray-900 truncate">
                    {(site.total_amount || 0) > 1000000 
                      ? ((site.total_amount || 0) / 1000000).toFixed(1) + 'M ₺' 
                      : ((site.total_amount || 0) / 1000).toFixed(1) + 'K ₺'}
                  </div>
                  <p className="text-xs text-gray-600 truncate">Toplam Tutar</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-medium text-gray-900">Ortalama</div>
                <div className="text-xs text-gray-500 truncate">
                  {(((site.total_amount || 0) / (site.total_requests || 1)) / 1000).toFixed(1)}K
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sol Panel */}
        <div className="space-y-6">
          {/* Temel Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Temel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Oluşturulma: {formatDate(site.created_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>Son Güncelleme: {formatDate(site.updated_at)}</span>
              </div>
              {site.last_request_date && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span>Son Talep: {formatDate(site.last_request_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bütçe Bilgileri */}
          {(site.approved_expenses || 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Bütçe Durumu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Onaylanan Harcama</span>
                    <span className="font-semibold">{formatCurrency(site.approved_expenses || 0)}</span>
                  </div>
                  {site.total_budget && site.total_budget > 0 && (
                    <>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Toplam Bütçe</span>
                        <span className="font-semibold">{formatCurrency(site.total_budget)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-blue-700 mb-1">
                        <span>Kullanım Oranı</span>
                        <span>{((site.approved_expenses || 0) / site.total_budget * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(((site.approved_expenses || 0) / site.total_budget * 100), 100)}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Son Talep Edenler */}
          {site.recent_requesters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Son Talep Edenler</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {site.recent_requesters.map((requester, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">{requester}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sağ Panel */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="offers" className="w-full">
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="offers" className="flex-1">Onaylanan Teklifler</TabsTrigger>
                  <TabsTrigger value="orders" className="flex-1">Siparişler</TabsTrigger>
                </TabsList>

                <TabsContent value="offers" className="p-6">
                  {/* Onaylanan Teklifler */}
                  {site.approved_offers && site.approved_offers.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-5 h-5 text-gray-600" />
                        <h3 className="text-lg font-semibold">Onaylanan Teklifler</h3>
                      </div>
                      {site.approved_offers.map((offer) => (
                    <div key={offer.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{offer.request_title}</h5>
                          <p className="text-sm text-gray-600 mt-1">Tedarikçi: {offer.supplier_name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(offer.total_price)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {offer.currency || 'TRY'}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Truck className="w-4 h-4" />
                          {offer.delivery_days} gün teslimat
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(offer.offer_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">Onaylanan Teklif Yok</h3>
                      <p className="text-gray-500">Bu şantiye için henüz onaylanmış teklif bulunmuyor.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="orders" className="p-6">
                  {/* Siparişler */}
                  {site.orders && site.orders.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-gray-600" />
                        <h3 className="text-lg font-semibold">Siparişler ({site.orders_count})</h3>
                        <div className="ml-auto text-sm text-gray-600">
                          Toplam: {(site.orders_total || 0) > 1000000 
                            ? ((site.orders_total || 0) / 1000000).toFixed(1) + 'M ₺' 
                            : ((site.orders_total || 0) / 1000).toFixed(1) + 'K ₺'}
                        </div>
                      </div>
                      {site.orders.map((order) => {
                        // İlgili purchase request'i bul
                        const relatedRequest = site.purchase_requests?.find(pr => pr.id === order.purchase_request_id)
                        
                        return (
                          <div key={order.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900">
                                  {relatedRequest?.title || 'Bilinmeyen Talep'}
                                </h5>
                                <p className="text-sm text-gray-600 mt-1">
                                  Talep No: {relatedRequest?.request_number || '-'}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-lg text-gray-900">
                                  {formatCurrency(order.amount)}
                                </div>
                                <Badge className={`mt-1 ${
                                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  order.status === 'approved' ? 'bg-gray-100 text-gray-800' :
                                  order.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {order.status === 'completed' ? 'Tamamlandı' :
                                   order.status === 'approved' ? 'Onaylandı' :
                                   order.status === 'rejected' ? 'Reddedildi' :
                                   'Beklemede'}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Truck className="w-4 h-4" />
                                Teslimat: {formatDate(order.delivery_date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(order.created_at)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">Sipariş Yok</h3>
                      <p className="text-gray-500">Bu şantiye için henüz sipariş bulunmuyor.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button 
              onClick={() => router.push(`/dashboard/requests?site=${site.id}`)}
              className="flex-1 bg-black hover:bg-gray-900"
            >
              <FileText className="w-4 h-4 mr-2" />
              Talepleri Görüntüle
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
