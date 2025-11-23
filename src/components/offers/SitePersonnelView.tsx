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
      <Card className="border-none bg-white rounded-3xl shadow-none">
        <CardHeader className="pb-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold text-gray-900 tracking-tight">
                Malzeme Takip
              </CardTitle>
              <p className="text-sm text-gray-500 mt-2 font-normal">
                Talep, gönderim ve teslimat durumu
              </p>
            </div>
            
            {/* Site Personnel Edit Butonu */}
            {canEditRequest() && (
              <Button
                onClick={handleEditRequest}
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm font-medium"
              >
                Düzenle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {request.purchase_request_items.map((item, index) => {
              const materialSupplier = materialSuppliers[item.id] || { isRegistered: false, suppliers: [] }
              
              return (
                <div key={item.id} className="border border-gray-200/80 rounded-2xl p-6 bg-white hover:shadow-sm transition-shadow duration-300">
                  {/* Malzeme Header */}
                  <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {request.purchase_request_items.length > 1 && (
                          <div className="w-7 h-7 bg-black text-white rounded-full flex items-center justify-center text-xs font-semibold">
                            {index + 1}
                          </div>
                        )}
                        <h4 className="text-xl font-semibold text-gray-900 tracking-tight">{item.item_name}</h4>
                      </div>
                      
                      <div className="space-y-2 ml-10">
                        {item.brand && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 w-32">Marka</span>
                            <span className="text-sm font-medium text-gray-900">{item.brand}</span>
                          </div>
                        )}
                        
                        {item.purpose && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 w-32">Kullanım Amacı</span>
                            <span className="text-sm font-medium text-gray-900">{item.purpose}</span>
                          </div>
                        )}
                        
                        {item.delivery_date && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 w-32">Gerekli Tarih</span>
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(item.delivery_date).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500 w-32">Miktar</span>
                          <span className="text-sm font-semibold text-gray-900">{item.quantity} {item.unit}</span>
                          {item.specifications && (
                            <span className="text-sm text-gray-500">• {item.specifications}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Teslimat Durumu */}
                    <div className="text-right ml-6">
                      {(() => {
                        const deliveryStatus = getMaterialDeliveryStatus(item)
                        
                        if (!deliveryStatus.hasOrders) {
                          return (
                            <div className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
                              Sipariş Yok
                            </div>
                          )
                        }
                        
                        if (deliveryStatus.allDelivered) {
                          return (
                            <div className="text-xs font-semibold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-full">
                              Teslim Alındı
                            </div>
                          )
                        }
                        
                        if (deliveryStatus.someDelivered) {
                          return (
                            <div className="text-xs font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                              {deliveryStatus.deliveredCount}/{deliveryStatus.totalCount} Teslim
                            </div>
                          )
                        }
                        
                        return (
                          <div className="text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                            Beklemede
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Gönderim Durumu - Apple Style Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* İlk Talep */}
                    <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100/50">
                      <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">İlk Talep</div>
                      <div className="text-2xl font-semibold text-gray-900 tracking-tight">
                        {(() => {
                          const originalRequest = item.original_quantity ?? item.quantity
                          return `${originalRequest.toFixed(2)}`
                        })()}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 font-medium">{item.unit}</div>
                    </div>
                    
                    {/* Depodan Gönderilen */}
                    <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100/50">
                      <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Depodan Gönderilen</div>
                      <div className="text-2xl font-semibold text-gray-900 tracking-tight">
                        {(() => {
                          const itemShipments = shipmentData[item.id]
                          const depoShipped = itemShipments?.total_shipped || 0
                          return `${depoShipped.toFixed(2)}`
                        })()}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 font-medium">
                        {(() => {
                          const itemShipments = shipmentData[item.id]
                          const shipmentCount = itemShipments?.shipments?.length || 0
                          if (shipmentCount > 0) {
                            return `${item.unit} · ${shipmentCount} gönderim`
                          }
                          return item.unit
                        })()}
                      </div>
                    </div>
                    
                    {/* Sipariş Verildi */}
                    <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100/50">
                      <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Sipariş Verildi</div>
                      <div className="text-2xl font-semibold text-gray-900 tracking-tight">
                        {(() => {
                          const totalOrdered = materialOrders
                            .filter((order: any) => order.material_item_id === item.id)
                            .reduce((sum: number, order: any) => sum + (order.quantity || 0), 0)
                          return `${totalOrdered.toFixed(2)}`
                        })()}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 font-medium">
                        {(() => {
                          const orderCount = materialOrders.filter((order: any) => 
                            order.material_item_id === item.id
                          ).length
                          const deliveredCount = materialOrders.filter((order: any) => 
                            order.material_item_id === item.id && order.is_delivered === true
                          ).length
                          
                          if (orderCount > 0) {
                            if (deliveredCount === orderCount) {
                              return `${item.unit} · Tamamlandı`
                            } else if (deliveredCount > 0) {
                              return `${item.unit} · ${deliveredCount}/${orderCount} teslim`
                            } else {
                              return `${item.unit} · ${orderCount} bekliyor`
                            }
                          }
                          return item.unit
                        })()}
                      </div>
                    </div>
                    
                    {/* Teslimat Tarihi */}
                    <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100/50">
                      <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Teslimat Tarihi</div>
                      <div className="text-base font-semibold text-gray-900 tracking-tight">
                        {(() => {
                          const itemOrders = materialOrders.filter((order: any) => 
                            order.material_item_id === item.id
                          )
                          
                          if (itemOrders.length === 0) {
                            return "—"
                          }
                          
                          const nearestDeliveryDate = itemOrders
                            .map((order: any) => order.delivery_date)
                            .filter(Boolean)
                            .sort()[0]
                            
                          if (!nearestDeliveryDate) {
                            return "Belirtilmemiş"
                          }
                          
                          const deliveryDate = new Date(nearestDeliveryDate)
                          const formattedDate = deliveryDate.toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                          
                          return formattedDate
                        })()}
                      </div>
                      <div className="text-sm text-gray-500 mt-1 font-medium">
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
                            return "—"
                          }
                          
                          const deliveryDate = new Date(nearestDeliveryDate)
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          deliveryDate.setHours(0, 0, 0, 0)
                          
                          const diffTime = deliveryDate.getTime() - today.getTime()
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                          
                          if (diffDays < 0) {
                            return `${Math.abs(diffDays)} gün geçti`
                          } else if (diffDays === 0) {
                            return "Bugün"
                          } else {
                            return `${diffDays} gün kaldı`
                          }
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Tedarikçi Bilgileri - Apple Style */}
                  {(request?.status === 'sipariş verildi' || request?.status === 'kısmen teslim alındı' || request?.status === 'teslim alındı') && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-500 mb-4 uppercase tracking-wider">Tedarikçi Bilgileri</div>
                      {(() => {
                        const itemOrders = materialOrders.filter((order: any) => 
                          order.material_item_id === item.id
                        )
                        
                        if (itemOrders.length === 0) {
                          return (
                            <div className="bg-gray-50/50 rounded-xl p-6 text-center text-gray-400 text-sm border border-gray-100/50">
                              Henüz sipariş verilmemiş
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
                          
                          const deliveredQuantity = order.delivered_quantity || 0
                          groups[supplierId].totalDelivered += deliveredQuantity
                          
                          return groups
                        }, {})
                        
                        const suppliers = Object.values(supplierGroups)
                        
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {suppliers.map((supplier: any, index: number) => (
                              <div key={index} className="bg-gray-50/50 rounded-xl p-5 border border-gray-100/50">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 text-base tracking-tight mb-3">{supplier.name}</div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">Sipariş</span>
                                        <span className="font-semibold text-gray-900">{supplier.totalQuantity.toFixed(2)} {item.unit}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">Teslim</span>
                                        <span className="font-semibold text-gray-900">{supplier.totalDelivered.toFixed(2)} {item.unit}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">Kalan</span>
                                        <span className="font-semibold text-gray-900">{(supplier.totalQuantity - supplier.totalDelivered).toFixed(2)} {item.unit}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="ml-4 shrink-0">
                                    {supplier.totalDelivered >= supplier.totalQuantity ? (
                                      <div className="text-xs font-semibold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-full">
                                        Tamamlandı
                                      </div>
                                    ) : supplier.totalDelivered > 0 ? (
                                      <div className="text-xs font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                                        Kısmen
                                      </div>
                                    ) : (
                                      <div className="text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
                                        Bekliyor
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* İletişim Bilgileri */}
                                {(supplier.supplier?.contact_person || supplier.supplier?.phone) && (
                                  <div className="border-t border-gray-200/50 pt-4 mt-4">
                                    <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">İletişim</div>
                                    <div className="space-y-2">
                                      {supplier.supplier?.contact_person && (
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-gray-500">Kişi</span>
                                          <span className="text-gray-900 font-medium">{supplier.supplier.contact_person}</span>
                                        </div>
                                      )}
                                      {supplier.supplier?.phone && (
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-gray-500">Telefon</span>
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
          
          {/* Genel Bilgilendirme - Apple Style */}
          <div className="mt-8 bg-gray-50/50 border border-gray-100/50 rounded-2xl p-6">
            <div className="flex gap-4">
              <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-semibold">i</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 tracking-tight">
                  Malzeme Akış Sistemi
                </h4>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
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

