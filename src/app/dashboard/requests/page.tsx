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
import {
  isProfileDepartmentIt,
  fetchPurchaseRequestIdsVisibleToItWarehouseManager
} from '@/lib/warehouse-it-material-filter'

// Haftalık/aylık aktivite verisi için fetcher - Gerçek veriler
const fetchWeeklyActivity = async (
  userId: string, 
  role: string, 
  isMobile: boolean = false, 
  siteId?: string | string[], 
  department?: string,
  /** IT warehouse_manager: görünür talep id'leri */
  wmItScopedIds?: string[]
) => {
  const supabase = createClient()
  
  // Desktop için 30 gün, Mobile için 10 gün
  const days = isMobile ? 10 : 30
  
  // Tarih aralığını hesapla
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)
  
  // Veritabanından talepleri çek
  let query = supabase
    .from('purchase_requests')
    .select('created_at, id')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
  
  // Role bazlı filtreleme
  if (role === 'site_personnel') {
    query = query.eq('requested_by', userId)
  } else if (role === 'purchasing_officer') {
    // Purchasing officer için: kendi oluşturduğu veya sitelerine ait talepler
    const userSiteIds = Array.isArray(siteId) ? siteId : (siteId ? [siteId] : [])
    if (userSiteIds.length > 0) {
      query = query.or(`requested_by.eq.${userId},site_id.in.(${userSiteIds.join(',')})`)
    } else {
      query = query.eq('requested_by', userId)
    }
  } else if (role === 'santiye_depo' || role === 'santiye_depo_yonetici' || role === 'site_manager') {
    // Santiye depo ve site manager için sadece kendi sitelerine ait
    const userSiteIds = Array.isArray(siteId) ? siteId : (siteId ? [siteId] : [])
    if (userSiteIds.length > 0) {
      query = query.in('site_id', userSiteIds)
    }
  } else if (role === 'department_head') {
    // Department head için GMO + departmanına ait
    const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    const userDepartment = department || 'Genel'
    query = query.eq('site_id', GMO_SITE_ID).eq('department', userDepartment)
  } else if (role === 'warehouse_manager') {
    query = query.neq('status', 'departman_onayı_bekliyor')
    if (wmItScopedIds !== undefined) {
      if (wmItScopedIds.length === 0) return []
      query = query.in('id', wmItScopedIds)
    }
  }

  // Departman filtresi: profilde department doluysa, sadece o departmana ait aktivite.
  // department_head zaten kendi mantığında uyguluyor, tekrar uygulanmaz.
  // IT depo yöneticisi için talebin departman alanı kullanılmaz (malzeme grubu filtresi var).
  if (
    role !== 'department_head' &&
    department &&
    !(role === 'warehouse_manager' && isProfileDepartmentIt(department))
  ) {
    query = query.eq('department', department)
  }
  
  const { data: requests, error } = await query
  
  if (error) {
    console.error('Activity data fetch error:', error)
    return []
  }
  
  // Günlük olarak grupla
  const dailyCounts: Record<string, number> = {}
  
  // Önce tüm günleri 0 ile başlat
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateKey = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
    dailyCounts[dateKey] = 0
  }
  
  // Talepleri günlere göre say
  requests?.forEach(request => {
    const requestDate = new Date(request.created_at)
    const dateKey = requestDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
    if (dailyCounts.hasOwnProperty(dateKey)) {
      dailyCounts[dateKey]++
    }
  })
  
  // Array'e çevir
  const activityData = Object.entries(dailyCounts).map(([date, count]) => ({
    date,
    count
  }))
  
  return activityData
}

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
    .select('full_name, email, role, site_id, department')
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
  
  // IT depo yöneticisi: malzeme grubu kapsamındaki talepler
  let wmItScopedIds: string[] | undefined
  if (profile?.role === 'warehouse_manager' && isProfileDepartmentIt(profile?.department)) {
    wmItScopedIds = await fetchPurchaseRequestIdsVisibleToItWarehouseManager(supabase)
  }

  // Aktivite verisini çek (desktop için 30 gün, mobile için 10 gün)
  const weeklyActivity = await fetchWeeklyActivity(
    user.id,
    profile?.role || '',
    false,
    profile?.site_id,
    profile?.department,
    wmItScopedIds
  )
  const mobileActivity = await fetchWeeklyActivity(
    user.id,
    profile?.role || '',
    true,
    profile?.site_id,
    profile?.department,
    wmItScopedIds
  )

  // 4. Stats sorgusu - Veritabanında aggregate fonksiyonlarını kullan
  let statsQuery = supabase
    .from('purchase_requests')
    .select('status, urgency_level, id, site_id', { count: 'exact' })
  
  // Role bazlı filtreleme
  if (profile?.role === 'site_personnel') {
    statsQuery = statsQuery.eq('requested_by', user.id)
  } else if (profile?.role === 'department_head') {
    // Department head: Sadece GMO + kendi departmanı
    const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    const userDepartment = profile.department || 'Genel'
    
    statsQuery = statsQuery
      .eq('site_id', GMO_SITE_ID)
      .eq('department', userDepartment)
    
    console.log(`📊 Department head filtresi: Site=GMO, Department=${userDepartment}`)
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
  } else if (profile?.role === 'warehouse_manager') {
    // Warehouse Manager: departman_onayı_bekliyor statusundaki talepleri görmesin
    statsQuery = statsQuery.neq('status', 'departman_onayı_bekliyor')
  } else if (profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_yonetici') {
    // Santiye depo kullanıcıları için sadece kendi sitelerine ait talepleri göster
    const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
    if (userSiteIds.length > 0) {
      statsQuery = statsQuery.in('site_id', userSiteIds)
    }
  }

  // Departman filtresi: profilde department doluysa, istatistikler de o departmana göre.
  // department_head zaten kendi blok mantığında uyguluyor.
  const skipDeptFilterItWm =
    profile?.role === 'warehouse_manager' && isProfileDepartmentIt(profile?.department)

  if (profile?.role !== 'department_head' && profile?.department && !skipDeptFilterItWm) {
    statsQuery = statsQuery.eq('department', profile.department)
  }

  if (wmItScopedIds !== undefined) {
    if (wmItScopedIds.length === 0) {
      statsQuery = statsQuery.eq('id', '00000000-0000-4000-a000-000000000003')
    } else {
      statsQuery = statsQuery.in('id', wmItScopedIds)
    }
  }
  
  const { data: requests, error, count } = await statsQuery
  
  if (error) {
    console.error('Stats fetch error:', error)
    return {
      userInfo: { displayName, email: profile?.email },
      role: profile?.role || '',
      stats: { total: 0, pending: 0, approved: 0, urgent: 0, thisMonth: 0, monthlyData: [], monthChange: 0 },
      pendingOrdersCount: 0
    }
  }
  
  // Son 6 aylık veri için hesaplama
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date()
    monthStart.setMonth(monthStart.getMonth() - i)
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)
    
    let monthQuery = supabase
      .from('purchase_requests')
      .select('id', { count: 'exact' })
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())
    
    // Aynı filtreleri uygula
    if (profile?.role === 'site_personnel') {
      monthQuery = monthQuery.eq('requested_by', user.id)
    } else if (profile?.role === 'department_head') {
      const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
      const userDepartment = profile.department || 'Genel'
      monthQuery = monthQuery.eq('site_id', GMO_SITE_ID).eq('department', userDepartment)
    } else if (profile?.role === 'purchasing_officer') {
      const baseStatuses = ['satın almaya gönderildi', 'sipariş verildi', 'teklif bekliyor', 'onaylandı', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered']
      const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
      if (userSiteIds.length > 0) {
        monthQuery = monthQuery.or(
          `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${baseStatuses.join(',')})),` +
          `requested_by.eq.${user.id}`
        )
      } else {
        monthQuery = monthQuery.eq('requested_by', user.id)
      }
    } else if (profile?.role === 'warehouse_manager') {
      monthQuery = monthQuery.neq('status', 'departman_onayı_bekliyor')
    } else if (profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_yonetici') {
      const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
      if (userSiteIds.length > 0) {
        monthQuery = monthQuery.in('site_id', userSiteIds)
      }
    }

    // Departman filtresi: profilde department doluysa, aylık dağılım da o departmana göre.
    const skipDeptMonthly =
      profile?.role === 'warehouse_manager' && isProfileDepartmentIt(profile?.department)
    if (profile?.role !== 'department_head' && profile?.department && !skipDeptMonthly) {
      monthQuery = monthQuery.eq('department', profile.department)
    }

    if (wmItScopedIds !== undefined) {
      if (wmItScopedIds.length === 0) {
        monthQuery = monthQuery.eq('id', '00000000-0000-4000-a000-000000000003')
      } else {
        monthQuery = monthQuery.in('id', wmItScopedIds)
      }
    }
    
    const { count } = await monthQuery
    monthlyData.push({
      month: monthStart.toLocaleDateString('tr-TR', { month: 'short' }),
      count: count || 0
    })
  }
  
  const thisMonthCount = monthlyData[5]?.count || 0
  const lastMonthCount = monthlyData[4]?.count || 0
  const monthChange = lastMonthCount > 0 ? ((thisMonthCount - lastMonthCount) / lastMonthCount * 100).toFixed(1) : 0
  
  // Client-side stats hesaplama (artık sadece görünen kayıtlar üzerinde)
  const stats = {
    total: count || 0,
    pending: requests?.filter(r => r.status === 'pending' || r.status === 'onay bekliyor').length || 0,
    approved: requests?.filter(r => ['onaylandı', 'sipariş verildi', 'gönderildi', 'teslim alındı'].includes(r.status)).length || 0,
    urgent: requests?.filter(r => r.urgency_level === 'critical' || r.urgency_level === 'high').length || 0,
    thisMonth: thisMonthCount || 0,
    monthlyData,
    monthChange: parseFloat(monthChange as string)
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
    siteId: profile?.site_id,
    weeklyActivity,
    mobileActivity
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
  
  // Tooltip için state'ler
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; count: number; date: string } | null>(null)
  const [hoveredPointMobile, setHoveredPointMobile] = useState<{ x: number; y: number; count: number; date: string } | null>(null)
  
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
        stats: { total: 0, pending: 0, approved: 0, urgent: 0, thisMonth: 0, monthlyData: [], monthChange: 0 },
        pendingOrdersCount: 0,
        overdueDeliveriesCount: 0,
        overdueRequestIds: [],
        siteId: null,
        weeklyActivity: [],
        mobileActivity: []
      }
    }
  )
  
  // Destructure page data
  const userInfo = pageData?.userInfo
  const userRole = pageData?.role || ''
  const isSitePersonnel = userRole === 'site_personnel'
  const stats = pageData?.stats
  const pendingOrdersCount = pageData?.pendingOrdersCount || 0
  const overdueDeliveriesCount = pageData?.overdueDeliveriesCount || 0
  const overdueRequestIds = pageData?.overdueRequestIds || []
  const userSiteId = pageData?.siteId
  const weeklyActivity = pageData?.weeklyActivity || []
  const mobileActivity = pageData?.mobileActivity || []


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

  // Sadece "Yeni talep oluştur" akışından dönünce bir ekran yüksekliği kadar aşağı kaydır
  useEffect(() => {
    let cancelled = false
    try {
      if (typeof window === 'undefined') return
      if (sessionStorage.getItem('requests_scroll_from_create') !== '1') return
    } catch {
      return
    }
    const scrollOneViewport = () => {
      if (cancelled || typeof window === 'undefined') return
      try {
        sessionStorage.removeItem('requests_scroll_from_create')
      } catch {
        /* ignore */
      }
      const vh = window.innerHeight
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      )
      const target = Math.min(window.scrollY + vh, maxScroll)
      window.scrollTo({ top: target, behavior: 'smooth' })
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(scrollOneViewport)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [])

  // Site ID kontrolü - site_personnel, site_manager, santiye_depo ve santiye_depo_yonetici rolleri için
  const hasSiteAssignment = userSiteId && (
    Array.isArray(userSiteId) ? userSiteId.length > 0 : true
  )
  const requiresSiteId = ['site_personnel', 'site_manager', 'santiye_depo', 'santiye_depo_yonetici'].includes(userRole)
  const showSiteWarning = requiresSiteId && !hasSiteAssignment

  return (
    <div className="px-0 pb-6 space-y-6 sm:space-y-8">
      {/* Welcome Message */}
      <div className="px-4 pt-2 space-y-2">
        <p className="text-lg text-gray-700">
          Merhaba <span className="font-medium text-gray-900">{userInfo?.displayName}</span>, hoşgeldin! 👋
        </p>
        
        {/* Site Ataması Yapılmamış Uyarısı - KRİTİK */}
        {showSiteWarning && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
            <div className="flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">
                Site Ataması Bekleniyor
              </p>
              <p className="text-sm text-red-700 mt-1">
               Talep oluşturabilmek için lütfen departman yöneticinizin giriş yapmasını bekleyin.
              </p>
            
            </div>
          </div>
        )}
        
        {/* Sipariş Bekleyen Talepler Uyarısı - Sadece Purchasing Officer için */}
        {userRole === 'purchasing_officer' && pendingOrdersCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-[#00E676]/5 border border-[#00E676]/20 rounded-2xl">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-[#00E676] rounded-full flex items-center justify-center animate-pulse">
                <span className="text-white font-bold text-sm">{pendingOrdersCount}</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#00E676]">
                {pendingOrdersCount === 1 
                  ? 'Sipariş bekleyen 1 talebin var!' 
                  : `Sipariş bekleyen ${pendingOrdersCount} talebin var!`}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Bu taleplerde bazı malzemelerin siparişi verilmemiş. Lütfen kontrol et.
              </p>
            </div>
            <Button
              onClick={() => setShowUnorderedOnly(true)}
              size="sm"
              className="flex-shrink-0 bg-white hover:bg-[#00E676] text-[#00E676] border border-[#00E676] hover:text-white rounded-2xl px-12 py-2 text-xs font-medium transition-all"
            >
              Göz At
            </Button>
          </div>
        )}
        
        {/* Teslim Alınmamış Siparişler Uyarısı - Site Manager, Santiye Depo ve Santiye Depo Yöneticisi için */}
        {(userRole === 'site_manager' || userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici') && overdueDeliveriesCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-[#00E676]/5 border border-[#00E676]/20 rounded-2xl">
            <div className="flex-shrink-0">
             
            </div>
            <div className="flex-1">
              <p className="text-lg font-medium text-[#00E676]">
                {overdueDeliveriesCount === 1 
                  ? 'Teslim alınmamış 1 siparişin var!' 
                  : `Teslim alınmamış ${overdueDeliveriesCount} siparişin var!`}
              </p>
              <p className="text-md text-gray-600 mt-0.5">
                Lütfen teslim aldığınız siparişlerin irsaliye girişini yapın. 
                Eğer teslim gecikti ise satın almayı bilgilendirin.
              </p>
            </div>
            <Button
              onClick={() => setShowOverdueOnly(true)}
              size="sm"
              className="flex-shrink-0 bg-white hover:bg-[#00E676] text-[#00E676] border border-[#00E676] hover:text-white rounded-2xl px-12 py-2 text-xs font-medium transition-all"
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
            <h1 className="text-3xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-4 text-base">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => !showSiteWarning && router.push('/dashboard/requests/create')}
              disabled={showSiteWarning}
              className="px-8 py-5 rounded-2xl text-md bg-[#00E676] text-white hover:bg-[#00c46a] hover:shadow-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              title={showSiteWarning ? 'Şantiye ataması yapılmadan talep oluşturamazsınız' : ''}
            >
              
              Yeni Talep Oluştur
            </Button>
          </div>
        </div>

        {/* Mobile: Header only */}
        <div className="sm:hidden">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 pb-2 border-b-2 border-[#00E676] inline-block">Satın Alma Talepleri</h1>
            <p className="text-gray-600 mt-4 text-sm">Tüm satın alma taleplerini görüntüleyin ve yönetin</p>
            
            {/* Mobile: Create Request Button */}
            <div className="mt-4">
              <Button 
                onClick={() => !showSiteWarning && router.push('/dashboard/requests/create')}
                disabled={showSiteWarning}
                className="w-1/2 h-12 rounded-2xl text-sm font-medium bg-[#00E676] text-white hover:bg-[#00c46a] hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                title={showSiteWarning ? 'Şantiye ataması yapılmadan talep oluşturamazsınız' : ''}
              >
                <Plus className="w-5 h-5" />
                Yeni Talep
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Stats Cards + Weekly Activity Chart then Table */}
      <div className="hidden sm:block space-y-8">
        {!isSitePersonnel && (
          <div className="px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Aylık İstatistikler - Bar Chart */}
              <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Aylık Talep Dağılımı</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-gray-900">{stats?.thisMonth || 0}</p>
                        <span className={`text-sm font-semibold ${(stats?.monthChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(stats?.monthChange || 0) >= 0 ? '+' : ''}{stats?.monthChange || 0}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Bu ay / Geçen ay karşılaştırması</p>
                    </div>
                  </div>
                  
                  {/* Bar Chart */}
                  <div className="flex items-end justify-between gap-2 h-24">
                    {stats?.monthlyData?.map((month: any, i: number) => {
                      const maxCount = Math.max(...(stats?.monthlyData?.map((m: any) => m.count) || [1]))
                      const height = (month.count / maxCount) * 100
                      const isLast = i === stats.monthlyData.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div className="w-full flex items-end justify-center" style={{ height: '70px' }}>
                            <div 
                              className={`w-full rounded-t-lg animate-bar-grow ${isLast ? 'bg-[#00E676] shadow-lg shadow-[#00E676]/30' : 'bg-gray-900'}`}
                              style={{ 
                                height: `${height}%`,
                                animationDelay: `${i * 80}ms`
                              }}
                            />
                          </div>
                          <p className="text-xs font-medium text-gray-600">{month.month}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Toplam İstatistikler - Trend */}
              <Card className="border-neutral-800 bg-neutral-950 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-white/65 mb-1">Toplam Performans</p>
                      <p className="text-3xl font-bold text-white">{stats?.total || 0}</p>
                      <p className="text-xs text-white/50 mt-1">Toplam talep sayısı</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                      <p className="text-xs text-white/55 mb-1">Bekleyen</p>
                      <p className="text-xl font-bold text-white">{stats?.pending || 0}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                      <p className="text-xs text-white/55 mb-1">Onaylı</p>
                      <p className="text-xl font-bold text-white">{stats?.approved || 0}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                      <p className="text-xs text-white/55 mb-1">Acil</p>
                      <p className="text-xl font-bold text-white">{stats?.urgent || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Weekly Activity Chart - Full Width */}
        <div className="px-4">
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <CardHeader className="pb-4 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {userRole === 'purchasing_officer' ? 'Aylık Sipariş Aktivitesi' : 'Aylık Talep Aktivitesi'}
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    {userRole === 'purchasing_officer' ? 'Son 30 gündeki sipariş oluşturma aktiviteniz' : 'Son 30 gündeki talep oluşturma aktiviteniz'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4">
            <div className="h-64 w-full relative">
              <div className="absolute inset-0">
                <svg className="w-full h-full" viewBox="0 0 1400 250" preserveAspectRatio="xMidYMid meet">
                  {/* Grid lines */}
                  <defs>
                    <pattern id="grid" width="50" height="25" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 25" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                    </pattern>
                    <linearGradient id="redGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#00E676', stopOpacity: 0.8 }} />
                      <stop offset="100%" style={{ stopColor: '#00E676', stopOpacity: 0.1 }} />
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  
                  {/* Activity area chart */}
                  {weeklyActivity && weeklyActivity.length > 0 && (() => {
                    const maxCount = Math.max(...weeklyActivity.map((d: any) => d.count), 1)
                    const spacing = 42
                    const startX = 30
                    
                    const pathData = weeklyActivity.map((d: any, i: number) => {
                      const x = startX + (i * spacing)
                      const y = 200 - (d.count / maxCount) * 150
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                    }).join(' ')
                    
                    return (
                      <>
                        {/* Area */}
                        <path
                          d={`${pathData} L ${startX + (weeklyActivity.length - 1) * spacing} 200 L ${startX} 200 Z`}
                          fill="url(#redGradient)"
                        />
                        {/* Line */}
                        <path
                          d={pathData}
                          fill="none"
                          stroke="#00E676"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Points - her 3 günde bir göster */}
                        {weeklyActivity.map((d: any, i: number) => {
                          if (i % 3 !== 0 && i !== weeklyActivity.length - 1) return null
                          const x = startX + (i * spacing)
                          const y = 200 - (d.count / maxCount) * 150
                          return (
                            <g key={i}>
                              <circle 
                                cx={x} 
                                cy={y} 
                                r="8" 
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredPoint({ x, y, count: d.count, date: d.date })}
                                onMouseLeave={() => setHoveredPoint(null)}
                              />
                              <circle cx={x} cy={y} r="4" fill="#00E676" style={{ pointerEvents: 'none' }} />
                              <circle cx={x} cy={y} r="6" fill="none" stroke="#00E676" strokeWidth="2" opacity="0.3" style={{ pointerEvents: 'none' }} />
                            </g>
                          )
                        })}
                        
                        {/* Tooltip */}
                        {hoveredPoint && (
                          <g>
                            <rect
                              x={hoveredPoint.x - 35}
                              y={hoveredPoint.y - 45}
                              width="70"
                              height="32"
                              rx="6"
                              fill="white"
                              stroke="#00E676"
                              strokeWidth="2"
                              filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                            />
                            <text
                              x={hoveredPoint.x}
                              y={hoveredPoint.y - 28}
                              textAnchor="middle"
                              fontSize="11"
                              fill="#6b7280"
                              fontWeight="500"
                            >
                              {hoveredPoint.date}
                            </text>
                            <text
                              x={hoveredPoint.x}
                              y={hoveredPoint.y - 16}
                              textAnchor="middle"
                              fontSize="13"
                              fill="#00E676"
                              fontWeight="700"
                            >
                              {hoveredPoint.count} talep
                            </text>
                          </g>
                        )}
                        {/* Labels - her 5 günde bir göster */}
                        {weeklyActivity.map((d: any, i: number) => {
                          if (i % 5 !== 0 && i !== weeklyActivity.length - 1) return null
                          const x = startX + (i * spacing)
                          return (
                            <g key={`label-${i}`}>
                              <text x={x} y="220" textAnchor="middle" fontSize="11" fill="#6b7280" fontWeight="500">
                                {d.date.split('/')[0]}
                              </text>
                            </g>
                          )
                        })}
                      </>
                    )
                  })()}
                </svg>
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

      {/* Mobile: Stats Cards + Activity Chart first, then Button, then Table */}
      <div className="sm:hidden space-y-6">
        {!isSitePersonnel && (
          <div className="px-4">
            <div className="space-y-3">
              {/* Aylık İstatistikler - Bar Chart */}
              <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Aylık Dağılım</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-gray-900">{stats?.thisMonth || 0}</p>
                        <span className={`text-xs font-semibold ${(stats?.monthChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(stats?.monthChange || 0) >= 0 ? '+' : ''}{stats?.monthChange || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bar Chart */}
                  <div className="flex items-end justify-between gap-1.5 h-16">
                    {stats?.monthlyData?.map((month: any, i: number) => {
                      const maxCount = Math.max(...(stats?.monthlyData?.map((m: any) => m.count) || [1]))
                      const height = (month.count / maxCount) * 100
                      const isLast = i === stats.monthlyData.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex items-end justify-center" style={{ height: '50px' }}>
                            <div 
                              className={`w-full rounded-t-lg animate-bar-grow ${isLast ? 'bg-[#00E676] shadow-md shadow-[#00E676]/30' : 'bg-gray-900'}`}
                              style={{ 
                                height: `${height}%`,
                                animationDelay: `${i * 80}ms`
                              }}
                            />
                          </div>
                          <p className="text-[9px] font-medium text-gray-600">{month.month}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Toplam İstatistikler */}
              <Card className="border-neutral-800 bg-neutral-950 text-white rounded-2xl shadow-lg">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium text-white/65 mb-1">Toplam Performans</p>
                      <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
                      <p className="text-[10px] text-white/50 mt-0.5">Toplam talep sayısı</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10">
                    <div className="bg-white/5 rounded-lg p-1.5 border border-white/10">
                      <p className="text-[10px] text-white/55 mb-0.5">Bekleyen</p>
                      <p className="text-base font-bold text-white">{stats?.pending || 0}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-1.5 border border-white/10">
                      <p className="text-[10px] text-white/55 mb-0.5">Onaylı</p>
                      <p className="text-base font-bold text-white">{stats?.approved || 0}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-1.5 border border-white/10">
                      <p className="text-[10px] text-white/55 mb-0.5">Acil</p>
                      <p className="text-base font-bold text-white">{stats?.urgent || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Weekly Activity Chart - Mobile */}
        <div className="px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 pb-2">
              <h3 className="text-base font-semibold text-gray-900">
                {userRole === 'purchasing_officer' ? '10 Günlük Sipariş Aktivitesi' : '10 Günlük Talep Aktivitesi'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {userRole === 'purchasing_officer' ? 'Son 10 gündeki sipariş oluşturma' : 'Son 10 gündeki talep oluşturma'}
              </p>
            </div>
            <div className="pb-4 px-2">
              <div className="h-52 w-full relative">
                <div className="absolute inset-0">
                  <svg className="w-full h-full" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid meet">
                    {/* Grid lines */}
                    <defs>
                      <pattern id="grid-mobile" width="40" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f9fafb" strokeWidth="1"/>
                      </pattern>
                      <linearGradient id="redGradient-mobile" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#00E676', stopOpacity: 0.4 }} />
                        <stop offset="50%" style={{ stopColor: '#00E676', stopOpacity: 0.2 }} />
                        <stop offset="100%" style={{ stopColor: '#00E676', stopOpacity: 0.05 }} />
                      </linearGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-mobile)" />
                    
                    {/* Activity area chart */}
                    {mobileActivity && mobileActivity.length > 0 && (() => {
                      const maxCount = Math.max(...mobileActivity.map((d: any) => d.count), 1)
                      const spacing = 33
                      const startX = 20
                      
                      const pathData = mobileActivity.map((d: any, i: number) => {
                        const x = startX + (i * spacing)
                        const y = 160 - (d.count / maxCount) * 110
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                      }).join(' ')
                      
                      return (
                        <>
                          {/* Area with gradient */}
                          <path
                            d={`${pathData} L ${startX + (mobileActivity.length - 1) * spacing} 160 L ${startX} 160 Z`}
                            fill="url(#redGradient-mobile)"
                            className="animate-fade-in"
                          />
                          {/* Line with glow */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke="#00E676"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter="url(#glow)"
                            className="animate-fade-in"
                          />
                          {/* Points with animation */}
                          {mobileActivity.map((d: any, i: number) => {
                            const x = startX + (i * spacing)
                            const y = 160 - (d.count / maxCount) * 110
                            return (
                              <g key={i} className="animate-scale-in" style={{ animationDelay: `${i * 50}ms` }}>
                                <circle 
                                  cx={x} 
                                  cy={y} 
                                  r="8" 
                                  fill="transparent"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={() => setHoveredPointMobile({ x, y, count: d.count, date: d.date })}
                                  onMouseLeave={() => setHoveredPointMobile(null)}
                                  onTouchStart={() => setHoveredPointMobile({ x, y, count: d.count, date: d.date })}
                                  onTouchEnd={() => setHoveredPointMobile(null)}
                                />
                                <circle cx={x} cy={y} r="4" fill="white" stroke="#00E676" strokeWidth="2" style={{ pointerEvents: 'none' }} />
                                <circle cx={x} cy={y} r="2" fill="#00E676" style={{ pointerEvents: 'none' }} />
                              </g>
                            )
                          })}
                          
                          {/* Tooltip */}
                          {hoveredPointMobile && (
                            <g>
                              <rect
                                x={hoveredPointMobile.x - 30}
                                y={hoveredPointMobile.y - 40}
                                width="60"
                                height="28"
                                rx="6"
                                fill="white"
                                stroke="#00E676"
                                strokeWidth="2"
                                filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                              />
                              <text
                                x={hoveredPointMobile.x}
                                y={hoveredPointMobile.y - 26}
                                textAnchor="middle"
                                fontSize="9"
                                fill="#6b7280"
                                fontWeight="500"
                              >
                                {hoveredPointMobile.date}
                              </text>
                              <text
                                x={hoveredPointMobile.x}
                                y={hoveredPointMobile.y - 16}
                                textAnchor="middle"
                                fontSize="11"
                                fill="#00E676"
                                fontWeight="700"
                              >
                                {hoveredPointMobile.count} talep
                              </text>
                            </g>
                          )}
                          {/* Labels - her gün göster */}
                          {mobileActivity.map((d: any, i: number) => {
                            const x = startX + (i * spacing)
                            return (
                              <g key={`label-${i}`}>
                                <text 
                                  x={x} 
                                  y="180" 
                                  textAnchor="middle" 
                                  fontSize="10" 
                                  fill="#9ca3af" 
                                  fontWeight="500"
                                  className="animate-fade-in"
                                  style={{ animationDelay: `${i * 50}ms` }}
                                >
                                  {d.date.split('/')[0]}
                                </text>
                              </g>
                            )
                          })}
                        </>
                      )
                    })()}
                  </svg>
                </div>
              </div>
            </div>
          </div>
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
    </div>
  )
}
