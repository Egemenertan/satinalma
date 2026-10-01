'use client'

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useOfferData } from '@/components/offers/hooks/useOfferData'
import { RequestContractBindingsList } from '@/components/contracts/ContractSummaryCard'
import { ContractWaybillModal } from '@/components/contracts/ContractWaybillModal'
import { fetchRequestContractBindings } from '@/services/contracts.service'
import type { RequestContractBinding } from '@/lib/contracts'
import { createClient } from '@/lib/supabase/client'
import { getUrgencyColor, getStatusColor } from '@/components/offers/types'
import { SkeletonCard } from '@/components/ui/skeleton'
import SantiyeDepoView from '@/components/offers/SantiyeDepoView'
import SitePersonnelView from '@/components/offers/SitePersonnelView'
import SiteManagerView from '@/components/offers/SiteManagerView'
import ProcurementView from '@/components/offers/ProcurementView'
import DepartmentHeadView from '@/components/offers/DepartmentHeadView'
import ItWorkflowView from '@/components/offers/ItWorkflowView'
import RequestActivityTimeline from '@/components/offers/RequestActivityTimeline'
import { IT_WORKFLOW_STATUSES } from '@/lib/it-workflow'

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-0.5 text-sm text-gray-900 break-words">{children}</div>
    </div>
  )
}

export default function OffersPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const requestId = params.id as string

  // Local state for procurement view
  const [localOrderTracking, setLocalOrderTracking] = useState<{[key: string]: any}>({})
  const [contractBindings, setContractBindings] = useState<RequestContractBinding[]>([])
  const [waybillBinding, setWaybillBinding] = useState<RequestContractBinding | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const [asideOffset, setAsideOffset] = useState(0)

  // Fetch all data using custom hook
  const {
    request,
    existingOffers,
    userRole,
    userDepartment,
    materialSuppliers,
    materialOrders,
    shipmentData,
    currentOrder,
    loading,
    error,
    refreshData
  } = useOfferData(requestId)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null))
  }, [])

  const contractItemIds = useMemo(
    () => (request?.purchase_request_items || [])
      .map((item: { id: string; contract_item_id?: string | null }) => item.id)
      .filter(Boolean),
    [request?.purchase_request_items]
  )

  useEffect(() => {
    if (contractItemIds.length === 0) {
      setContractBindings([])
      return
    }
    fetchRequestContractBindings(contractItemIds)
      .then(setContractBindings)
      .catch((error) => console.error('Sözleşme bilgisi yüklenemedi:', error))
  }, [contractItemIds, request?.updated_at])

  useLayoutEffect(() => {
    const columns = columnsRef.current
    if (!columns) return

    const measure = () => {
      if (window.innerWidth < 1024) {
        setAsideOffset((current) => (current === 0 ? current : 0))
        return
      }
      const list = columns.querySelector<HTMLElement>('[data-material-list]')
      if (!list) {
        setAsideOffset((current) => (current === 0 ? current : 0))
        return
      }
      const next = Math.max(
        0,
        Math.round(list.getBoundingClientRect().top - columns.getBoundingClientRect().top)
      )
      setAsideOffset((current) => (current === next ? current : next))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(columns)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [request?.updated_at, contractBindings.length, userRole, loading])

  // Retry function for error recovery
  const handleRetry = () => {
    refreshData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-2xl px-4">
          <div className="hidden sm:flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-16 h-8 bg-gray-200 animate-pulse rounded-lg"></div>
              <div className="w-px h-5 bg-gray-200"></div>
              <div>
                <div className="w-32 h-4 bg-gray-200 animate-pulse rounded mb-1"></div>
                <div className="w-24 h-3 bg-gray-200 animate-pulse rounded"></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-6 bg-gray-200 animate-pulse rounded"></div>
              <div className="w-24 h-6 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4">
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-[#00E676]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-[#00E676]" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Bir Hata Oluştu</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={handleRetry}
              className="bg-[#00E676] hover:bg-[#00c46a] rounded-xl px-6 py-3 font-medium"
            >
              Tekrar Dene
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/dashboard/requests')}
              className="rounded-xl px-6 py-3 font-medium"
            >
              Taleplere Dön
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Purchasing officer için "depoda mevcut değil" statusundaki taleplere erişim kontrolü
  if (!loading && request && userRole === 'purchasing_officer' && request.status === 'depoda mevcut değil') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-amber-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Onay Bekleniyor</h3>
          <p className="text-gray-600 mb-6">
            Bu talep henüz onaylanmamıştır. Öncelikle şantiye depo yöneticisi tarafından onaylanması gerekmektedir.
          </p>
          <Button 
            onClick={() => router.push('/dashboard/requests')}
            className="bg-[#00E676] hover:bg-[#00c46a] rounded-xl px-6 py-3 font-medium"
          >
            Taleplere Dön
          </Button>
        </div>
      </div>
    )
  }

  if (!request && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-[#00E676]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-[#00E676]" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Talep Bulunamadı</h3>
          <p className="text-gray-600 mb-6">Aradığınız talep mevcut değil veya erişim izniniz yok.</p>
          <Button 
            onClick={() => router.push('/dashboard/requests')}
            className="bg-[#00E676] hover:bg-[#00c46a] rounded-xl px-6 py-3 font-medium"
          >
            Taleplere Dön
          </Button>
        </div>
      </div>
    )
  }

  // Kullanıcı rolüne göre hangi bileşeni render edeceğimizi belirle
  const renderUserView = () => {
    const commonProps = {
      request,
      materialSuppliers,
      materialOrders,
      shipmentData,
      onRefresh: refreshData,
      showToast
    }

    const itStatuses = IT_WORKFLOW_STATUSES as readonly string[]
    if (
      request.it_workflow_applies &&
      request.status &&
      itStatuses.includes(request.status)
    ) {
      return (
        <ItWorkflowView
          {...commonProps}
          currentOrder={currentOrder}
          userRole={userRole}
          userDepartment={userDepartment ?? null}
        />
      )
    }

    // GMO için department_head kontrolü (EN ÜSTTE - diğer rollerin ÖNCESİNDE)
    const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    
    if (userRole === 'department_head') {
      // GMO + departman_onayı_bekliyor statusu için DepartmentHeadView
      if (request.site_id === GMO_SITE_ID && request.status === 'departman_onayı_bekliyor') {
        return (
          <DepartmentHeadView 
            request={request}
            onRefresh={refreshData}
            showToast={showToast}
          />
        )
      }
      
      // Sipariş verildi ve teslimat durumlarında SantiyeDepoView kullan (teslimat modalı için)
      const deliveryStatuses = ['sipariş verildi', 'kısmen teslim alındı', 'teslim alındı', 'gönderildi', 'iade var']
      if (deliveryStatuses.includes(request.status)) {
        return (
          <SantiyeDepoView 
            {...commonProps}
            currentOrder={currentOrder}
          />
        )
      }
      
      // Diğer durumlarda sadece görüntüleme (SitePersonnelView readonly)
      return (
        <SitePersonnelView 
          {...commonProps}
          currentOrder={currentOrder}
          readOnly={true}
        />
      )
    }

    switch (userRole) {
      case 'santiye_depo':
        return (
          <SantiyeDepoView 
            {...commonProps}
            currentOrder={currentOrder}
          />
        )
      
      case 'santiye_depo_yonetici':
        // Santiye depo yöneticisi: SantiyeDepoView kullanır (onay butonları dahil)
        return (
          <SantiyeDepoView 
            {...commonProps}
            currentOrder={currentOrder}
          />
        )
        
      case 'warehouse_manager':
        // Warehouse manager: SantiyeDepoView kullanır (santiye_depo ile aynı yetkiler)
        return (
          <SantiyeDepoView 
            {...commonProps}
            currentOrder={currentOrder}
          />
        )
        
      case 'site_personnel':
        return (
          <SitePersonnelView 
            {...commonProps}
            currentOrder={currentOrder}
          />
        )
        
      case 'site_manager':
        return (
          <SiteManagerView 
            {...commonProps}
            currentOrder={currentOrder}
          />
        )
        
      default:
        // Procurement, admin, user vs.
        return (
          <ProcurementView
            {...commonProps}
            existingOffers={existingOffers}
            userRole={userRole}
            currentOrder={currentOrder}
            localOrderTracking={localOrderTracking}
            setLocalOrderTracking={setLocalOrderTracking}
          />
        )
    }
  }

  const locationName =
    request.site_name ||
    request.sites?.name ||
    request.construction_sites?.name ||
    request.department

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Başlık — alttaki iki sütunla aynı genişlik */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-3 sm:px-4">
          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between h-14">
            {/* Sol taraf - Geri butonu ve başlık */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/requests')}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 h-9"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Geri</span>
              </Button>
              <div className="w-px h-6 bg-gray-200"></div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Teklif Girişi</h1>
                <p className="text-sm text-gray-500">{request.request_number}</p>
              </div>
            </div>

            {/* Sağ taraf - Status badge'leri */}
            <div className="flex items-center gap-3">
              <Badge className={`border ${getUrgencyColor(request.urgency_level)} text-xs px-2 py-1`}>
                {request.urgency_level === 'critical' ? 'Kritik' : 
                 request.urgency_level === 'high' ? 'Yüksek' :
                 request.urgency_level === 'normal' ? 'Normal' : 'Düşük'}
              </Badge>
              <Badge className={`border ${getStatusColor(request.status)} text-xs px-2 py-1`}>
                {request.status === 'pending' ? 'Beklemede' :
                 request.status === 'it_incelemesinde' ? 'IT Yönetim — İncelemede' :
                 request.status === 'it_onaylandi' ? 'IT Yönetim — Onaylandı' :
                 request.status === 'şantiye şefi onayladı' ? 'Şantiye Şefi Onayladı' :
                 request.status === 'awaiting_offers' ? 'Onay Bekliyor' :
                 request.status === 'sipariş verildi' ? 'Sipariş Verildi' :
                 request.status === 'gönderildi' ? 'Gönderildi' :
                 request.status === 'kısmen gönderildi' ? 'Kısmen Gönderildi' :
                 request.status === 'depoda mevcut değil' ? 'Depoda Mevcut Değil' :
                 request.status === 'ana depoda yok' ? 'Ana Depoda Yok' :
                 request.status === 'eksik onaylandı' ? 'Eksik Onaylandı' :
                 request.status === 'alternatif onaylandı' ? 'Alternatif Onaylandı' :
                 request.status === 'satın almaya gönderildi' ? 'Satın Almaya Gönderildi' :
                 request.status === 'eksik malzemeler talep edildi' ? 'Eksik Malzemeler Talep Edildi' : request.status}
              </Badge>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden">
            <div className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/dashboard/requests')}
                  className="flex items-center gap-1 hover:bg-gray-100 rounded-lg px-2 h-7"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span className="text-xs font-medium">Geri</span>
                </Button>
                <p className="text-xs text-gray-500">{request.request_number}</p>
              </div>
              {/* Mobile Status Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`border ${getUrgencyColor(request.urgency_level)} text-[10px] px-1.5 py-0.5`}>
                  {request.urgency_level === 'critical' ? 'Kritik' : 
                   request.urgency_level === 'high' ? 'Yüksek' :
                   request.urgency_level === 'normal' ? 'Normal' : 'Düşük'}
                </Badge>
                <Badge className={`border ${getStatusColor(request.status)} text-[10px] px-1.5 py-0.5 truncate max-w-[150px]`}>
                  {request.status === 'pending' ? 'Beklemede' :
                   request.status === 'it_incelemesinde' ? 'IT Yönetim — İncelemede' :
                   request.status === 'it_onaylandi' ? 'IT Yönetim — Onaylandı' :
                   request.status === 'şantiye şefi onayladı' ? 'Şantiye Şefi Onayladı' :
                   request.status === 'awaiting_offers' ? 'Onay Bekliyor' :
                   request.status === 'sipariş verildi' ? 'Sipariş Verildi' :
                   request.status === 'gönderildi' ? 'Gönderildi' :
                   request.status === 'kısmen gönderildi' ? 'Kısmen Gönderildi' :
                   request.status === 'depoda mevcut değil' ? 'Depoda Mevcut Değil' :
                   request.status === 'ana depoda yok' ? 'Ana Depoda Yok' :
                   request.status === 'eksik onaylandı' ? 'Eksik Onaylandı' :
                   request.status === 'alternatif onaylandı' ? 'Alternatif Onaylandı' :
                   request.status === 'satın almaya gönderildi' ? 'Satın Almaya Gönderildi' :
                   request.status === 'eksik malzemeler talep edildi' ? 'Eksik Malzemeler Talep Edildi' : request.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {request.status === 'reddedildi' && request.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-red-900">Talep Reddedildi</h3>
                <p className="mt-1 text-sm text-red-800 leading-relaxed break-words">
                  {request.rejection_reason}
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          ref={columnsRef}
          className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]"
        >
          <div className="min-w-0 space-y-3">
            {contractBindings.length > 0 && (
              <RequestContractBindingsList
                bindings={contractBindings}
                showOrderHint={['purchasing_officer', 'admin', 'manager'].includes(userRole)}
                canUploadWaybill={
                  currentUserId === request.requested_by ||
                  ['site_personnel', 'site_manager', 'santiye_depo', 'santiye_depo_yonetici', 'warehouse_manager', 'department_head'].includes(userRole)
                }
                onUploadWaybill={setWaybillBinding}
              />
            )}

            {renderUserView()}
          </div>

          <aside
            className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
            style={asideOffset > 0 ? { marginTop: asideOffset } : undefined}
          >
            <section className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Talep Detayları</h3>
              </div>
              <div className="divide-y divide-gray-100">
                <DetailRow label="Başlık">
                  <span className="font-medium">{request.title}</span>
                </DetailRow>
                <DetailRow label="Lokasyon">{locationName}</DetailRow>
                <DetailRow label="Departman">{request.department}</DetailRow>
                <DetailRow label="Talep Eden">
                  {request.profiles?.full_name || 'Kullanıcı bilgisi bulunamadı'}
                </DetailRow>
                <DetailRow label="Talep Tarihi">
                  {new Date(request.created_at).toLocaleDateString('tr-TR')}
                </DetailRow>
                {request.delivery_date && (
                  <DetailRow label="Gerekli Tarih">
                    {new Date(request.delivery_date).toLocaleDateString('tr-TR')}
                  </DetailRow>
                )}
                {request.category_name && (
                  <DetailRow label="Malzeme Kategorisi">
                    <span>{request.category_name}</span>
                    {request.subcategory_name && (
                      <p className="mt-0.5 text-xs text-gray-600">→ {request.subcategory_name}</p>
                    )}
                  </DetailRow>
                )}
                {(request.material_class || request.material_group) && (
                  <DetailRow label="Malzeme Sınıflandırması">
                    <div className="flex flex-wrap items-center gap-2">
                      {request.material_class && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">Sınıf</span>
                          {request.material_class}
                        </span>
                      )}
                      {request.material_group && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Grup</span>
                          {request.material_group}
                        </span>
                      )}
                    </div>
                  </DetailRow>
                )}
                {request.description && (
                  <DetailRow label="Açıklama">
                    <p className="text-sm leading-relaxed text-gray-700">{request.description}</p>
                  </DetailRow>
                )}
              </div>
            </section>

            <RequestActivityTimeline requestId={requestId} refreshKey={request.updated_at} />
          </aside>
        </div>

        <ContractWaybillModal
          open={!!waybillBinding}
          onOpenChange={(open) => !open && setWaybillBinding(null)}
          binding={waybillBinding}
          showToast={showToast}
          onSuccess={() => {
            refreshData()
            fetchRequestContractBindings(contractItemIds).then(setContractBindings)
          }}
        />
      </div>
    </div>
  )
}
