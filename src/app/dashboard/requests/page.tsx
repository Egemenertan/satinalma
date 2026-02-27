'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import PurchaseRequestsTable from '@/components/PurchaseRequestsTable'

import { Package, Plus, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidateStatsCache, invalidatePurchaseRequestsCache } from '@/lib/cache'

// Optimize edilmiş tek fetcher - user info, role ve stats'ı birlikte çeker
const fetchPageData = async () => {
  const supabase = createClient()
  
  // 1. Auth kontrolü
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  // 2. Profile bilgisi (tek sorgu - tüm gerekli alanlar)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, site_id')
    .eq('id', user.id)
    .single()

  // 3. Display name hazırla
  let displayName = profile?.full_name
  if (!displayName || displayName.trim() === '') {
    if (profile?.email) {
      displayName = profile.email.split('@')[0]
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    } else {
      displayName = 'Kullanıcı'
    }
  }

  // 4. Stats sorgusu - Veritabanında aggregate fonksiyonlarını kullan
  let statsQuery = supabase
    .from('purchase_requests')
    .select('status, urgency_level, id, site_id', { count: 'exact' })
  
  // Role bazlı filtreleme
  if (profile?.role === 'site_personnel') {
    statsQuery = statsQuery.eq('requested_by', user.id)
  } else if (profile?.role === 'purchasing_officer') {
    // Purchasing officer:
    // 1. Kendi sitelerine ait VE belirli statuslardaki talepler
    // 2. VEYA kendi oluşturduğu tüm talepler
    const baseStatuses = ['satın almaya gönderildi', 'sipariş verildi', 'teklif bekliyor', 'onaylandı', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered']
    const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
    
    if (userSiteIds.length > 0) {
      // Kendi sitelerine ait belirli statuslardaki talepler VEYA kendi oluşturduğu talepler
      statsQuery = statsQuery.or(
        `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${baseStatuses.join(',')})),` +
        `requested_by.eq.${user.id}`
      )
    } else {
      // Site ID'si yoksa sadece kendi oluşturduğu talepleri göster
      statsQuery = statsQuery.eq('requested_by', user.id)
    }
  } else if (profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_yonetici') {
    // Santiye depo kullanıcıları için sadece kendi sitelerine ait talepleri göster
    const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
    if (userSiteIds.length > 0) {
      statsQuery = statsQuery.in('site_id', userSiteIds)
    }
  }
  
  const { data: requests, error, count } = await statsQuery
  
  if (error) {
    console.error('Stats fetch error:', error)
    return {
      userInfo: { displayName, email: profile?.email },
      role: profile?.role || '',
      stats: { total: 0, pending: 0, approved: 0, urgent: 0 },
      pendingOrdersCount: 0
    }
  }
  
  // Client-side stats hesaplama (artık sadece görünen kayıtlar üzerinde)
  const stats = {
    total: count || 0,
    pending: requests?.filter(r => r.status === 'pending' || r.status === 'onay bekliyor').length || 0,
    approved: requests?.filter(r => ['onaylandı', 'sipariş verildi', 'gönderildi', 'teslim alındı'].includes(r.status)).length || 0,
    urgent: requests?.filter(r => r.urgency_level === 'critical' || r.urgency_level === 'high').length || 0
  }
  
  // 5. Purchasing officer için: Siparişi bekleyen talep sayısını hesapla
  let pendingOrdersCount = 0
  if (profile?.role === 'purchasing_officer' && requests && requests.length > 0) {
    try {
      const requestIds = requests.map(r => r.id)
      const { data: unorderedData } = await supabase.rpc('get_unordered_materials_count', {
        request_ids: requestIds
      })
      
      // 0'dan büyük olan talepleri say
      pendingOrdersCount = unorderedData?.filter((item: any) => item.unordered_count > 0).length || 0
    } catch (err) {
      console.warn('Pending orders count failed:', err)
    }
  }
  
  // 6. Site manager, santiye depo ve santiye depo yöneticisi için: Teslim alınmamış (gecikmiş) talep sayısını hesapla
  let overdueDeliveriesCount = 0
  let overdueRequestIds: string[] = []
  if (profile?.role === 'site_manager' || profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_yonetici') {
    try {
      // Kullanıcının sitelerine ait gecikmiş talepleri getir
      const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
      
      if (userSiteIds.length > 0) {
        const { data: overdueData } = await supabase.rpc('get_overdue_deliveries_count', {
          user_site_ids: userSiteIds
        })
        
        // Gecikmiş siparişi olan talep sayısını ve ID'lerini hesapla
        overdueDeliveriesCount = overdueData?.length || 0
        overdueRequestIds = overdueData?.map((item: any) => item.request_id) || []
      }
    } catch (err) {
      console.warn('Overdue deliveries count failed:', err)
    }
  }
  
  return {
    userInfo: { displayName, email: profile?.email },
    role: profile?.role || '',
    stats,
    pendingOrdersCount,
    overdueDeliveriesCount,
    overdueRequestIds,
    siteId: profile?.site_id
  }
}

export default function RequestsPage() {
  const router = useRouter()
  const [showUnorderedOnly, setShowUnorderedOnly] = useState(() => {
    // localStorage'dan filtreyi oku
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unordered_filter_active')
      return saved === 'true'
    }
    return false
  })
  const [showOverdueOnly, setShowOverdueOnly] = useState(() => {
    // localStorage'dan filtreyi oku
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('overdue_filter_active')
      return saved === 'true'
    }
    return false
  })
  
  // Tek SWR ile tüm sayfa verisini çek - Optimize edildi!
  const { data: pageData, error, mutate: refreshPageData } = useSWR(
    'requests_page_data',
    fetchPageData,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 saniye cache
      errorRetryCount: 3,
      fallbackData: {
        userInfo: { displayName: 'Kullanıcı', email: '' },
        role: '',
        stats: { total: 0, pending: 0, approved: 0, urgent: 0 },
        pendingOrdersCount: 0,
        overdueDeliveriesCount: 0,
        overdueRequestIds: [],
        siteId: null
      }
    }
  )
  
  // Destructure page data
  const userInfo = pageData?.userInfo
  const userRole = pageData?.role || ''
  const stats = pageData?.stats
  const pendingOrdersCount = pageData?.pendingOrdersCount || 0
  const overdueDeliveriesCount = pageData?.overdueDeliveriesCount || 0
  const overdueRequestIds = pageData?.overdueRequestIds || []
  const userSiteId = pageData?.siteId


  // Real-time updates için subscription - Optimize edildi
  useEffect(() => {
    const supabase = createClient()
    
    const subscription = supabase
      .channel('stats_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'purchase_requests' 
        }, 
        () => {
          console.log('📡 Purchase requests table update triggered')
          // Sadece ilgili cache'i yenile
          refreshPageData()
          invalidatePurchaseRequestsCache()
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'shipments' 
        }, 
        () => {
          console.log('📡 Shipments table update triggered')
          // Sadece ilgili cache'i yenile
          refreshPageData()
          invalidatePurchaseRequestsCache()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [refreshPageData])

  // showUnorderedOnly değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('unordered_filter_active', showUnorderedOnly.toString())
    }
  }, [showUnorderedOnly])
  
  // showOverdueOnly değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('overdue_filter_active', showOverdueOnly.toString())
    }
  }, [showOverdueOnly])



  return (
    <div className="px-0 pb-6 space-y-6 sm:space-y-8">
      {/* Welcome Message */}
      <div className="px-4 pt-2 space-y-2">
        <p className="text-lg text-gray-700 font-light">
          Merhaba <span className="font-medium text-gray-900">{userInfo?.displayName}</span>, hoşgeldin! 👋
        </p>
        
        {/* Sipariş Bekleyen Talepler Uyarısı - Sadece Purchasing Officer için */}
        {userRole === 'purchasing_officer' && pendingOrdersCount > 0 && (
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-white font-bold text-sm">{pendingOrdersCount}</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {pendingOrdersCount === 1 
                  ? 'Sipariş bekleyen 1 talebin var!' 
                  : `Sipariş bekleyen ${pendingOrdersCount} talebin var!`}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Bu taleplerde bazı malzemelerin siparişi verilmemiş. Lütfen kontrol et.
              </p>
            </div>
            <Button
              onClick={() => setShowUnorderedOnly(true)}
              size="sm"
              className="flex-shrink-0 bg-white hover:bg-red-500 text-red-500 border border-red-500 hover:text-white rounded-2xl px-12 py-2 text-xs font-medium  transition-all"
            >
              Göz At
            </Button>
          </div>
        )}
        
        {/* Teslim Alınmamış Siparişler Uyarısı - Site Manager, Santiye Depo ve Santiye Depo Yöneticisi için */}
        {(userRole === 'site_manager' || userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici') && overdueDeliveriesCount > 0 && (
          <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-2xl">
            <div className="flex-shrink-0">
             
            </div>
            <div className="flex-1">
              <p className="text-lg font-medium text-orange-800">
                {overdueDeliveriesCount === 1 
                  ? 'Teslim alınmamış 1 siparişin var!' 
                  : `Teslim alınmamış ${overdueDeliveriesCount} siparişin var!`}
              </p>
              <p className="text-md text-orange-600 mt-0.5">
                Lütfen teslim aldığınız siparişlerin irsaliye girişini yapın. 
                Eğer teslim gecikti ise satın almayı bilgilendirin.
              </p>
            </div>
            <Button
              onClick={() => setShowOverdueOnly(true)}
              size="sm"
              className="flex-shrink-0 bg-white hover:bg-orange-500 text-orange-500 border border-orange-500 hover:text-white rounded-2xl px-12 py-2 text-xs font-medium  transition-all"
            >
              Göz At
            </Button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="space-y-4 px-4">
        {/* Desktop: Header with button on right */}
        <div className="hidden sm:flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-normal text-gray-900">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-2 text-lg font-light">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => router.push('/dashboard/requests/create')}
              className="px-8 py-5 rounded-2xl font-light text-md  bg-black text-white hover:bg-gray-900 hover:shadow-lg transition-all duration-200"
            >
              
              Yeni Talep Oluştur
            </Button>
          </div>
        </div>

        {/* Mobile: Header with button below */}
        <div className="sm:hidden space-y-4">
          <div>
            <h1 className="text-2xl font-normal text-gray-900">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-2 text-base font-light">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard/requests/create')}
            className="w-full h-12 rounded-2xl text-md bg-black text-white hover:bg-gray-900 hover:shadow-lg transition-all duration-200"
          >
            
            Yeni Talep Oluştur
          </Button>
        </div>
      </div>

      {/* Desktop: Stats Cards then Table */}
      <div className="hidden sm:block space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-4">
          <Card className="bg-white rounded-3xl border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam Talep</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.total || 0}</span>
                    <div className="flex items-center text-green-600 text-sm">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span>+12%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Geçen aya göre artış</p>
                  <p className="text-xs text-gray-400">Tüm satın alma talepleri</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white rounded-3xl border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Bekleyen Talepler</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.pending || 0}</span>
                    <div className="flex items-center text-orange-600 text-sm">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>Bekliyor</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">İşlem gerekli</p>
                  <p className="text-xs text-gray-400">Onay bekleyen talepler</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white rounded-3xl border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Onaylanan</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.approved || 0}</span>
                    <div className="flex items-center text-green-600 text-sm">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span>Tamamlandı</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Bu ay onaylanan</p>
                  <p className="text-xs text-gray-400">Başarıyla işlenen talepler</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white rounded-3xl border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Acil Talepler</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{stats?.urgent || 0}</span>
                    <div className="flex items-center text-red-600 text-sm">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Acil</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Hemen işlem gerekli</p>
                  <p className="text-xs text-gray-400">Yüksek öncelikli talepler</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests Table */}
        <PurchaseRequestsTable 
          userRole={userRole} 
          showUnorderedOnly={showUnorderedOnly}
          onUnorderedFilterChange={setShowUnorderedOnly}
          showOverdueOnly={showOverdueOnly}
          onOverdueFilterChange={setShowOverdueOnly}
          overdueRequestIds={overdueRequestIds}
        />
      </div>

      {/* Mobile: Table first, then Stats Cards */}
      <div className="sm:hidden space-y-6">
        {/* Requests Table */}
        <PurchaseRequestsTable 
          userRole={userRole} 
          showUnorderedOnly={showUnorderedOnly}
          onUnorderedFilterChange={setShowUnorderedOnly}
          showOverdueOnly={showOverdueOnly}
          onOverdueFilterChange={setShowOverdueOnly}
          overdueRequestIds={overdueRequestIds}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 px-4">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.total || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">Talep</p>
                </div>
                <Package className="h-4 w-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Bekleyen</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.pending || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">İşlem gerekli</p>
                </div>
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Onaylanan</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.approved || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">Bu ay</p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Acil</p>
                  <span className="text-xl font-bold text-gray-900">{stats?.urgent || 0}</span>
                  <p className="text-xs text-gray-400 mt-1">Hemen işlem</p>
                </div>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
