'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Truck, Trash2 } from 'lucide-react'
import { OffersPageProps } from './types'
import DeliveryConfirmationModal from '@/components/DeliveryConfirmationModal'
import PartialDeliveryModal from '@/components/PartialDeliveryModal'
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
  
  // Malzeme silme onayı için state'ler
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<any>(null)
  const supabase = createClient()

  // Takip sistemi gösterilmeli mi kontrolü
  const shouldShowTrackingSystem = () => {
    return request?.status === 'sipariş verildi' || 
           request?.status === 'teslim alındı' || 
           request?.status === 'kısmen teslim alındı'
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

  // Malzeme kaldırma yetkisi kontrolü
  const canRemoveMaterial = () => {
    // Santiye Depo sadece pending durumunda kaldırabilir
    return request?.status === 'pending'
  }

  // Talebi düzenleme yetkisi kontrolü
  const canEditRequest = () => {
    // Sipariş verildi ve sonrası durumlarda düzenleme yapılamaz
    return request?.status === 'pending' || request?.status === 'site manager approved'
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
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">
              {shouldShowTrackingSystem()
                ? 'Malzeme Takip Sistemi' 
                : 'Depo İşlemleri'
              }
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {shouldShowTrackingSystem()
                ? 'Her malzeme için talep, gönderim ve teslimat durumu'
                : 'Talep edilen malzemeleri kontrol edin ve gönderim yapın'
              }
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            {request.purchase_request_items.map((item, index) => (
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
                onRemoveMaterial={handleRemoveMaterial}
                canRemoveMaterial={canRemoveMaterial()}
                canEditRequest={canEditRequest()}
                onOrderDeliveryConfirmation={handleOrderDeliveryConfirmation}
                hideTopDeliveryButtons={true}  // Sağ üstteki teslim alma butonlarını gizle
              />
            ))}
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
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
    </>
  )
}
