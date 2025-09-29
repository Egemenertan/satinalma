'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Truck, Clock, Edit } from 'lucide-react'
import { OffersPageProps } from './types'
import DeliveryConfirmationModal from '@/components/DeliveryConfirmationModal'
import { useRouter } from 'next/navigation'

interface SitePersonnelViewProps extends Pick<OffersPageProps, 'request' | 'materialSuppliers' | 'shipmentData' | 'onRefresh' | 'showToast'> {
  materialOrders: any[]
  currentOrder: any
  canEditRequest?: () => boolean  // Site Manager'dan geçirilen fonksiyon
  handleEditRequest?: () => void  // Site Manager'dan geçirilen fonksiyon
  hideDeliveryButtons?: boolean   // Site Manager için teslim alma butonlarını gizle
}

export default function SitePersonnelView({ 
  request, 
  materialSuppliers, 
  materialOrders, 
  shipmentData, 
  currentOrder,
  onRefresh, 
  showToast,
  canEditRequest: externalCanEditRequest,
  handleEditRequest: externalHandleEditRequest,
  hideDeliveryButtons = false
}: SitePersonnelViewProps) {
  const router = useRouter()
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [selectedMaterialForDelivery, setSelectedMaterialForDelivery] = useState<any>(null)

  // Site Personnel düzenleme yetkisi kontrolü (kendi kontrol fonksiyonu)
  const defaultCanEditRequest = () => {
    return request?.status === 'pending'
  }

  // Edit sayfasına yönlendir (kendi fonksiyonu)
  const defaultHandleEditRequest = () => {
    router.push(`/dashboard/requests/${request.id}/edit`)
  }

  // Hangi edit fonksiyonlarını kullanacağını belirle
  const canEditRequest = externalCanEditRequest || defaultCanEditRequest
  const handleEditRequest = externalHandleEditRequest || defaultHandleEditRequest

  // Teslimat tarihi kontrolü
  const isDeliveryDateReached = () => {
    if (!currentOrder?.delivery_date) {
      console.log('⚠️ currentOrder.delivery_date bulunamadı')
      return false
    }
    
    const deliveryDate = new Date(currentOrder.delivery_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    deliveryDate.setHours(0, 0, 0, 0)
    
    const reached = today >= deliveryDate
    console.log('📅 Teslimat tarihi kontrolü:', {
      deliveryDate: deliveryDate.toISOString().split('T')[0],
      today: today.toISOString().split('T')[0],
      reached
    })
    
    return reached
  }

  // Teslimat onayı yapılabilir mi kontrolü
  const canConfirmDelivery = () => {
    const result = request?.status === 'sipariş verildi' &&
           (!currentOrder || currentOrder.status !== 'delivered')
    
    console.log('🔍 Teslim alındı butonu kontrolü:', {
      hasCurrentOrder: !!currentOrder,
      currentOrderStatus: currentOrder?.status,
      orderDeliveryDate: currentOrder?.delivery_date,
      isDeliveryDateReached: isDeliveryDateReached(),
      requestStatus: request?.status,
      canConfirm: result
    })
    
    return result
  }

  // Malzeme bazında teslimat kontrolleri
  const getMaterialDeliveryStatus = (item: any) => {
    // Bu malzeme için siparişleri al
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

  // Malzeme teslimat onayı fonksiyonu
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

  // Teslimat onayı başarılı olduğunda
  const handleDeliverySuccess = () => {
    onRefresh()
  }

  if (!request?.purchase_request_items || request.purchase_request_items.length === 0) {
    return null
  }

  return (
    <>
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Malzeme Takip Sistemi
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Her malzeme için talep, gönderim ve kalan miktar durumu
                </p>
              </div>
            </div>
            
            {/* Site Personnel Edit Butonu */}
            {canEditRequest() && (
              <Button
                onClick={handleEditRequest}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Edit className="h-4 w-4" />
                Talebi Düzenle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {request.purchase_request_items.map((item, index) => {
              const materialSupplier = materialSuppliers[item.id] || { isRegistered: false, suppliers: [] }
              
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  {/* Malzeme Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {request.purchase_request_items.length > 1 && (
                          <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                        )}
                        <h4 className="text-lg font-semibold text-gray-900">{item.item_name}</h4>
                      </div>
                      {item.brand && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700">Marka:</span>
                          <span className="text-sm font-medium text-gray-900">{item.brand}</span>
                        </div>
                      )}
                      
                      {/* Kullanım Amacı */}
                      {item.purpose && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700">Kullanım Amacı:</span>
                          <span className="text-sm font-medium text-gray-900">{item.purpose}</span>
                        </div>
                      )}
                      
                      {/* Gerekli Teslimat Tarihi */}
                      {item.delivery_date && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700">Gerekli Tarih:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(item.delivery_date).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      )}
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-4">
                          <span>Miktar: <strong>{item.quantity} {item.unit}</strong></span>
                          {item.specifications && (
                            <span className="text-sm text-gray-600">• {item.specifications}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Teslimat Durumu ve Buton */}
                    <div className="text-right">
                      {(() => {
                        const deliveryStatus = getMaterialDeliveryStatus(item)
                        
                        if (!deliveryStatus.hasOrders) {
                          // Sipariş yok
                          return (
                            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              Sipariş yok
                            </div>
                          )
                        }
                        
                        if (deliveryStatus.allDelivered) {
                          // Tüm siparişler teslim alındı
                          return (
                            <div className="flex items-center gap-1 text-xs font-semibold text-green-800 bg-green-50 px-3 py-2 rounded-lg border-2 border-green-300 shadow-sm">
                              <Check className="h-3 w-3" />
                              Tamamı Teslim Alındı
                            </div>
                          )
                        }
                        
                        if (deliveryStatus.someDelivered) {
                          // Kısmen teslim alındı
                          return (
                            <div className="flex flex-col gap-1 items-end">
                              <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                                <Clock className="h-3 w-3" />
                                {deliveryStatus.deliveredCount}/{deliveryStatus.totalCount} Teslim
                              </div>
                            </div>
                          )
                        }
                        
                        // Hiç teslim alınmadı
                        return (
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
                            📋 Görüntüleme
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Gönderim Durumu */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* İlk Talep */}
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-medium text-blue-600 mb-1 uppercase tracking-wide">İlk Talep</div>
                        <div className="text-lg font-bold text-blue-900">
                          {(() => {
                            const originalRequest = item.original_quantity ?? item.quantity
                            return `${originalRequest.toFixed(2)} ${item.unit}`
                          })()}
                        </div>
                      </div>
                      
                      {/* Depodan Gönderilen */}
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-medium text-green-600 mb-1 uppercase tracking-wide">Depodan Gönderilen</div>
                        <div className="text-lg font-bold text-green-900">
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
                              <div className="text-xs text-green-700 mt-1">
                                {shipmentCount} gönderim
                              </div>
                            )
                          }
                          return <div className="text-xs text-gray-500 mt-1">-</div>
                        })()}
                      </div>
                      
                      {/* Sipariş Verildi */}
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Sipariş Verildi</div>
                        <div className="text-lg font-bold text-gray-800">
                          {(() => {
                            // Orders tablosundan bu malzeme için verilen siparişlerin toplam miktarı
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
                                <div className="text-xs text-green-700 mt-1">
                                  {orderCount} sipariş teslim alındı
                                </div>
                              )
                            } else if (deliveredCount > 0) {
                              return (
                                <div className="text-xs text-gray-600 mt-1">
                                  {deliveredCount}/{orderCount} sipariş teslim alındı
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
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Teslimat Tarihi</div>
                        <div className="text-lg font-bold text-gray-800">
                          {(() => {
                            // Bu malzeme için siparişleri al
                            const itemOrders = materialOrders.filter((order: any) => 
                              order.material_item_id === item.id
                            )
                            
                            if (itemOrders.length === 0) {
                              return "Sipariş yok"
                            }
                            
                            // En yakın teslimat tarihini bul
                            const nearestDeliveryDate = itemOrders
                              .map((order: any) => order.delivery_date)
                              .filter(Boolean)
                              .sort()[0] // İlk tarih (en yakın)
                              
                            if (!nearestDeliveryDate) {
                              return "Tarih belirtilmemiş"
                            }
                            
                            const deliveryDate = new Date(nearestDeliveryDate)
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            deliveryDate.setHours(0, 0, 0, 0)
                            
                            const formattedDate = deliveryDate.toLocaleDateString('tr-TR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })
                            
                            return formattedDate
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
                              <div className="text-xs text-red-600 mt-1">
                                {Math.abs(diffDays)} gün geçti
                              </div>
                            )
                          } else if (diffDays === 0) {
                            return (
                              <div className="text-xs text-orange-600 mt-1">Bugün</div>
                            )
                          } else if (diffDays <= 3) {
                            return (
                              <div className="text-xs text-orange-600 mt-1">
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

                  {/* Tedarikçi Bilgileri - Site Manager için */}
                  {(request?.status === 'sipariş verildi' || request?.status === 'kısmen teslim alındı' || request?.status === 'teslim alındı') && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-700 mb-3">📋 Tedarikçi Bilgileri</div>
                      {(() => {
                        const itemOrders = materialOrders.filter((order: any) => 
                          order.material_item_id === item.id
                        )
                        
                        if (itemOrders.length === 0) {
                          return (
                            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm border border-gray-200">
                              Bu malzeme için henüz sipariş verilmemiş
                            </div>
                          )
                        }

                        // Tedarikçiye göre grupla
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
                              deliveredCount: 0
                            }
                          }
                          
                          groups[supplierId].orders.push(order)
                          groups[supplierId].totalQuantity += order.quantity || 0
                          
                          if (order.is_delivered) {
                            groups[supplierId].deliveredCount += 1
                          }
                          
                          // Kademeli teslim alma miktarını hesapla
                          const deliveredQuantity = order.delivered_quantity || 0
                          groups[supplierId].totalDelivered += deliveredQuantity
                          
                          return groups
                        }, {})
                        
                        const suppliers = Object.values(supplierGroups)
                        
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {suppliers.map((supplier: any, index: number) => (
                              <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 mb-1">{supplier.name}</div>
                                    <div className="text-sm text-gray-600">
                                      <div className="space-y-1">
                                        <div className="flex justify-between">
                                          <span>Sipariş:</span>
                                          <span className="font-medium">{supplier.totalQuantity.toFixed(2)} {item.unit}</span>
                                        </div>
                                        <div className="flex justify-between text-green-600">
                                          <span>Teslim:</span>
                                          <span className="font-medium">{supplier.totalDelivered.toFixed(2)} {item.unit}</span>
                                        </div>
                                        <div className="flex justify-between text-blue-600">
                                          <span>Kalan:</span>
                                          <span className="font-medium">{(supplier.totalQuantity - supplier.totalDelivered).toFixed(2)} {item.unit}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="ml-3 shrink-0">
                                    {supplier.totalDelivered >= supplier.totalQuantity ? (
                                      <div className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                        ✓ Tamamlandı
                                      </div>
                                    ) : supplier.totalDelivered > 0 ? (
                                      <div className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                        ⏳ Kısmen
                                      </div>
                                    ) : (
                                      <div className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                                        📦 Bekliyor
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* İletişim Bilgileri */}
                                {(supplier.supplier?.contact_person || supplier.supplier?.phone) && (
                                  <div className="border-t border-gray-100 pt-3 mt-3">
                                    <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">İletişim</div>
                                    <div className="space-y-1 text-sm">
                                      {supplier.supplier?.contact_person && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Kişi:</span>
                                          <span className="text-gray-900 font-medium">{supplier.supplier.contact_person}</span>
                                        </div>
                                      )}
                                      {supplier.supplier?.phone && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Telefon:</span>
                                          <span className="text-gray-900 font-medium">{supplier.supplier.phone}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Genel Bilgilendirme */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">i</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800">
                  Malzeme Akış Sistemi
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  Her malzemenin 4 aşaması: İlk Talep → Depodan Gönderilen → Sipariş Verildi → Teslimat Tarihi
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Teslimat Onayı Modalı */}
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
    </>
  )
}

