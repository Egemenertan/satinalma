'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Truck, Trash2, FileText } from 'lucide-react'
import { OffersPageProps } from './types'
import DeliveryConfirmationModal from '@/components/DeliveryConfirmationModal'
import PartialDeliveryModal from '@/components/PartialDeliveryModal'
import ReturnModal from '@/components/ReturnModal'
import RequestPDFExportModal from '@/components/RequestPDFExportModal'
import MaterialCard from './MaterialCard'
import StatusSummary from './StatusSummary'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface SantiyeDepoViewProps extends Pick<OffersPageProps, 'request' | 'materialSuppliers' | 'shipmentData' | 'onRefresh' | 'showToast'> {
  materialOrders: any[]
  currentOrder: any
}

export default function SantiyeDepoView({ 
  request, 
  materialSuppliers, 
  materialOrders, 
  shipmentData, 
  currentOrder,
  onRefresh, 
  showToast 
}: SantiyeDepoViewProps) {
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [selectedMaterialForDelivery, setSelectedMaterialForDelivery] = useState<any>(null)
  const [isPartialDeliveryModalOpen, setIsPartialDeliveryModalOpen] = useState(false)
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<any>(null)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null)
  
  // Malzeme silme onayı için state'ler
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<any>(null)
  
  // PDF export modal state
  const [showPDFExportModal, setShowPDFExportModal] = useState(false)
  
  // User site check
  const [userSiteId, setUserSiteId] = useState<string | null>(null)
  const [isGenelMerkezUser, setIsGenelMerkezUser] = useState(false)
  const [genelMerkezSiteId, setGenelMerkezSiteId] = useState<string | null>(null)
  
  const supabase = createClient()

  // Check if user is from "Genel Merkez Ofisi" site
  useEffect(() => {
    const checkUserSite = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.log('❌ Kullanıcı bulunamadı')
          return
        }

        console.log('👤 Kullanıcı ID:', user.id)

        // Get user profile with site_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('site_id')
          .eq('id', user.id)
          .single()

        console.log('📋 Kullanıcı profili:', profile)

        if (profile?.site_id && profile.site_id.length > 0) {
          const firstSiteId = profile.site_id[0]
          setUserSiteId(firstSiteId)
          console.log('🏢 Kullanıcı site ID:', firstSiteId)

          // Get "Genel Merkez Ofisi" site ID
          const { data: genelMerkezSite } = await supabase
            .from('sites')
            .select('id')
            .eq('name', 'Genel Merkez Ofisi')
            .single()

          console.log('🏢 Genel Merkez Ofisi site:', genelMerkezSite)

          if (genelMerkezSite) {
            setGenelMerkezSiteId(genelMerkezSite.id)
            const isGenel = firstSiteId === genelMerkezSite.id
            setIsGenelMerkezUser(isGenel)
            console.log('✅ Site kontrolü tamamlandı:', {
              userSiteId: firstSiteId,
              genelMerkezSiteId: genelMerkezSite.id,
              isGenelMerkezUser: isGenel
            })
          }
        } else {
          console.log('⚠️ Kullanıcının site_id bilgisi yok')
        }
      } catch (error) {
        console.error('❌ User site check error:', error)
      }
    }

    checkUserSite()
  }, [])

  // Takip sistemi gösterilmeli mi kontrolü
  const shouldShowTrackingSystem = () => {
    return request?.status === 'sipariş verildi' || 
           request?.status === 'teslim alındı' || 
           request?.status === 'kısmen teslim alındı' ||
           request?.status === 'iade var'
  }

  // PDF export butonu gösterilmeli mi?
  const shouldShowPDFExportButton = () => {
    const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    const isSpecialSite = request?.site_id === SPECIAL_SITE_ID
    
    // Özel site için: pending, kısmen gönderildi ve sipariş verildi statuslarında göster
    if (isSpecialSite) {
      return request?.status === 'pending' || 
             request?.status === 'kısmen gönderildi' ||
             request?.status === 'sipariş verildi'
    }
    
    // Genel Merkez Ofisi için: pending ve kısmen gönderildi
    return isGenelMerkezUser && (
      request?.status === 'pending' || 
      request?.status === 'kısmen gönderildi'
    )
  }

  // İade nedeniyle sipariş durumunda mı?
  const isReturnReorderStatus = () => {
    return request?.status === 'iade nedeniyle sipariş'
  }

  // Malzeme teslimat onayı fonksiyonu (eski shipment sistemi için)
  const handleMaterialDeliveryConfirmation = (item: any) => {
    console.log('🚚 Teslimat modalı açılıyor:', {
      itemId: item.id,
      itemName: item.item_name,
      materialOrdersForItem: materialOrders.filter((order: any) => 
        order.material_item_id === item.id
      ).map(order => ({
        orderId: order.id,
        isDelivered: order.is_delivered,
        quantity: order.quantity,
        supplier: order.supplier?.name || 'Unknown'
      }))
    })
    
    setSelectedMaterialForDelivery(item)
    setIsDeliveryModalOpen(true)
  }

  // Sipariş bazlı kademeli teslim alma fonksiyonu
  const handleOrderDeliveryConfirmation = (order: any, materialItem: any) => {
    console.log('📦 Kademeli teslim alma modalı açılıyor:', {
      orderId: order.id,
      orderQuantity: order.quantity,
      materialName: materialItem.item_name,
      supplierName: order.suppliers?.name || order.supplier?.name
    })
    
    setSelectedOrderForDelivery({
      ...order,
      materialItem: materialItem
    })
    setIsPartialDeliveryModalOpen(true)
  }

  // İade işlemi fonksiyonu
  const handleOrderReturn = (order: any, materialItem: any) => {
    console.log('🔄 İade modalı açılıyor:', {
      orderId: order.id,
      orderQuantity: order.quantity,
      returnedQuantity: order.returned_quantity || 0,
      materialName: materialItem.item_name,
      supplierName: order.suppliers?.name || order.supplier?.name
    })
    
    setSelectedOrderForReturn({
      ...order,
      materialItem: materialItem
    })
    setIsReturnModalOpen(true)
  }

  // Malzeme kaldırma yetkisi kontrolü
  const canRemoveMaterial = () => {
    // Santiye Depo için: sipariş verildi, teslim alındı ve sonrası durumlarda kaldırma yapılamaz
    // Kısmen gönderildi ve depoda mevcut değil durumlarında kaldırma yapılabilir
    const restrictedStatuses = ['sipariş verildi', 'teslim alındı', 'kısmen teslim alındı', 'gönderildi', 'iade var']
    return !restrictedStatuses.includes(request?.status)
  }

  // Talebi düzenleme yetkisi kontrolü
  const canEditRequest = () => {
    // Santiye Depo için: sipariş verildi, teslim alındı ve sonrası durumlarda düzenleme yapılamaz
    // Kısmen gönderildi ve depoda mevcut değil durumlarında düzenleme yapılabilir
    const restrictedStatuses = ['sipariş verildi', 'teslim alındı', 'kısmen teslim alındı', 'gönderildi', 'iade var']
    return !restrictedStatuses.includes(request?.status)
  }

  // Malzeme kaldırma onayı başlat
  const handleRemoveMaterial = (itemId: string) => {
    const materialItem = request?.purchase_request_items?.find((item: any) => item.id === itemId)
    if (materialItem) {
      setMaterialToDelete(materialItem)
      setShowDeleteConfirmModal(true)
    }
  }

  // Malzeme kaldırma onayı
  const confirmRemoveMaterial = async () => {
    if (!materialToDelete) return
    
    try {
      // En az 1 malzeme kalmalı
      if (request?.purchase_request_items?.length <= 1) {
        showToast('En az bir malzeme bulunmalıdır', 'error')
        setShowDeleteConfirmModal(false)
        setMaterialToDelete(null)
        return
      }

      // Malzemeyi veritabanından sil
      const { error } = await supabase
        .from('purchase_request_items')
        .delete()
        .eq('id', materialToDelete.id)

      if (error) {
        throw new Error(error.message)
      }

      showToast('Malzeme talepten kaldırıldı', 'success')
      onRefresh() // Sayfayı yenile
      
    } catch (error) {
      console.error('Malzeme kaldırma hatası:', error)
      showToast('Malzeme kaldırılırken hata oluştu', 'error')
    } finally {
      setShowDeleteConfirmModal(false)
      setMaterialToDelete(null)
    }
  }

  // Malzeme kaldırma iptal
  const cancelRemoveMaterial = () => {
    setShowDeleteConfirmModal(false)
    setMaterialToDelete(null)
  }

  if (!request?.purchase_request_items || request.purchase_request_items.length === 0) {
    return null
  }

  return (
    <>
    <Card className="bg-white border-0 shadow-sm rounded-3xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
           
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                {isReturnReorderStatus()
                  ? 'İade Nedeniyle Yeniden Sipariş'
                  : shouldShowTrackingSystem()
                    ? 'Malzeme Takip Sistemi' 
                    : 'Depo İşlemleri'
                }
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {isReturnReorderStatus()
                  ? 'Bu talep iade nedeniyle oluşturulmuştur. Gönderim işlemleri devre dışıdır ve sadece görüntüleme yapabilirsiniz.'
                  : shouldShowTrackingSystem()
                    ? 'Her malzeme için talep, gönderim ve teslimat durumu. İade sebepli yeni siparişler mor renkle işaretlenmiştir.'
                    : 'Talep edilen malzemeleri kontrol edin ve gönderim yapın'
                }
              </p>
            </div>
          </div>

          {/* PDF Export Button - Only for Genel Merkez Ofisi users on pending requests */}
          {shouldShowPDFExportButton() && (
            <Button
              onClick={() => setShowPDFExportModal(true)}
              className="bg-gray-900 rounded-xl hover:bg-gray-800 text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              Talep PDF'i
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            {request.purchase_request_items.map((item, index) => {
              // Her malzeme için gönderim durumunu kontrol et
              const itemShipments = shipmentData[item.id]
              const totalShipped = itemShipments?.total_shipped || 0
              const isDepotUnavailable = itemShipments?.shipments?.some(s => s.shipped_quantity === 0) || false
              const isPartiallyShipped = totalShipped > 0 && item.quantity > 0
              const isFullyShipped = totalShipped > 0 && item.quantity <= 0
              
              // Bu malzeme için düzenle/kaldır butonları gizlenmeli mi?
              const shouldHideButtons = isDepotUnavailable || isPartiallyShipped || isFullyShipped
              
              return (
                <MaterialCard
                  key={item.id}
                  item={item}
                  index={index}
                  request={request}
                  materialOrders={materialOrders}
                  shipmentData={shipmentData}
                  onRefresh={onRefresh}
                  showToast={showToast}
                  onMaterialDeliveryConfirmation={handleMaterialDeliveryConfirmation}
                  totalItems={request.purchase_request_items.length}
                  onRemoveMaterial={shouldHideButtons ? undefined : handleRemoveMaterial}
                  canRemoveMaterial={shouldHideButtons ? false : canRemoveMaterial()}
                  canEditRequest={shouldHideButtons ? false : canEditRequest()}
                  onOrderDeliveryConfirmation={handleOrderDeliveryConfirmation}
                  onOrderReturn={handleOrderReturn}
                  hideTopDeliveryButtons={true}  // Sağ üstteki teslim alma butonlarını gizle
                  onShipmentSuccess={() => {
                    // Gönderim başarılı olduğunda PDF export modalını aç (sadece Genel Merkez Ofisi kullanıcıları için)
                    console.log('🎯 Gönderim başarılı callback tetiklendi:', {
                      isGenelMerkezUser,
                      userSiteId,
                      genelMerkezSiteId,
                      willOpenModal: isGenelMerkezUser
                    })
                    
                    if (isGenelMerkezUser) {
                      console.log('✅ PDF Export modalı açılıyor...')
                      setShowPDFExportModal(true)
                    } else {
                      console.log('❌ Kullanıcı Genel Merkez Ofisi\'nden değil, modal açılmıyor')
                    }
                  }}
                />
              )
            })}
        </div>

        {/* Genel Durum Özeti */}
          <StatusSummary 
            request={request} 
            shipmentData={shipmentData} 
          />
      </CardContent>
    </Card>

    {/* Malzeme Silme Onay Modalı */}
    <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-900">
            <Trash2 className="w-5 h-5 text-red-600" />
            Malzemeyi Kaldır
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="bg-red-50 border border-red-200 rounded-3xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-red-900 mb-1">
                  Malzeme Silinecek
                </h4>
                {materialToDelete && (
                  <p className="text-sm text-red-800">
                    "<strong>{materialToDelete.item_name}</strong>" 
                    malzemesi talepten tamamen kaldırılacaktır.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Bu işlem geri alınamaz. Malzemeyi kaldırmak istediğinizden emin misiniz?
          </p>
          
         
        </div>

        <DialogFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={cancelRemoveMaterial}
            className="flex-1"
          >
            İptal
          </Button>
          <Button
            type="button"
            onClick={confirmRemoveMaterial}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Kaldır
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Teslimat Onayı Modalı - Eski sistem (shipment tablosu için) */}
    <DeliveryConfirmationModal
      isOpen={isDeliveryModalOpen}
      onClose={() => {
        setIsDeliveryModalOpen(false)
        setSelectedMaterialForDelivery(null)
      }}
      materialItem={selectedMaterialForDelivery}
      materialOrders={selectedMaterialForDelivery ? materialOrders.filter((order: any) => 
        order.material_item_id === selectedMaterialForDelivery.id
      ) : []}
      shipmentData={shipmentData}
      onSuccess={() => {
        onRefresh()
        setSelectedMaterialForDelivery(null)
      }}
      showToast={showToast}
      requestId={request?.id}
    />

    {/* Kademeli Teslim Alma Modalı - Yeni sistem (order_deliveries tablosu için) */}
    <PartialDeliveryModal
      isOpen={isPartialDeliveryModalOpen}
      onClose={() => {
        setIsPartialDeliveryModalOpen(false)
        setSelectedOrderForDelivery(null)
      }}
      order={selectedOrderForDelivery}
      materialItem={selectedOrderForDelivery?.materialItem}
      onSuccess={async () => {
        onRefresh()
        setSelectedOrderForDelivery(null)
        
        // Cache'i temizle ki tabloda güncel status gözüksün
        try {
          const { invalidatePurchaseRequestsCache } = await import('@/lib/cache')
          invalidatePurchaseRequestsCache()
          
          // SWR cache'ini de manuel olarak temizle
          const { mutate } = await import('swr')
          mutate('purchase_requests_stats')
          mutate('pending_requests_count')
          
          // Tüm purchase_requests cache'lerini temizle
          mutate((key) => typeof key === 'string' && key.startsWith('purchase_requests/'))
          
          console.log('✅ SantiyeDepoView cache temizlendi')
        } catch (error) {
          console.error('Cache temizleme hatası:', error)
        }
      }}
      showToast={showToast}
    />

    {/* İade Modalı */}
    <ReturnModal
      isOpen={isReturnModalOpen}
      onClose={() => {
        setIsReturnModalOpen(false)
        setSelectedOrderForReturn(null)
      }}
      order={selectedOrderForReturn}
      materialItem={selectedOrderForReturn?.materialItem}
      onSuccess={async () => {
        onRefresh()
        setSelectedOrderForReturn(null)
        
        // Cache'i temizle ki tabloda güncel status gözüksün
        try {
          const { invalidatePurchaseRequestsCache } = await import('@/lib/cache')
          invalidatePurchaseRequestsCache()
          
          // SWR cache'ini de manuel olarak temizle
          const { mutate } = await import('swr')
          mutate('purchase_requests_stats')
          mutate('pending_requests_count')
          
          // Tüm purchase_requests cache'lerini temizle
          mutate((key) => typeof key === 'string' && key.startsWith('purchase_requests/'))
          
          console.log('✅ SantiyeDepoView cache temizlendi (iade sonrası)')
        } catch (error) {
          console.error('Cache temizleme hatası:', error)
        }
      }}
      showToast={showToast}
    />

    {/* PDF Export Modal */}
    <RequestPDFExportModal
      isOpen={showPDFExportModal}
      onClose={() => setShowPDFExportModal(false)}
      request={request}
      showToast={showToast}
    />
    </>
  )
}
