'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Package, CheckCircle, X, Truck, Clock, Check, Edit, Trash2 } from 'lucide-react'
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
  onOrderDeliveryConfirmation?: (order: any, materialItem: any) => void  // Kademeli teslim alma fonksiyonu
  hideTopDeliveryButtons?: boolean  // Sağ üstteki teslim alma butonlarını gizle
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
  hideTopDeliveryButtons = false
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

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Malzeme Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              {totalItems > 1 && (
                <div className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
              )}
              <h5 className="text-xl font-semibold text-gray-900">{item.item_name}</h5>
            </div>
            
            {/* Malzeme Detayları */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {item.brand && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[80px]">Marka:</span>
                  <span className="font-medium text-gray-900">{item.brand}</span>
                </div>
              )}
              
              {item.purpose && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[80px]">Amaç:</span>
                  <span className="font-medium text-gray-900">{item.purpose}</span>
                </div>
              )}
              
              {item.delivery_date && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[80px]">Gerekli:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(item.delivery_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              )}
            </div>
            
            {item.specifications && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{item.specifications}</span>
              </div>
            )}
          </div>
          
          {/* Düzenle ve Kaldır Butonları */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1">
              {/* Düzenle Butonu - sadece düzenleme yetkisi varsa göster */}
              {canEditRequest && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/requests/${request.id}/edit`)}
                  className="h-8 px-3 bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300 flex items-center gap-1"
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
                  className="h-8 px-3 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300 flex items-center gap-1"
                  title="Malzemeyi Kaldır"
                >
                  <Trash2 className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600">Kaldır</span>
                </Button>
              )}
            </div>
            
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

            {shouldShowTrackingSystem() && hideTopDeliveryButtons && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border border-blue-200">
                📋 Malzeme Detayları
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tedarikçi Bilgileri - Temiz ve düzenli tasarım */}
      {shouldShowTrackingSystem() && (
        <div className="p-4 border-b border-gray-100">
          {(() => {
            const itemOrders = materialOrders.filter((order: any) => 
              order.material_item_id === item.id
            )
            
            if (itemOrders.length === 0) {
              return (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-500">Bu malzeme için henüz sipariş verilmemiş</div>
                </div>
              )
            }

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
                  totalCount: 0
                }
              }
              
              groups[supplierId].orders.push(order)
              groups[supplierId].totalQuantity += order.quantity || 0
              groups[supplierId].totalCount += 1
              
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
              group.remainingQuantity = group.totalQuantity - group.totalDelivered
            })
            
            const suppliers = Object.values(supplierGroups)
            
            return (
              <div className="space-y-3">
                <h6 className="text-sm font-medium text-gray-700">Sipariş Bilgileri</h6>
                <div className={`grid gap-3 ${
                  suppliers.length === 1 
                    ? 'grid-cols-1' 
                    : suppliers.length === 2 
                      ? 'grid-cols-1 lg:grid-cols-2' 
                      : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                }`}>
                  {suppliers.map((supplier: any, index: number) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{supplier.name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>Sipariş: {supplier.totalQuantity.toFixed(2)} {item.unit}</div>
                              <div className="text-green-600">Teslim: {supplier.totalDelivered.toFixed(2)} {item.unit}</div>
                              <div className="text-blue-600">Kalan: {supplier.remainingQuantity.toFixed(2)} {item.unit}</div>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 shrink-0">
                          {supplier.remainingQuantity <= 0 ? (
                            <Badge className="bg-green-100 text-green-700">
                              Tamamı Teslim Alındı
                            </Badge>
                          ) : supplier.totalDelivered > 0 ? (
                            <Badge className="bg-orange-100 text-orange-700">
                              Kısmen Teslim Alındı
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700">
                              Sipariş Verildi
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* İletişim Bilgileri */}
                      <div className="space-y-2 text-sm">
                        {supplier.supplier?.contact_person && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 min-w-[60px]">İletişim:</span>
                            <span className="text-gray-900 truncate">{supplier.supplier.contact_person}</span>
                          </div>
                        )}
                        {supplier.supplier?.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 min-w-[60px]">Telefon:</span>
                            <span className="text-gray-900">{supplier.supplier.phone}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Kademeli Teslim Alma Butonları - Santiye Depo için */}
                      {onOrderDeliveryConfirmation && supplier.orders && supplier.orders.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-600 mb-2">Siparişler:</div>
                          <div className="space-y-2">
                            {supplier.orders.map((order: any) => {
                              const hasDeliveries = order.total_delivered > 0
                              const isCompleted = order.remaining_quantity <= 0
                              const canDeliver = !isCompleted && order.quantity > 0
                              const orderStatus = order.status || 'pending'
                              
                              return (
                                <div key={order.id} className="bg-white rounded-lg p-2 border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="text-xs text-gray-600">
                                        Sipariş: {order.quantity} {item.unit}
                                      </div>
                                      {hasDeliveries && (
                                        <div className="text-xs text-green-600">
                                          Teslim: {order.total_delivered || 0} {item.unit}
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-500 mt-1">
                                        Durum: {
                                          orderStatus === 'delivered' ? 'Teslim Alındı' :
                                          orderStatus === 'partially_delivered' ? 'Kısmen Teslim Alındı' :
                                          orderStatus === 'pending' ? 'Bekliyor' :
                                          orderStatus
                                        }
                                      </div>
                                    </div>
                                    {canDeliver && (
                                      <Button
                                        size="sm"
                                        onClick={() => onOrderDeliveryConfirmation(order, item)}
                                        className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white text-xs"
                                      >
                                        Teslim Al
                                      </Button>
                                    )}
                                    {isCompleted && (
                                      <div className="text-xs text-green-600 font-medium">
                                        ✓ Tamamlandı
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Teslimat Tarihi */}
                      {(() => {
                        const nextDeliveryDate = supplier.orders
                          .map((order: any) => order.delivery_date)
                          .filter(Boolean)
                          .sort()[0]
                          
                        if (nextDeliveryDate) {
                          const deliveryDate = new Date(nextDeliveryDate)
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          deliveryDate.setHours(0, 0, 0, 0)
                          
                          const diffTime = deliveryDate.getTime() - today.getTime()
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                          
                          let statusText = ''
                          let statusColor = 'text-gray-600'
                          
                          if (diffDays < 0) {
                            statusText = `${Math.abs(diffDays)} gün geçti`
                            statusColor = 'text-red-600'
                          } else if (diffDays === 0) {
                            statusText = 'Bugün'
                            statusColor = 'text-orange-600'
                          } else if (diffDays <= 3) {
                            statusText = `${diffDays} gün kaldı`
                            statusColor = 'text-orange-600'
                          } else {
                            statusText = `${diffDays} gün kaldı`
                            statusColor = 'text-gray-600'
                          }
                          
                          return (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Teslimat:</span>
                                <div className="text-right">
                                  <div className="text-gray-900">{deliveryDate.toLocaleDateString('tr-TR')}</div>
                                  <div className={`text-xs ${statusColor}`}>{statusText}</div>
                                </div>
                              </div>
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

      {/* Detaylı takip sistemi - sade renk tasarımı */}
      {shouldShowTrackingSystem() && (
        <div className="p-4 border-b border-gray-100">
          <h6 className="text-sm font-medium text-gray-700 mb-4">Durum Takibi</h6>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* İlk Talep */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">İlk Talep</div>
              <div className="text-lg font-bold text-gray-900">
                {(() => {
                  const originalRequest = item.original_quantity ?? item.quantity
                  return `${originalRequest.toFixed(2)} ${item.unit}`
                })()}
              </div>
            </div>
            
            {/* Depodan Gönderilen */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">Depodan Gönderilen</div>
              <div className="text-lg font-bold text-green-600">
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
                    <div className="text-xs text-gray-600 mt-1">
                      {shipmentCount} gönderim
                    </div>
                  )
                }
                return <div className="text-xs text-gray-500 mt-1">-</div>
              })()}
            </div>
            
            {/* Sipariş Verildi */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">Sipariş Verildi</div>
              <div className="text-lg font-bold text-green-600">
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
                      <div className="text-xs text-gray-600 mt-1">
                        Tamamı teslim alındı
                      </div>
                    )
                  } else if (deliveredCount > 0) {
                    return (
                      <div className="text-xs text-gray-600 mt-1">
                        {deliveredCount}/{orderCount} teslim alındı
                      </div>
                    )
                  } else {
                    return (
                      <div className="text-xs text-gray-600 mt-1">
                        {orderCount} sipariş bekleniyor
                      </div>
                    )
                  }
                }
                return <div className="text-xs text-gray-500 mt-1">Sipariş yok</div>
              })()}
            </div>
            
            {/* Teslimat Tarihi */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">Teslimat</div>
              <div className="text-lg font-bold text-gray-900">
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

      {/* Miktar Bilgileri - Sadece normal depo işlemlerinde göster */}
      {!shouldShowTrackingSystem() && (
        <div className="p-4 border-b border-gray-100">
          <h6 className="text-sm font-medium text-gray-700 mb-4">Miktar Durumu</h6>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">İlk Talep</div>
              <div className="text-lg font-bold text-gray-900">{originalQuantity} {item.unit}</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">Gönderilen</div>
              <div className="text-lg font-bold text-green-600">{totalShipped.toFixed(2)} {item.unit}</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-600 mb-1">Kalan</div>
              <div className="text-lg font-bold text-red-600">
                {Math.max(0, remainingQuantity).toFixed(2)} {item.unit}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {remainingQuantity <= 0 ? 'Tamamlandı' : 'Bekliyor'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Malzeme Resimleri */}
      {item.image_urls && item.image_urls.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <h6 className="text-sm font-medium text-gray-700 mb-4">Malzeme Görselleri</h6>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {item.image_urls.slice(0, 6).map((url, imgIndex) => (
              <div 
                key={imgIndex} 
                className="aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden group cursor-pointer hover:shadow-md transition-all duration-200"
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
              <div className="aspect-square bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                <span className="text-sm text-gray-500 font-medium">
                  +{item.image_urls.length - 6}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gönderim İşlemleri */}
      {!shouldShowTrackingSystem() && (
        <div className="p-4">
          {!isShipped && remainingQuantity > 0 && !(itemShipments?.shipments?.some(s => s.shipped_quantity === 0)) ? (
            <div className="space-y-4">
              <h6 className="text-sm font-medium text-gray-700">Gönderim İşlemleri</h6>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-2">
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
                      className="h-10 bg-white"
                    />
                    <div className="flex items-center px-3 bg-gray-50 rounded-md border">
                      <span className="text-sm text-gray-600">{item.unit}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:items-end">
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
                    className="h-10 px-4 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {sendingItem ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Package className="h-4 w-4 mr-2" />
                    )}
                    Gönder
                  </Button>
                  <Button
                    onClick={() => handleSingleItemDepotNotAvailable(item)}
                    variant="outline"
                    disabled={processingDepotStatus[item.id]}
                    className="h-10 px-4 border-red-200 text-red-700 hover:bg-red-50"
                  >
                    {processingDepotStatus[item.id] ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-700 mr-2"></div>
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    {processingDepotStatus[item.id] ? 'İşleniyor...' : 'Depoda Yok'}
                  </Button>
                </div>
              </div>
            </div>
          ) : !isShipped && (itemShipments?.shipments?.some(s => s.shipped_quantity === 0)) ? (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
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
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
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
