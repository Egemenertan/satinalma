'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import PurchaseRequestsTable from '@/components/PurchaseRequestsTable'

import { Plus, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import {
  canSeeItWorkflowTab,
  isPazarlamaDepartment,
  IT_STATUS_INCELEMEDE,
  IT_STATUS_ONAYLANDI
} from '@/lib/it-workflow'
import { excludeSoftDeletedRequests } from '@/lib/softDeletePurchaseRequest'

const fetchPageData = async () => {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, site_id, department')
    .eq('id', user.id)
    .single()

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

  const canSeeItTab = canSeeItWorkflowTab({
    role: profile?.role,
    department: profile?.department
  })

  let itWorkflowAttentionCount = 0
  let pendingOrdersCount = 0
  let overdueDeliveriesCount = 0
  let overdueRequestIds: string[] = []

  const tasks: Promise<void>[] = []

  if (canSeeItTab) {
    tasks.push((async () => {
      try {
        let itAttnQuery = excludeSoftDeletedRequests(
          supabase
            .from('purchase_requests')
            .select('id', { count: 'exact', head: true })
        ).eq('it_workflow_applies', true)

        if (profile?.role === 'site_manager' && isPazarlamaDepartment(profile?.department)) {
          itAttnQuery = itAttnQuery.eq('status', IT_STATUS_ONAYLANDI)
        } else {
          itAttnQuery = itAttnQuery.in('status', [IT_STATUS_INCELEMEDE, IT_STATUS_ONAYLANDI])
        }

        const { count: itAttnCount, error: itAttnError } = await itAttnQuery
        if (itAttnError) {
          console.warn('IT bildirim sayımı hatası:', itAttnError)
        } else {
          itWorkflowAttentionCount = itAttnCount ?? 0
        }
      } catch (e) {
        console.warn('IT bildirim sayımı:', e)
      }
    })())
  }

  if (profile?.role === 'purchasing_officer') {
    tasks.push((async () => {
      try {
        const baseStatuses = ['satın almaya gönderildi', 'sipariş verildi', 'teklif bekliyor', 'onaylandı', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered']
        const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
        let idQuery = excludeSoftDeletedRequests(
          supabase.from('purchase_requests').select('id')
        )
        if (userSiteIds.length > 0) {
          idQuery = idQuery.or(
            `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${baseStatuses.join(',')})),` +
            `requested_by.eq.${user.id}`
          )
        } else {
          idQuery = idQuery.eq('requested_by', user.id)
        }
        const { data: idRows, error: idError } = await idQuery
        if (idError || !idRows?.length) return
        const { data: unorderedData } = await supabase.rpc('get_unordered_materials_count', {
          request_ids: idRows.map((row: { id: string }) => row.id)
        })
        pendingOrdersCount = unorderedData?.filter((item: { unordered_count: number }) => item.unordered_count > 0).length || 0
      } catch (err) {
        console.warn('Pending orders count failed:', err)
      }
    })())
  }

  if (profile?.role === 'site_manager' || profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_yonetici') {
    tasks.push((async () => {
      try {
        const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
        if (userSiteIds.length === 0) return
        const { data: overdueData } = await supabase.rpc('get_overdue_deliveries_count', {
          user_site_ids: userSiteIds
        })
        overdueDeliveriesCount = overdueData?.length || 0
        overdueRequestIds = overdueData?.map((item: { request_id: string }) => item.request_id) || []
      } catch (err) {
        console.warn('Overdue deliveries count failed:', err)
      }
    })())
  }

  await Promise.all(tasks)

  return {
    userInfo: { displayName, email: profile?.email },
    role: profile?.role || '',
    canSeeItWorkflowTab: canSeeItTab,
    itWorkflowAttentionCount,
    stats: {
      total: 0,
      pending: 0,
      approved: 0,
      urgent: 0,
      thisMonth: 0,
      monthlyData: [],
      monthChange: 0
    },
    pendingOrdersCount,
    overdueDeliveriesCount,
    overdueRequestIds,
    siteId: profile?.site_id,
    weeklyActivity: [],
    mobileActivity: []
  }
}

export default function RequestsPage() {
  const router = useRouter()
  const [requestsListTab, setRequestsListTab] = useState<'main' | 'it'>('main')
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
        canSeeItWorkflowTab: false,
        itWorkflowAttentionCount: 0,
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
  const pendingOrdersCount = pageData?.pendingOrdersCount || 0
  const overdueDeliveriesCount = pageData?.overdueDeliveriesCount || 0
  const overdueRequestIds = pageData?.overdueRequestIds || []
  const userSiteId = pageData?.siteId
  const canSeeItWorkflowTabUser = pageData?.canSeeItWorkflowTab === true
  const itWorkflowAttentionCount = pageData?.itWorkflowAttentionCount ?? 0
  const showItTabNotification =
    canSeeItWorkflowTabUser && itWorkflowAttentionCount > 0 && requestsListTab === 'main'

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

      {/* Desktop: son talepler */}
      <div className="hidden sm:block space-y-8">
        {/* Requests Table */}
        {canSeeItWorkflowTabUser && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              type="button"
              variant={requestsListTab === 'main' ? 'default' : 'outline'}
              className={requestsListTab === 'main' ? 'bg-[#00E676] hover:bg-[#00c46a] text-white' : ''}
              onClick={() => setRequestsListTab('main')}
            >
              Talepler
            </Button>
            <Button
              type="button"
              variant={requestsListTab === 'it' ? 'default' : 'outline'}
              className={`relative overflow-visible ${requestsListTab === 'it' ? 'bg-sky-600 hover:bg-sky-700 text-white' : ''}`}
              onClick={() => setRequestsListTab('it')}
              aria-label={
                showItTabNotification
                  ? `IT Yönetim — ${itWorkflowAttentionCount} işlem bekleyen talep`
                  : 'IT Yönetim'
              }
            >
              IT Yönetim
              {showItTabNotification ? (
                <span
                  className="pointer-events-none absolute -right-1 -top-1 z-10 h-2.5 min-w-2.5 rounded-full bg-red-500 ring-2 ring-gray-50"
                  aria-hidden
                />
              ) : null}
            </Button>
          </div>
        )}
        <PurchaseRequestsTable 
          userRole={userRole} 
          listView={canSeeItWorkflowTabUser && requestsListTab === 'it' ? 'it' : 'main'}
          showUnorderedOnly={requestsListTab === 'main' ? showUnorderedOnly : false}
          onUnorderedFilterChange={setShowUnorderedOnly}
          showOverdueOnly={requestsListTab === 'main' ? showOverdueOnly : false}
          onOverdueFilterChange={setShowOverdueOnly}
          overdueRequestIds={overdueRequestIds}
        />
      </div>

      {/* Mobile: talep listesi */}
      <div className="sm:hidden space-y-6">
        {/* Requests Table */}
        {canSeeItWorkflowTabUser && (
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              variant={requestsListTab === 'main' ? 'default' : 'outline'}
              className={requestsListTab === 'main' ? 'bg-[#00E676] hover:bg-[#00c46a] text-white' : ''}
              onClick={() => setRequestsListTab('main')}
            >
              Talepler
            </Button>
            <Button
              type="button"
              variant={requestsListTab === 'it' ? 'default' : 'outline'}
              className={`relative overflow-visible ${requestsListTab === 'it' ? 'bg-sky-600 hover:bg-sky-700 text-white' : ''}`}
              onClick={() => setRequestsListTab('it')}
              aria-label={
                showItTabNotification
                  ? `IT Yönetim — ${itWorkflowAttentionCount} işlem bekleyen talep`
                  : 'IT Yönetim'
              }
            >
              IT Yönetim
              {showItTabNotification ? (
                <span
                  className="pointer-events-none absolute -right-1 -top-1 z-10 h-2.5 min-w-2.5 rounded-full bg-red-500 ring-2 ring-white"
                  aria-hidden
                />
              ) : null}
            </Button>
          </div>
        )}
        <PurchaseRequestsTable 
          userRole={userRole} 
          listView={canSeeItWorkflowTabUser && requestsListTab === 'it' ? 'it' : 'main'}
          showUnorderedOnly={requestsListTab === 'main' ? showUnorderedOnly : false}
          onUnorderedFilterChange={setShowUnorderedOnly}
          showOverdueOnly={requestsListTab === 'main' ? showOverdueOnly : false}
          onOverdueFilterChange={setShowOverdueOnly}
          overdueRequestIds={overdueRequestIds}
        />
      </div>
    </div>
  )
}
