'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useOfferData } from '@/components/offers/hooks/useOfferData'
import { getUrgencyColor, getStatusColor } from '@/components/offers/types'
import { SkeletonCard } from '@/components/ui/skeleton'
import SantiyeDepoView from '@/components/offers/SantiyeDepoView'
import SitePersonnelView from '@/components/offers/SitePersonnelView'
import SiteManagerView from '@/components/offers/SiteManagerView'
import ProcurementView from '@/components/offers/ProcurementView'

export default function OffersPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const requestId = params.id as string

  // Local state for procurement view
  const [localOrderTracking, setLocalOrderTracking] = useState<{[key: string]: any}>({})

  // Fetch all data using custom hook
  const {
    request,
    existingOffers,
    userRole,
    materialSuppliers,
    materialOrders,
    shipmentData,
    currentOrder,
    loading,
    error,
    refreshData
  } = useOfferData(requestId)

  // Retry function for error recovery
  const handleRetry = () => {
    refreshData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="hidden sm:flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <div className="w-16 h-9 bg-gray-200 animate-pulse rounded-lg"></div>
                <div className="w-px h-6 bg-gray-200"></div>
                <div>
                  <div className="w-32 h-5 bg-gray-200 animate-pulse rounded mb-1"></div>
                  <div className="w-24 h-4 bg-gray-200 animate-pulse rounded"></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-6 bg-gray-200 animate-pulse rounded"></div>
                <div className="w-24 h-6 bg-gray-200 animate-pulse rounded"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="space-y-4 sm:space-y-8">
            {/* Site Name Skeleton */}
            <div className="mb-4 sm:mb-8">
              <div className="w-64 h-8 bg-gray-200 animate-pulse rounded"></div>
            </div>

            {/* Request Details Skeleton */}
            <SkeletonCard />

            {/* Content Skeleton */}
            <div className="space-y-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
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
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Bir Hata Oluştu</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={handleRetry}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6 py-3 font-medium"
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

  if (!request && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Talep Bulunamadı</h3>
          <p className="text-gray-600 mb-6">Aradığınız talep mevcut değil veya erişim izniniz yok.</p>
          <Button 
            onClick={() => router.push('/dashboard/requests')}
            className="bg-gray-800 hover:bg-gray-900 rounded-xl px-6 py-3 font-medium"
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

    switch (userRole) {
      case 'santiye_depo':
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sade Header */}
      <div className="bg-white rounded-3xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between h-16">
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
                 request.status === 'şantiye şefi onayladı' ? 'Şantiye Şefi Onayladı' :
                 request.status === 'awaiting_offers' ? 'Onay Bekliyor' :
                 request.status === 'sipariş verildi' ? 'Sipariş Verildi' :
                 request.status === 'gönderildi' ? 'Gönderildi' :
                 request.status === 'kısmen gönderildi' ? 'Kısmen Gönderildi' :
                 request.status === 'depoda mevcut değil' ? 'Depoda Mevcut Değil' :
                 request.status === 'eksik onaylandı' ? 'Eksik Onaylandı' :
                 request.status === 'alternatif onaylandı' ? 'Alternatif Onaylandı' :
                 request.status === 'satın almaya gönderildi' ? 'Satın Almaya Gönderildi' :
                 request.status === 'eksik malzemeler talep edildi' ? 'Eksik Malzemeler Talep Edildi' : request.status}
              </Badge>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/dashboard/requests')}
                  className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 h-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Geri</span>
                </Button>
                <div>
                  
                  <p className="text-xs text-gray-500">{request.request_number}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-8">
          
          {/* Lokasyon Bilgisi - Sade */}
          <div className="mb-4 sm:mb-8">
            {request.site_name ? (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.site_name}</h2>
            ) : request.sites ? (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.sites.name}</h2>
            ) : request.construction_sites ? (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.construction_sites.name}</h2>
            ) : (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.department}</h2>
            )}
          </div>

          {/* Reddedilme Nedeni - Sadece reddedildi status'unda göster */}
          {request.status === 'reddedildi' && request.rejection_reason && (
            <div className="mb-4 sm:mb-8">
              <div className="bg-red-50 border border-red-200 rounded-lg">
                <div className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-900 mb-2">Talep Reddedildi</h3>
                      <p className="text-sm font-medium text-red-800 mb-2">Reddedilme Nedeni:</p>
                      <p className="text-sm text-red-700 leading-relaxed bg-red-100 rounded-lg p-4">
                        {request.rejection_reason}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Talep Detayları - Tek Kolon */}
          <div className="mb-4 sm:mb-8">
            <div className="bg-white border-0 shadow-sm rounded-3xl">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Talep Detayları</h3>
              </div>
              <div className="px-6 pb-6 space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Başlık</p>
                  <p className="text-lg font-medium text-gray-900">{request.title}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Departman</p>
                    <p className="text-base text-gray-900">{request.department}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Talep Eden</p>
                    <p className="text-base text-gray-900">
                      {request.profiles?.full_name || 'Kullanıcı bilgisi bulunamadı'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Talep Tarihi</p>
                    <p className="text-base text-gray-900">{new Date(request.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  {request.delivery_date && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Gerekli Tarih</p>
                      <p className="text-base text-gray-900">{new Date(request.delivery_date).toLocaleDateString('tr-TR')}</p>
                    </div>
                  )}
                  {/* Kategori Bilgileri */}
                  {request.category_name && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-500 mb-2">Malzeme Kategorisi</p>
                      <p className="text-base text-gray-900">{request.category_name}</p>
                      {request.subcategory_name && (
                        <p className="text-sm text-gray-600 mt-1">→ {request.subcategory_name}</p>
                      )}
                    </div>
                  )}
                  {/* Malzeme Sınıf ve Grup Bilgileri */}
                  {(request.material_class || request.material_group) && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="text-sm font-medium text-gray-500 mb-2">Malzeme Sınıflandırması</p>
                      <div className="flex flex-wrap items-center gap-3">
                      {request.material_class && (
                          <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-medium">Sınıf</span>
                          <p className="text-base text-gray-900">{request.material_class}</p>
                        </div>
                      )}
                      {request.material_group && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-medium">Grup</span>
                          <p className="text-base text-gray-900">{request.material_group}</p>
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                </div>
                  {request.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Açıklama</p>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4">{request.description}</p>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Kullanıcı rolüne göre uygun view'i render et */}
          {renderUserView()}

        </div>
      </div>
    </div>
  )
}
