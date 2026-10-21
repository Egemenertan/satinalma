'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import PurchaseRequestsTable from '@/components/PurchaseRequestsTable'
import { SlidingSegmentTabs } from '@/components/SlidingSegmentTabs'

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
import { fetchLateDeliveryRequestIds } from '@/lib/order-delivery'
import { useCurrentProfile } from '@/lib/auth/current-profile'

const loadSessionUser = async (supabase: ReturnType<typeof createClient>) => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

const fetchRequestAlerts = async () => {
  const supabase = createClient()
  const user = await loadSessionUser(supabase)
  if (!user) {
    return {
      itWorkflowAttentionCount: 0,
      pendingOrdersCount: 0,
      lateDeliveryCount: 0,
      overdueDeliveriesCount: 0,
      overdueRequestIds: [] as string[],
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id, department')
    .eq('id', user.id)
    .single()

  const canSeeItTab = canSeeItWorkflowTab({
    role: profile?.role,
    department: profile?.department
  })

  let itWorkflowAttentionCount = 0
  let pendingOrdersCount = 0
  let lateDeliveryCount = 0
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
        if (!idError && idRows?.length) {
          const { data: unorderedData } = await supabase.rpc('get_unordered_materials_count', {
            request_ids: idRows.map((row: { id: string }) => row.id)
          })
          pendingOrdersCount = unorderedData?.filter((item: { unordered_count: number }) => item.unordered_count > 0).length || 0
        }
        const lateIds = await fetchLateDeliveryRequestIds(supabase, user.id, profile.site_id)
        lateDeliveryCount = lateIds.length
      } catch (err) {
        console.warn('Pending orders count failed:', err)
      }
    })())
  }

  if (profile?.role === 'site_manager' || profile?.role === 'santiye_depo' || profile?.role === 'santiye_depo_siparis' || profile?.role === 'santiye_depo_yonetici') {
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
    itWorkflowAttentionCount,
    pendingOrdersCount,
    lateDeliveryCount,
    overdueDeliveriesCount,
    overdueRequestIds,
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
  const [showLateDeliveryOnly, setShowLateDeliveryOnly] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('late_delivery_filter_active') === 'true'
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
  
  const { data: profile } = useCurrentProfile()
  const [alertsReady, setAlertsReady] = useState(false)
  useEffect(() => {
    if (!profile?.role) return
    const id = window.setTimeout(() => setAlertsReady(true), 600)
    return () => window.clearTimeout(id)
  }, [profile?.role])

  const { data: alerts } = useSWR(
    alertsReady && profile?.role ? ['requests_page_alerts', profile.role] : null,
    fetchRequestAlerts,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      errorRetryCount: 1,
    }
  )

  const userInfo = { displayName: profile?.fullName || 'Kullanıcı', email: profile?.email || '' }
  const userRole = profile?.role || ''
  const pendingOrdersCount = alerts?.pendingOrdersCount || 0
  const lateDeliveryCount = alerts?.lateDeliveryCount || 0
  const overdueDeliveriesCount = alerts?.overdueDeliveriesCount || 0
  const overdueRequestIds = alerts?.overdueRequestIds || []
  const userSiteId = profile?.siteId
  const canSeeItWorkflowTabUser = canSeeItWorkflowTab({
    role: profile?.role,
    department: profile?.department,
  })
  const itWorkflowAttentionCount = alerts?.itWorkflowAttentionCount ?? 0
  const showItTabNotification =
    canSeeItWorkflowTabUser && itWorkflowAttentionCount > 0 && requestsListTab === 'main'

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
          invalidatePurchaseRequestsCache()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // showUnorderedOnly değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('unordered_filter_active', showUnorderedOnly.toString())
    }
  }, [showUnorderedOnly])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('late_delivery_filter_active', showLateDeliveryOnly.toString())
    }
  }, [showLateDeliveryOnly])
  
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
  const requiresSiteId = ['site_personnel', 'site_manager', 'santiye_depo', 'santiye_depo_siparis', 'santiye_depo_yonetici'].includes(userRole)
  const showSiteWarning = requiresSiteId && !hasSiteAssignment

  return (
    <div className="pb-6 space-y-6">
      {/* Welcome Message */}
      <div className="pt-2 space-y-2">
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
        
        {userRole === 'purchasing_officer' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                const next = !showUnorderedOnly
                setShowUnorderedOnly(next)
                if (next) setShowLateDeliveryOnly(false)
              }}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        showUnorderedOnly
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">Siparişi verilmemiş talepler</span>
                <span className="text-sm tabular-nums text-gray-500">{pendingOrdersCount}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !showLateDeliveryOnly
                setShowLateDeliveryOnly(next)
                if (next) setShowUnorderedOnly(false)
              }}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        showLateDeliveryOnly
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">Teslimat tarihi geçen talepler</span>
                <span className={`text-sm tabular-nums ${lateDeliveryCount > 0 ? 'font-medium text-red-600' : 'text-gray-500'}`}>
                  {lateDeliveryCount}
                </span>
              </div>
            </button>
          </div>
        )}
        
        {/* Teslim Alınmamış Siparişler Uyarısı - Site Manager, Santiye Depo ve Santiye Depo Yöneticisi için */}
        {(userRole === 'site_manager' || userRole === 'santiye_depo' || userRole === 'santiye_depo_siparis' || userRole === 'santiye_depo_yonetici') && overdueDeliveriesCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-black/[0.04] border border-black/10 rounded-2xl">
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
      <div className="space-y-4">
        {/* Desktop: Header with button on right */}
        <div className="hidden sm:flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">Talep İşlemleri</h1>
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
            <h1 className="text-3xl font-semibold text-gray-900 pb-2 border-b-2 border-[#00E676] inline-block">Talep İşlemleri</h1>
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

      <div className="space-y-5">
        {canSeeItWorkflowTabUser && (
          <SlidingSegmentTabs
            ariaLabel="Talep görünümü"
            value={requestsListTab}
            onChange={(tab) => setRequestsListTab(tab === 'it' ? 'it' : 'main')}
            items={[
              { value: 'main', label: 'Talepler' },
              {
                value: 'it',
                label: 'IT Yönetim',
                badge: showItTabNotification,
                ariaLabel: showItTabNotification
                  ? `IT Yönetim — ${itWorkflowAttentionCount} işlem bekleyen talep`
                  : 'IT Yönetim',
              },
            ]}
          />
        )}
        <PurchaseRequestsTable 
          userRole={userRole} 
          listView={canSeeItWorkflowTabUser && requestsListTab === 'it' ? 'it' : 'main'}
          showUnorderedOnly={requestsListTab === 'main' ? showUnorderedOnly : false}
          onUnorderedFilterChange={setShowUnorderedOnly}
          showLateDeliveryOnly={requestsListTab === 'main' ? showLateDeliveryOnly : false}
          onLateDeliveryFilterChange={setShowLateDeliveryOnly}
          showOverdueOnly={requestsListTab === 'main' ? showOverdueOnly : false}
          onOverdueFilterChange={setShowOverdueOnly}
          overdueRequestIds={overdueRequestIds}
        />
      </div>
    </div>
  )
}
