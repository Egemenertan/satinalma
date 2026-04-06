'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Package, CheckCircle, X, Truck, Clock, Check, Edit, Trash2, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import { useRouter } from 'next/navigation'

interface MaterialCardProps {
  item: any
  index: number
  request: any
  materialOrders: any[]
  shipmentData: any
  onRefresh: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onMaterialDeliveryConfirmation: (item: any) => void
  totalItems: number
  onRemoveMaterial?: (itemId: string) => void  // Malzeme kaldırma fonksiyonu
  canRemoveMaterial?: boolean  // Kaldırma yetkisi kontrolü
  canEditRequest?: boolean  // Talebi düzenleme yetkisi kontrolü
  onOrderDeliveryConfirmation?: (order: any, materialItem: any, isEditMode?: boolean) => void  // Kademeli teslim alma fonksiyonu
  onOrderReturn?: (order: any, materialItem: any) => void  // İade işlemi fonksiyonu
  hideTopDeliveryButtons?: boolean  // Sağ üstteki teslim alma butonlarını gizle
  onShipmentSuccess?: () => void  // Gönderim başarılı olduğunda tetiklenecek callback
  productStock?: {  // Products tablosundan gelen stok bilgisi
    totalAvailable: number
    warehouses: Array<{
      name: string
      quantity: number
    }>
  }
}

export default function MaterialCard({ 
  item, 
  index, 
  request, 
  materialOrders, 
  shipmentData, 
  onRefresh, 
  showToast,
  onMaterialDeliveryConfirmation,
  totalItems,
  onRemoveMaterial,
  canRemoveMaterial = false,
  canEditRequest = true,
  onOrderDeliveryConfirmation,
  onOrderReturn,
  hideTopDeliveryButtons = false,
  onShipmentSuccess,
  productStock
}: MaterialCardProps) {
  const [sendQuantities, setSendQuantities] = useState<{[key: string]: string}>({})
  const [sendingItem, setSendingItem] = useState(false)
  const [processingDepotStatus, setProcessingDepotStatus] = useState<{[key: string]: boolean}>({})
  const supabase = createClient()
  const router = useRouter()

  // Takip sistemi gösterilmeli mi kontrolü
  const shouldShowTrackingSystem = () => {
    return request?.status === 'sipariş verildi' || 
           request?.status === 'teslim alındı' || 
           request?.status === 'kısmen teslim alındı'
  }

  // İade nedeniyle sipariş durumunda gönderim işlemleri devre dışı mı?
  const isReturnReorderStatus = () => {
    return request?.status === 'iade nedeniyle sipariş'
  }

  // Malzeme bazında teslimat kontrolleri
  const getMaterialDeliveryStatus = (item: any) => {
    const materialOrdersForItem = materialOrders.filter((order: any) => 
      order.material_item_id === item.id
    )
    
    if (materialOrdersForItem.length === 0) {
      return { hasOrders: false, allDelivered: false, someDelivered: false }
    }
    
    const deliveredCount = materialOrdersForItem.filter((order: any) => order.is_delivered).length
    const totalCount = materialOrdersForItem.length
    
    return {
      hasOrders: true,
      allDelivered: deliveredCount === totalCount,
      someDelivered: deliveredCount > 0,
      deliveredCount,
      totalCount
    }
  }

  const handleSingleItemDepotNotAvailable = async (item: any) => {
    if (processingDepotStatus[item.id]) {
      return
    }
    
    setProcessingDepotStatus(prev => ({ ...prev, [item.id]: true }))
    try {
      console.log('🚫 Tek malzeme depoda mevcut değil işlemi başlıyor:', {
        requestId: request.id,
        itemId: item.id,
        itemName: item.item_name,
        currentQuantity: item.quantity
      })

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı bilgisi alınamadı')
      }

      const itemShipments = shipmentData[item.id]
      const alreadyShipped = (itemShipments?.total_shipped || 0) > 0
      
      if (alreadyShipped) {
        showToast(`${item.item_name} zaten gönderilmiş.`, 'info')
        setProcessingDepotStatus(prev => ({ ...prev, [item.id]: false }))
        return
      }

      if (item.quantity <= 0) {
        showToast(`${item.item_name} zaten işlenmiş.`, 'info')
        setProcessingDepotStatus(prev => ({ ...prev, [item.id]: false }))
        return
      }

      console.log(`🔄 ${item.item_name} için depoda yok kaydı oluşturuluyor...`)
      
      const originalQuantity = item.original_quantity || item.quantity
      
      if (item.original_quantity && item.quantity !== originalQuantity) {
        console.log(`📊 Quantity güncelleniyor: ${item.quantity} -> ${originalQuantity} (depoda yok - original quantity'ye eşitleniyor)`)
        
        const { error: rpcError } = await supabase
          .rpc('update_purchase_request_item_quantity', {
            item_id: item.id,
            new_quantity: originalQuantity
          })
        
        if (rpcError) {
          console.log('⚠️ RPC başarısız, direkt update deneniyor...', rpcError)
          
          const { error: updateError } = await supabase
            .from('purchase_request_items')
            .update({ quantity: originalQuantity })
            .eq('id', item.id)
          
          if (updateError) {
            console.error(`❌ ${item.item_name} miktar güncellenemedi:`, updateError)
            throw new Error(`${item.item_name} için miktar güncellenemedi`)
          }
        }
      }

      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          purchase_request_id: request.id,
          purchase_request_item_id: item.id,
          shipped_quantity: 0,
          shipped_by: user.id,
          notes: `${item.item_name} - Depoda mevcut değil (0 adet gönderildi)`
        })

      if (shipmentError) {
        console.error(`❌ ${item.item_name} shipment error:`, shipmentError)
        throw new Error(`${item.item_name} için gönderim kaydı oluşturulamadı: ${shipmentError.message}`)
      }

      // Status güncelleme
      try {
        await supabase.rpc('update_purchase_request_status_manual', {
          request_id: request.id
        })
      } catch (error) {
        console.error('❌ Status güncelleme hatası:', error)
      }
      
      console.log(`✅ ${item.item_name} için depoda mevcut değil işlemi tamamlandı`)
      showToast(`${item.item_name} "Depoda Mevcut Değil" olarak işaretlendi.`, 'info')
      await onRefresh()
      invalidatePurchaseRequestsCache()
      
    } catch (error) {
      console.error('Error updating single item depot status:', error)
      showToast(error.message || 'Durum güncellenirken hata oluştu.', 'error')
    } finally {
      setProcessingDepotStatus(prev => ({ ...prev, [item.id]: false }))
    }
  }

  const handleSingleItemSend = async (item: any, sentQuantity: number) => {
    try {
      console.log('🚀 BASİT Gönderim başlıyor:', {
        itemName: item.item_name,
        currentQuantity: item.quantity,
        sentQuantity,
        willRemain: item.quantity - sentQuantity
      })

      if (sentQuantity <= 0) {
        throw new Error('Gönderim miktarı 0\'dan büyük olmalı')
      }
      
      if (sentQuantity > item.quantity) {
        throw new Error(`Maksimum ${item.quantity} ${item.unit} gönderebilirsiniz`)
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı bilgisi alınamadı')
      }

      const newQuantity = Math.max(0, item.quantity - sentQuantity)
      
      console.log('🔄 Quantity güncelleniyor (önce):', {
        itemId: item.id,
        from: item.quantity,
        sent: sentQuantity,
        to: newQuantity
      })
      
      const { error: rpcError } = await supabase
        .rpc('update_purchase_request_item_quantity', {
          item_id: item.id,
          new_quantity: newQuantity
        })
      
      if (rpcError) {
        console.log('⚠️ RPC başarısız, direkt update deneniyor...', rpcError)
        
        const { error: updateError } = await supabase
          .from('purchase_request_items')
          .update({ quantity: newQuantity })
          .eq('id', item.id)
        
        if (updateError) {
          throw new Error(`Miktar güncellenemedi: ${updateError.message || rpcError.message}`)
        }
      }

      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          purchase_request_id: request.id,
          purchase_request_item_id: item.id,
          shipped_quantity: sentQuantity,
          shipped_by: user.id,
          notes: `${item.item_name} - ${sentQuantity} ${item.unit} gönderildi`
        })

      if (shipmentError) {
        console.error('❌ Shipment error:', shipmentError)
        await supabase
          .rpc('update_purchase_request_item_quantity', {
            item_id: item.id,
            new_quantity: item.quantity
          })
        throw new Error('Gönderim kaydı oluşturulamadı')
      }

      // Status güncelleme
      try {
        await supabase.rpc('update_purchase_request_status_manual', {
          request_id: request.id
        })
      } catch (error) {
        console.error('❌ Status güncelleme hatası:', error)
      }

      showToast(
        newQuantity === 0 
          ? `${item.item_name} tamamen gönderildi!` 
          : `${sentQuantity} ${item.unit} gönderildi. Kalan: ${newQuantity} ${item.unit}`,
        'success'
      )

      await onRefresh()
      invalidatePurchaseRequestsCache()
      
      // Gönderim başarılı olduğunda callback'i tetikle
      if (onShipmentSuccess) {
        onShipmentSuccess()
      }

    } catch (error: any) {
      console.error('❌ Gönderim hatası:', error)
      showToast(error.message || 'Gönderim başarısız', 'error')
    }
  }

  const itemShipments = shipmentData[item.id]
  const totalShipped = itemShipments?.total_shipped || 0
  const isShipped = totalShipped > 0
  
  const originalQuantity = item.original_quantity || item.quantity
  const remainingQuantity = item.quantity

  // Malzeme durumu kontrolü - düzenle/kaldır butonları için
  const isDepotUnavailable = itemShipments?.shipments?.some(s => s.shipped_quantity === 0) || false
  const isPartiallyShipped = totalShipped > 0 && remainingQuantity > 0
  const isFullyShipped = totalShipped > 0 && remainingQuantity <= 0
  
  // Düzenle/kaldır butonları gösterilmemeli mi?
  const shouldHideEditButtons = isDepotUnavailable || isPartiallyShipped || isFullyShipped

  return (
    <div className="border border-gray-200 rounded-3xl bg-white">
      {/* Malzeme Header */}
      <div className="p-3 sm:p-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              {totalItems > 1 && (
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-medium flex-shrink-0">
                  {index + 1}
                </div>
              )}
              <h5 className="text-base sm:text-xl font-semibold text-gray-900 break-words">{item.item_name}</h5>
            </div>
            
            {/* Malzeme Detayları */}
            <div className="grid grid-cols-1 gap-2 sm:gap-3 text-xs sm:text-sm">
              {item.brand && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[60px] sm:min-w-[80px]">Marka:</span>
                  <span className="font-medium text-gray-900 break-words">{item.brand}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-gray-500 min-w-[60px] sm:min-w-[80px]">Amaç:</span>
                <span className="font-medium text-gray-900 break-words">{item.purpose}</span>
              </div>
              
              {item.delivery_date && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[60px] sm:min-w-[80px]">Gerekli:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(item.delivery_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              )}
            </div>
            
            {item.specifications && (
              <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-gray-50 rounded-2xl sm:rounded-3xl">
                <span className="text-xs sm:text-sm text-gray-600 break-words">{item.specifications}</span>
              </div>
            )}
            
            {/* Malzeme Açıklaması - Her zaman göster */}
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-2xl sm:rounded-3xl">
              <span className="text-[10px] sm:text-xs font-medium text-blue-700 block mb-1">Açıklama:</span>
              <p className="text-xs sm:text-sm text-gray-800 break-words">
                {item.description || 'Açıklama girilmemiş'}
              </p>
            </div>
          </div>
          
          {/* Düzenle ve Kaldır Butonları */}
          <div className="flex flex-row sm:flex-col items-start sm:items-end gap-1 sm:gap-2 w-full sm:w-auto">
            {!shouldHideEditButtons && (
              <div className="flex gap-1 w-full sm:w-auto">
                {/* Düzenle Butonu - sadece düzenleme yetkisi varsa göster */}
                {canEditRequest && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/requests/${request.id}/edit`)}
                    className="h-7 sm:h-8 px-2 sm:px-3 bg-white/80 rounded-xl sm:rounded-2xl hover:bg-white border-gray-200 hover:border-gray-300 flex items-center gap-1 flex-1 sm:flex-none"
                    title="Talebi Düzenle"
                  >
                    <Edit className="h-3 w-3 text-gray-600" />
                    <span className="text-xs text-gray-600">Düzenle</span>
                  </Button>
                )}
                
                {/* Kaldır Butonu */}
                {canRemoveMaterial && onRemoveMaterial && totalItems > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveMaterial(item.id)}
                    className="h-7 sm:h-8 px-2 sm:px-3 bg-red-50 rounded-xl sm:rounded-2xl hover:bg-red-100 border-red-200 hover:border-red-300 flex items-center gap-1 flex-1 sm:flex-none"
                    title="Malzemeyi Kaldır"
                  >
                    <Trash2 className="h-3 w-3 text-red-600" />
                    <span className="text-xs text-red-600">Kaldır</span>
                  </Button>
                )}
              </div>
            )}
            
            {!shouldShowTrackingSystem() && (
              <Badge className={`${isShipped ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {isShipped ? '✓ Gönderildi' : '⏳ Bekliyor'}
              </Badge>
            )}

            {shouldShowTrackingSystem() && !hideTopDeliveryButtons && (
              <>
                {(() => {
                  if (request?.status === 'sipariş verildi') {
                    const deliveryStatus = getMaterialDeliveryStatus(item)
                    
                    if (!deliveryStatus.hasOrders) {
                      return (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Sipariş yok
                        </Badge>
                      )
                    }
                    
                    if (deliveryStatus.allDelivered) {
                      return (
                        <Badge className="bg-green-100 text-green-700">
                          <Check className="h-3 w-3 mr-1" />
                          Teslim Alındı
                        </Badge>
                      )
                    }
                    
                    if (deliveryStatus.someDelivered) {
                      return (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700">
                          <Clock className="h-3 w-3 mr-1" />
                          {deliveryStatus.deliveredCount}/{deliveryStatus.totalCount}
                        </Badge>
                      )
                    }
                    
                    return (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        Sipariş Verildi
                      </Badge>
                    )
                  }
                  
                  if (request?.status === 'teslim alındı') {
                    return (
                      <Badge className="bg-green-100 text-green-700">
                        <Check className="h-3 w-3 mr-1" />
                        Teslim Alındı
                      </Badge>
                    )
                  }
                  
                  if (request?.status === 'kısmen teslim alındı') {
                    const deliveryStatus = getMaterialDeliveryStatus(item)
                    return (
                      <Badge className="bg-orange-100 text-orange-700">
                        <Clock className="h-3 w-3 mr-1" />
                        {deliveryStatus.hasOrders ? 
                          `${deliveryStatus.deliveredCount}/${deliveryStatus.totalCount}` : 
                          'Kısmen'
                        }
                      </Badge>
                    )
                  }
                  
                  return null
                })()}
              </>
            )}


          </div>
        </div>
      </div>

      {/* Tedarikçi Bilgileri - Temiz ve düzenli tasarım */}
      {shouldShowTrackingSystem() && (
        <div className="p-3 sm:p-4 border-b border-gray-100">
          {(() => {
            const itemOrders = materialOrders.filter((order: any) => 
              order.material_item_id === item.id
            )
            
            if (itemOrders.length === 0) {
              return (
                <div className="text-center py-3 sm:py-4">
                  <div className="text-xs sm:text-sm text-gray-500">Bu malzeme için henüz sipariş verilmemiş</div>
                </div>
              )
            }

            // İade yeniden siparişi var mı kontrol et
            const hasReturnReorder = itemOrders.some((order: any) => order.is_return_reorder)

            // Tedarikçiye göre grupla (kademeli teslim alma dahil)
            const supplierGroups = itemOrders.reduce((groups: any, order: any) => {
              const supplierId = order.supplier?.id || 'unknown'
              const supplierName = order.supplier?.name || 'Bilinmeyen Tedarikçi'
              
              if (!groups[supplierId]) {
                groups[supplierId] = {
                  supplier: order.supplier,
                  name: supplierName,
                  orders: [],
                  totalQuantity: 0,
                  totalDelivered: 0,
                  remainingQuantity: 0,
                  deliveredCount: 0,
                  totalCount: 0,
                  hasReturnReorder: false // İade yeniden siparişi var mı?
                }
              }
              
              groups[supplierId].orders.push(order)
              groups[supplierId].totalQuantity += order.quantity || 0
              groups[supplierId].totalCount += 1
              
              // İade yeniden siparişi kontrolü
              if (order.is_return_reorder) {
                groups[supplierId].hasReturnReorder = true
              }
              
              // Kademeli teslim alma miktarını hesapla
              const deliveredQuantity = order.delivered_quantity || 0
              groups[supplierId].totalDelivered += deliveredQuantity
              
              if (order.is_delivered) {
                groups[supplierId].deliveredCount += 1
              }
              
              return groups
            }, {})
            
            // Her tedarikçi için kalan miktarı hesapla
            Object.keys(supplierGroups).forEach(supplierId => {
              const group = supplierGroups[supplierId]
              // İade edilen miktarı da hesaba kat
              const totalReturned = group.orders.reduce((sum: number, order: any) => 
                sum + (order.returned_quantity || 0), 0
              )
              group.totalReturned = totalReturned
              group.remainingQuantity = group.totalQuantity - group.totalDelivered - totalReturned
            })
            
            const suppliers = Object.values(supplierGroups)
            
            return (
              <div className="space-y-3">
                <h6 className="text-sm font-medium text-gray-700 mb-2">Sipariş Bilgileri</h6>
                <div className="space-y-2">
                  {suppliers.map((supplier: any, index: number) => (
                    <div key={index} className="bg-white rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {supplier.name}
                        </h3>
                        <div className="shrink-0">
                          {(() => {
                            // Tedarikçinin tüm siparişlerinin statuslarını kontrol et
                            const orderStatuses = supplier.orders.map((order: any) => {
                              const returnedQty = order.returned_quantity || 0
                              const deliveredQty = order.delivered_quantity || 0
                              const orderQty = order.quantity || 0
                              
                              // Status hesaplama mantığı - önce miktarlara göre hesapla
                              const totalProcessed = deliveredQty + returnedQty
                              
                              // Eğer sipariş tamamen iade edildiyse
                              if (returnedQty >= orderQty && returnedQty > 0) {
                                return 'iade edildi'
                              }
                              
                              // Eğer sipariş tamamen teslim alındıysa
                              if (deliveredQty >= orderQty && deliveredQty > 0) {
                                return 'teslim alındı'
                              }
                              
                              // Kısmi durumlar
                              if (deliveredQty > 0 && returnedQty > 0) {
                                // Hem teslim hem iade var
                                if (totalProcessed >= orderQty) {
                                  return 'teslim alındı' // Toplam işlem tamamlandı
                                } else {
                                  return 'kısmen teslim alındı'
                                }
                              } else if (deliveredQty > 0) {
                                return 'kısmen teslim alındı'
                              } else if (returnedQty > 0) {
                                return 'iade edildi'
                              }
                              
                              // Hiçbir işlem yapılmamışsa order.status'u kontrol et
                              if (order.status) {
                                return order.status
                              }
                              
                              return 'pending'
                            })
                            
                            // Öncelik sırası: iade edildi > kısmen teslim alındı > teslim alındı > pending
                            if (orderStatuses.some(s => s === 'iade edildi')) {
                              return (
                                <Badge className="bg-red-100 text-red-700">
                                  İade Edildi
                                </Badge>
                              )
                            }
                            
                            if (orderStatuses.every(s => s === 'teslim alındı')) {
                              return (
                                <Badge className="bg-green-100 text-green-700 text-xs px-2 py-1">
                                  Tamamı Teslim Alındı
                                </Badge>
                              )
                            }
                            
                            if (orderStatuses.some(s => s === 'kısmen teslim alındı')) {
                              return (
                                <Badge className="bg-orange-100 text-orange-700 text-xs px-2 py-1">
                                  Kısmen Teslim Alındı
                                </Badge>
                              )
                            }
                            
                            return (
                              <Badge className="bg-blue-100 text-blue-700 text-xs px-2 py-1">
                                Sipariş Verildi
                              </Badge>
                            )
                          })()}
                        </div>
                      </div>

                      {/* Miktar Bilgileri - Tek satırda kompakt */}
                      <div className="flex flex-wrap gap-3 text-xs mb-2">
                        <span className="text-gray-500">Sipariş: <span className="font-medium text-gray-900">{supplier.totalQuantity.toFixed(2)} {item.unit}</span></span>
                        <span className="text-gray-500">Teslim: <span className="font-medium text-green-600">{supplier.totalDelivered.toFixed(2)} {item.unit}</span></span>
                        {supplier.totalReturned > 0 && (
                          <>
                            <span className="text-gray-500">İade: <span className="font-medium text-orange-600">{supplier.totalReturned.toFixed(2)} {item.unit}</span></span>
                            <span className="text-gray-500">Kalan: <span className="font-medium text-blue-600">{supplier.remainingQuantity.toFixed(2)} {item.unit}</span></span>
                          </>
                        )}
                      </div>
                      
                      {/* İletişim - Çok kompakt */}
                      {(supplier.supplier?.contact_person || supplier.supplier?.phone) && (
                        <div className="flex gap-3 text-[10px] text-gray-500 mb-2">
                          {supplier.supplier?.contact_person && <span>{supplier.supplier.contact_person}</span>}
                          {supplier.supplier?.phone && <span>{supplier.supplier.phone}</span>}
                        </div>
                      )}

                      {/* Siparişler - Çok kompakt */}
                      {onOrderDeliveryConfirmation && supplier.orders && supplier.orders.length > 0 && (
                        <div className="space-y-1.5">
                            {supplier.orders.map((order: any) => {
                              const hasDeliveries = order.total_delivered > 0
                              const returnedQuantity = order.returned_quantity || 0
                              const deliveredQuantity = order.total_delivered || 0
                              // Kalan miktar = Sipariş - Teslim alınan - İade edilen
                              const remainingQuantity = (order.quantity || 0) - deliveredQuantity - returnedQuantity
                              const isCompleted = remainingQuantity <= 0
                              const canDeliver = remainingQuantity > 0
                              // İade edilebilir miktar = Kalan miktar (henüz teslim alınmamış)
                              const canReturn = remainingQuantity > 0
                              const orderStatus = order.status || 'pending'
                              
                              return (
                                <div key={order.id} className={`flex items-center gap-2 p-2 rounded-xl ${order.is_return_reorder ? 'bg-purple-50' : 'bg-white'}`}>
                                  <div className="flex gap-1.5">
                                    {canDeliver && (
                                      <Button size="sm" onClick={() => onOrderDeliveryConfirmation(order, item)} className="h-9 px-5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-xl">
                                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Teslim Al
                                      </Button>
                                    )}
                                    {hasDeliveries && !canDeliver && (
                                      <Button size="sm" onClick={() => onOrderDeliveryConfirmation(order, item, true)} className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl">
                                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        Düzenle
                                      </Button>
                                    )}
                                    {onOrderReturn && canReturn && (
                                      <Button size="sm" onClick={() => onOrderReturn(order, item)} className="h-9 px-5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-xl">
                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                        İade
                                      </Button>
                                    )}
                                    {isCompleted && (
                                      <span className="text-[10px] text-green-600 font-medium flex items-center px-2">
                                        <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Tamamlandı
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                      )}
                      
                      {/* Teslimat Tarihi - Kompakt */}
                      {(() => {
                        const nextDeliveryDate = supplier.orders.map((order: any) => order.delivery_date).filter(Boolean).sort()[0]
                        if (nextDeliveryDate) {
                          const deliveryDate = new Date(nextDeliveryDate)
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          deliveryDate.setHours(0, 0, 0, 0)
                          const diffTime = deliveryDate.getTime() - today.getTime()
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                          let statusColor = diffDays < 0 ? 'text-red-600' : diffDays === 0 ? 'text-orange-600' : 'text-gray-600'
                          let statusText = diffDays < 0 ? `${Math.abs(diffDays)}g geçti` : diffDays === 0 ? 'Bugün' : `${diffDays}g`
                          return (
                            <div className="flex items-center justify-between text-[10px] mt-1.5 text-gray-500">
                              <span>Teslimat: <span className="text-gray-900">{deliveryDate.toLocaleDateString('tr-TR')}</span></span>
                              <span className={statusColor}>{statusText}</span>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Detaylı takip sistemi - minimal */}
      {shouldShowTrackingSystem() && (
        <div className="p-3 border-b border-gray-100">
          <h6 className="text-xs font-medium text-gray-700 mb-2">Durum Takibi</h6>
          <div className="grid grid-cols-2 gap-2">
            {/* İlk Talep */}
            <div className="bg-white border border-gray-100 rounded-xl p-2">
              <div className="text-[10px] font-medium text-gray-500 mb-0.5 truncate">İlk Talep</div>
              <div className="text-sm font-semibold text-gray-900 truncate">
                {(() => {
                  const originalRequest = item.original_quantity ?? item.quantity
                  return `${originalRequest.toFixed(2)} ${item.unit}`
                })()}
              </div>
            </div>
            
            {/* Depodan Gönderilen */}
            <div className="bg-white border border-gray-100 rounded-xl p-2">
              <div className="text-[10px] font-medium text-gray-500 mb-0.5 truncate">Depodan Gönderilen</div>
              <div className="text-sm font-semibold text-green-600 truncate">
                {(() => {
                  const itemShipments = shipmentData[item.id]
                  const depoShipped = itemShipments?.total_shipped || 0
                  return `${depoShipped.toFixed(2)} ${item.unit}`
                })()}
              </div>
              {(() => {
                const itemShipments = shipmentData[item.id]
                const shipmentCount = itemShipments?.shipments?.length || 0
                if (shipmentCount > 0) {
                  return (
                    <div className="text-[9px] text-gray-500 mt-0.5 truncate">
                      {shipmentCount} gönderim
                    </div>
                  )
                }
                return <div className="text-[9px] text-gray-400 mt-0.5">-</div>
              })()}
            </div>
            
            {/* Sipariş Verildi */}
            <div className="bg-white border border-gray-100 rounded-xl p-2">
              <div className="text-[10px] font-medium text-gray-500 mb-0.5 truncate">Sipariş Verildi</div>
              <div className="text-sm font-semibold text-green-600 truncate">
                {(() => {
                  const totalOrdered = materialOrders
                    .filter((order: any) => order.material_item_id === item.id)
                    .reduce((sum: number, order: any) => sum + (order.quantity || 0), 0)
                  return `${totalOrdered.toFixed(2)} ${item.unit}`
                })()}
              </div>
              {(() => {
                const orderCount = materialOrders.filter((order: any) => 
                  order.material_item_id === item.id
                ).length
                const deliveredCount = materialOrders.filter((order: any) => 
                  order.material_item_id === item.id && order.is_delivered === true
                ).length
                
                if (orderCount > 0) {
                  if (deliveredCount === orderCount) {
                    return (
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1 truncate">
                        Tamamı teslim alındı
                      </div>
                    )
                  } else if (deliveredCount > 0) {
                    return (
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1 truncate">
                        {deliveredCount}/{orderCount} teslim alındı
                      </div>
                    )
                  } else {
                    return (
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1 truncate">
                        {orderCount} sipariş bekleniyor
                      </div>
                    )
                  }
                }
                return <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Sipariş yok</div>
              })()}
            </div>
            
            {/* Teslimat Tarihi */}
            <div className="bg-white border border-gray-100 rounded-xl p-2">
              <div className="text-[10px] font-medium text-gray-500 mb-0.5 truncate">Teslimat</div>
              <div className="text-sm font-semibold text-gray-900 truncate">
                {(() => {
                  const itemOrders = materialOrders.filter((order: any) => 
                    order.material_item_id === item.id
                  )
                  
                  if (itemOrders.length === 0) {
                    return "Sipariş yok"
                  }
                  
                  const nearestDeliveryDate = itemOrders
                    .map((order: any) => order.delivery_date)
                    .filter(Boolean)
                    .sort()[0]
                    
                  if (!nearestDeliveryDate) {
                    return "Tarih yok"
                  }
                  
                  const deliveryDate = new Date(nearestDeliveryDate)
                  return deliveryDate.toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit'
                  })
                })()}
              </div>
              {(() => {
                const itemOrders = materialOrders.filter((order: any) => 
                  order.material_item_id === item.id
                )
                
                if (itemOrders.length === 0) {
                  return <div className="text-xs text-gray-500 mt-1">-</div>
                }
                
                const nearestDeliveryDate = itemOrders
                  .map((order: any) => order.delivery_date)
                  .filter(Boolean)
                  .sort()[0]
                  
                if (!nearestDeliveryDate) {
                  return <div className="text-xs text-gray-500 mt-1">-</div>
                }
                
                const deliveryDate = new Date(nearestDeliveryDate)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                deliveryDate.setHours(0, 0, 0, 0)
                
                const diffTime = deliveryDate.getTime() - today.getTime()
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                
                if (diffDays < 0) {
                  return (
                    <div className="text-xs text-gray-600 mt-1">
                      {Math.abs(diffDays)} gün geçti
                    </div>
                  )
                } else if (diffDays === 0) {
                  return (
                    <div className="text-xs text-gray-600 mt-1">Bugün</div>
                  )
                } else if (diffDays <= 3) {
                  return (
                    <div className="text-xs text-gray-600 mt-1">
                      {diffDays} gün kaldı
                    </div>
                  )
                } else {
                  return (
                    <div className="text-xs text-gray-600 mt-1">
                      {diffDays} gün kaldı
                    </div>
                  )
                }
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Miktar Bilgileri - Kompakt */}
      {!shouldShowTrackingSystem() && (
        <div className="p-3 border-b border-gray-100">
          <h6 className="text-xs font-medium text-gray-700 mb-2">Miktar Durumu</h6>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-100 rounded-xl p-2">
              <div className="text-[10px] font-medium text-gray-500 mb-0.5">İlk Talep</div>
              <div className="text-sm font-semibold text-gray-900">{originalQuantity} {item.unit}</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-2">
              <div className="text-[10px] font-medium text-gray-500 mb-0.5">Gönderilen</div>
              <div className="text-sm font-semibold text-green-600">{totalShipped.toFixed(2)} {item.unit}</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-2">
              <div className="text-[10px] font-medium text-gray-500 mb-0.5">Kalan</div>
              <div className="text-sm font-semibold text-red-600">{Math.max(0, remainingQuantity).toFixed(2)} {item.unit}</div>
              <div className="text-[9px] text-gray-500 mt-0.5">{remainingQuantity <= 0 ? 'Tamamlandı' : 'Bekliyor'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Malzeme Resimleri */}
      {item.image_urls && item.image_urls.length > 0 && (
        <div className="p-3 border-b border-gray-100">
          <h6 className="text-xs font-medium text-gray-700 mb-2">Malzeme Görselleri</h6>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {item.image_urls.slice(0, 6).map((url, imgIndex) => (
              <div 
                key={imgIndex} 
                className="aspect-square bg-white rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all"
                onClick={() => {
                  const img = new Image()
                  img.src = url
                  img.onload = () => {
                    const w = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
                    if (w) {
                      w.document.write(`
                        <html>
                          <head>
                            <title>${item.item_name} - Görsel ${imgIndex + 1}</title>
                            <style>
                              body { margin:0; background:#000; display:flex; align-items:center; justify-content:center; min-height:100vh; }
                              img { max-width:100%; max-height:100%; object-fit:contain; cursor:zoom-in; }
                            </style>
                          </head>
                          <body>
                            <img src="${url}" alt="${item.item_name}" onclick="this.style.cursor='zoom-out'; this.style.maxWidth=this.style.maxWidth==='none'?'100%':'none'" />
                          </body>
                        </html>
                      `)
                      w.document.close()
                    }
                  }
                }}
                title="Büyütmek için tıklayın"
              >
                <img
                  src={url}
                  alt={`${item.item_name} ${imgIndex + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.parentElement!.innerHTML = `
                      <div class="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                        <span class="text-xs">Resim yüklenemedi</span>
                      </div>
                    `
                  }}
                />
              </div>
            ))}
            {item.image_urls.length > 6 && (
              <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                <span className="text-xs text-gray-500 font-medium">+{item.image_urls.length - 6}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gönderim İşlemleri */}
      {!shouldShowTrackingSystem() && (
        <div className="p-3 sm:p-4">
          {!isShipped && remainingQuantity > 0 && !(itemShipments?.shipments?.some(s => s.shipped_quantity === 0)) && !isReturnReorderStatus() ? (
            <div className="space-y-3 sm:space-y-4">
              <h6 className="text-xs sm:text-sm font-medium text-gray-700">Gönderim İşlemleri</h6>
              
              {/* Stok Bilgisi - Warehouse Manager için */}
              {productStock && productStock.warehouses && productStock.warehouses.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-900">Depo Stok Durumu</span>
                        <span className={`text-sm font-bold ${productStock.totalAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Toplam: {productStock.totalAvailable} {item.unit || 'adet'}
                        </span>
                      </div>
                      
                      {/* Her Depo İçin Ayrı Satır */}
                      <div className="space-y-1">
                        {productStock.warehouses.map((warehouse, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-white rounded-lg px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span className="text-gray-700 font-medium">{warehouse.name}</span>
                            </div>
                            <span className={`font-semibold ${warehouse.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {warehouse.quantity} {item.unit || 'adet'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1.5 sm:mb-2">
                    Gönderilecek Miktar (Max: {item.quantity} {item.unit})
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={item.quantity}
                      value={sendQuantities[item.id] || ''}
                      onChange={(e) => setSendQuantities(prev => ({
                        ...prev,
                        [item.id]: e.target.value
                      }))}
                      onWheel={(e) => e.preventDefault()}
                      placeholder="Miktar girin"
                      className="h-9 sm:h-10 rounded-2xl sm:rounded-3xl bg-white text-sm"
                    />
                    <div className="flex items-center px-2 sm:px-3 bg-gray-50 rounded-2xl sm:rounded-3xl border">
                      <span className="text-xs sm:text-sm text-gray-600">{item.unit}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={async () => {
                      const quantity = sendQuantities[item.id]
                      if (!quantity?.trim() || parseFloat(quantity) <= 0) {
                        showToast('Geçerli bir miktar girin.', 'error')
                        return
                      }
                      
                      if (parseFloat(quantity) > item.quantity) {
                        showToast(`Maksimum ${item.quantity} ${item.unit} gönderebilirsiniz.`, 'error')
                        return
                      }
                      
                      if (sendingItem) return
                      
                      setSendingItem(true)
                      try {
                        await handleSingleItemSend(item, parseFloat(quantity))
                        setSendQuantities(prev => ({
                          ...prev,
                          [item.id]: ''
                        }))
                      } finally {
                        setSendingItem(false)
                      }
                    }}
                    disabled={!sendQuantities[item.id]?.trim() || parseFloat(sendQuantities[item.id] || '0') <= 0 || sendingItem}
                    className="h-9 sm:h-10 px-3 sm:px-4 bg-green-600 rounded-2xl sm:rounded-3xl hover:bg-green-700 text-white text-xs sm:text-sm flex-1 sm:flex-none"
                  >
                    {sendingItem ? (
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1.5 sm:mr-2"></div>
                    ) : (
                      <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    )}
                    Gönder
                  </Button>
                  <Button
                    onClick={() => handleSingleItemDepotNotAvailable(item)}
                    variant="outline"
                    disabled={processingDepotStatus[item.id]}
                    className="h-9 sm:h-10 px-3 sm:px-4 border-red-200 rounded-2xl sm:rounded-3xl text-red-700 hover:bg-red-50 text-xs sm:text-sm flex-1 sm:flex-none"
                  >
                    {processingDepotStatus[item.id] ? (
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-red-700 mr-1.5 sm:mr-2"></div>
                    ) : (
                      <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    )}
                    {processingDepotStatus[item.id] ? 'İşleniyor...' : 'Depoda Yok'}
                  </Button>
                </div>
              </div>
            </div>
          ) : isReturnReorderStatus() ? (
            <div className="bg-purple-50 rounded-3xl p-4 border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <RotateCcw className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h6 className="text-sm font-medium text-purple-800">İade Nedeniyle Yeniden Sipariş</h6>
                  <p className="text-xs text-purple-600 mt-1">
                    Bu talep iade nedeniyle oluşturulmuştur. Gönderim işlemleri devre dışıdır.
                  </p>
                </div>
              </div>
            </div>
          ) : !isShipped && (itemShipments?.shipments?.some(s => s.shipped_quantity === 0)) ? (
            <div className="bg-red-50 rounded-3xl p-4 border border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <X className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <h6 className="text-sm font-medium text-red-800">Depoda Mevcut Değil</h6>
                  <p className="text-xs text-red-600 mt-1">
                    Bu malzeme depoda bulunmuyor ve gönderim yapılamıyor.
                  </p>
                </div>
              </div>
            </div>
          ) : isShipped ? (
            <div className="bg-green-50 rounded-3xl p-4 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h6 className="text-sm font-medium text-green-800">Gönderim Tamamlandı</h6>
                  {itemShipments && itemShipments.shipments.length > 0 && (
                    <p className="text-xs text-green-700 mt-1">
                      Gönderim: {new Date(itemShipments.shipments[0].shipped_at).toLocaleDateString('tr-TR')}
                      {itemShipments.shipments[0].profiles?.full_name && (
                        <span className="ml-2">• {itemShipments.shipments[0].profiles.full_name}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
