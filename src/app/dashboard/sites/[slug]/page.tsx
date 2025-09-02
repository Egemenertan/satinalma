'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  pending_requests: number
  approved_requests: number
  recent_requesters: string[]
  last_request_date?: string
  purchase_requests: PurchaseRequest[]
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
      
      // Önce tüm şantiyeleri çek
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select(`
          *,
          purchase_requests (
            id,
            title,
            request_number,
            status,
            created_at,
            total_amount,
            currency,
            urgency_level,
            requested_by,
            profiles (
              full_name,
              email
            )
          )
        `)

      if (sitesError) {
        console.error('❌ Şantiyeler çekilirken hata:', sitesError)
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

      // Onaylanan teklifleri çek
      const { data: offersData, error: offersError } = await supabase
        .from('offers')
        .select(`
          id,
          supplier_name,
          total_price,
          currency,
          delivery_days,
          created_at,
          offer_date,
          purchase_requests!inner(
            title,
            status
          )
        `)
        .eq('site_id', site.id)
        .eq('is_selected', true)
        .eq('purchase_requests.status', 'approved')
        .order('created_at', { ascending: false })

      if (offersError) throw offersError

      // İstatistikleri hesapla
      const requests = site.purchase_requests || []
      console.log('📝 Şantiyenin talepleri:', requests)

      // İstatistikleri hesapla
      const totalRequests = requests.length
      const pendingRequests = requests.filter(r => r.status === 'pending').length
      const approvedRequests = requests.filter(r => r.status === 'approved').length
      const totalAmount = requests.reduce((sum, req) => {
        const amount = typeof req.total_amount === 'string' 
          ? parseFloat(req.total_amount) 
          : req.total_amount
        return sum + (amount || 0)
      }, 0)

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

      // Onaylanan teklifleri formatla
      const approvedOffers = offersData?.map(offer => ({
        id: offer.id,
        supplier_name: offer.supplier_name,
        total_price: offer.total_price,
        currency: offer.currency,
        delivery_days: offer.delivery_days,
        request_title: (offer.purchase_requests as any)?.title || 'Bilinmeyen Talep',
        created_at: offer.created_at,
        offer_date: offer.offer_date || offer.created_at
      })) || []

      // Tüm verileri birleştir
      setSite({
        ...site,
        total_requests: totalRequests,
        total_amount: totalAmount,
        pending_requests: pendingRequests,
        approved_requests: approvedRequests,
        recent_requesters: recentRequesters,
        last_request_date: lastRequestDate,
        approved_offers: approvedOffers
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-black text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-white/70" />
              <div>
                <div className="text-2xl font-bold">{site.total_requests}</div>
                <p className="text-sm text-white/70">Toplam Talep</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-white/70" />
              <div>
                <div className="text-2xl font-bold">{site.approved_requests}</div>
                <p className="text-sm text-white/70">Onaylanan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-white/70" />
              <div>
                <div className="text-2xl font-bold">{site.pending_requests}</div>
                <p className="text-sm text-white/70">Bekleyen</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-white/70" />
              <div>
                <div className="text-2xl font-bold">{formatCurrency(site.total_amount)}</div>
                <p className="text-sm text-white/70">Toplam Tutar</p>
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
          {/* Onaylanan Teklifler */}
          {site.approved_offers && site.approved_offers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Onaylanan Teklifler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {site.approved_offers.map((offer) => (
                    <div key={offer.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{offer.request_title}</h5>
                          <p className="text-sm text-gray-600 mt-1">Tedarikçi: {offer.supplier_name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-700">
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Onaylanan Teklif Yok</h3>
                  <p className="text-gray-500">Bu şantiye için henüz onaylanmış teklif bulunmuyor.</p>
                </div>
              </CardContent>
            </Card>
          )}

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
