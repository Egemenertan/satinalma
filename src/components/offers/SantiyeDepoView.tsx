'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, CheckCircle, X } from 'lucide-react'
import { OffersPageProps, ShipmentInfo } from './types'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/lib/types'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'

interface SantiyeDepoViewProps extends Pick<OffersPageProps, 'request' | 'shipmentData' | 'onRefresh' | 'showToast'> {}

export default function SantiyeDepoView({ request, shipmentData, onRefresh, showToast }: SantiyeDepoViewProps) {
  const [sendQuantities, setSendQuantities] = useState<{[key: string]: string}>({})
  const [sendingItem, setSendingItem] = useState(false)
  const [processingDepotStatus, setProcessingDepotStatus] = useState<{[key: string]: boolean}>({})
  const supabase = createClientComponentClient<Database>()

  const handleSingleItemDepotNotAvailable = async (item: any) => {
    if (processingDepotStatus[item.id]) {
      return // Bu malzeme için zaten işlem devam ediyor
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

      // Bu malzeme için işlem kontrolü
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
      
      // İlk talep miktarı - original_quantity field'ından al
      const originalQuantity = item.original_quantity || item.quantity
      
      // 1. Eğer original_quantity field'ı varsa, quantity'yi original_quantity'ye eşitle
      // (depoda yok ama talep hala var - kalan miktar original ile aynı olmalı)
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
      } else {
        console.log(`📊 Quantity değiştirmiyor: ${item.quantity} (original_quantity yok veya zaten eşit)`)
      }

      // 2. Depoda yok şeklinde shipment kaydı oluştur (0 adet gönderim)
      console.log(`🔄 ${item.item_name} için shipment kaydı oluşturuluyor...`, {
        purchase_request_id: request.id,
        purchase_request_item_id: item.id,
        shipped_quantity: 0,
        shipped_by: user.id
      })

      const { error: shipmentError, data: newShipmentData } = await supabase
        .from('shipments')
        .insert({
          purchase_request_id: request.id,
          purchase_request_item_id: item.id,
          shipped_quantity: 0, // 0 adet gönderildi (depoda yok)
          shipped_by: user.id,
          notes: `${item.item_name} - Depoda mevcut değil (0 adet gönderildi)`
        })
        .select()

      if (shipmentError) {
        console.error(`❌ ${item.item_name} shipment error:`, {
          error: shipmentError,
          code: shipmentError.code,
          message: shipmentError.message,
          details: shipmentError.details,
          hint: shipmentError.hint
        })
        throw new Error(`${item.item_name} için gönderim kaydı oluşturulamadı: ${shipmentError.message}`)
      }

      console.log(`✅ ${item.item_name} için shipment kaydı oluşturuldu:`, newShipmentData)

      // 3. Status'u manuel olarak güncelle (tüm talep için)
      console.log('🔄 Purchase request status manuel olarak güncelleniyor...')
      
      try {
        const { data: statusResult, error: statusError } = await supabase
          .rpc('update_purchase_request_status_manual', {
            request_id: request.id
          })
        
        if (statusError) {
          console.error('❌ Status güncelleme hatası:', statusError)
        } else if (statusResult && statusResult.length > 0) {
          const result = statusResult[0]
          console.log('📊 Status başarıyla güncellendi:', {
            newStatus: result.updated_status,
            totalRequested: result.total_requested,
            totalShipped: result.total_shipped,
            totalRemaining: result.total_remaining,
            hasDepotUnavailable: result.has_depot_unavailable,
            success: result.success
          })
        }
      } catch (error) {
        console.error('❌ Status RPC call hatası:', error)
        
        // Fallback: Manuel hesaplama ve direkt database güncelleme
        try {
          console.log('🔄 Fallback: Manuel hesaplama ile status güncelleme deneniyor...')
          
          // Tüm malzemelerin durumunu analiz et
          let totalRemaining = 0
          let hasDepotUnavailable = false
          let totalShipped = 0
          
          for (const reqItem of request.purchase_request_items) {
            // Bu işlenen item için original_quantity, diğerleri için mevcut quantity
            if (reqItem.id === item.id) {
              const originalQty = item.original_quantity || item.quantity
              totalRemaining += originalQty // Bu item için original quantity (depoda yok ama talep var)
              hasDepotUnavailable = true // Bu item depoda yok olarak işaretlendi
              totalShipped += 0 // Bu item 0 adet gönderildi (depoda yok)
            } else {
              totalRemaining += reqItem.quantity || 0
              const itemShipments = shipmentData[reqItem.id]
              const shipped = itemShipments?.total_shipped || 0
              totalShipped += shipped
              // Eğer bu item'dan 0 adet gönderilmişse (depoda yok), işaretle
              if (shipped === 0 && (itemShipments?.shipments?.length || 0) > 0) {
                hasDepotUnavailable = true
              }
            }
          }
          
          console.log('📊 Fallback hesaplama:', {
            processedItem: item.item_name,
            totalRemaining,
            totalShipped,
            hasDepotUnavailable,
            itemCount: request.purchase_request_items.length
          })
          
          // Status belirleme mantığı:
          let fallbackStatus: string
          if (hasDepotUnavailable && totalShipped === 0 && totalRemaining <= 0) {
            // En az bir malzeme depoda yok ve hiçbir şey gönderilmemiş -> depoda mevcut değil
            fallbackStatus = 'depoda mevcut değil'
          } else if (hasDepotUnavailable) {
            // En az bir malzeme depoda yok ama bazı malzemeler gönderilmiş -> kısmen gönderildi (depoda mevcut değil)
            fallbackStatus = 'depoda mevcut değil'
          } else if (totalRemaining <= 0) {
            // Kalan miktar 0, normal gönderim -> gönderildi
            fallbackStatus = 'gönderildi'
          } else {
            // Henüz kalan var -> kısmen gönderildi
            fallbackStatus = 'kısmen gönderildi'
          }
          
          const { error: directUpdateError } = await supabase
            .from('purchase_requests')
            .update({ 
              status: fallbackStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.id)
          
          if (!directUpdateError) {
            console.log('✅ Fallback status güncelleme başarılı:', fallbackStatus)
          }
        } catch (fallbackError) {
          console.error('❌ Fallback status güncelleme de başarısız:', fallbackError)
        }
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

      // Temel kontroller
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

      // 1. ÖNCE Quantity'yi güncelle - bu önemli çünkü shipment'tan sonra trigger hesaplama yapar
      const newQuantity = Math.max(0, item.quantity - sentQuantity)
      
      console.log('🔄 Quantity güncelleniyor (önce):', {
        itemId: item.id,
        from: item.quantity,
        sent: sentQuantity,
        to: newQuantity
      })
      
      // Önce RPC function dene (RLS bypass)
      const { error: rpcError } = await supabase
        .rpc('update_purchase_request_item_quantity', {
          item_id: item.id,
          new_quantity: newQuantity
        })
      
      if (rpcError) {
        console.log('⚠️ RPC başarısız, direkt update deneniyor...', rpcError)
        
        // RPC başarısızsa direkt update dene
        const { error: updateError } = await supabase
          .from('purchase_request_items')
          .update({ quantity: newQuantity })
          .eq('id', item.id)
        
        if (updateError) {
          console.error('❌ Her iki yöntem de başarısız:', {
            rpcError,
            updateError
          })
          throw new Error(`Miktar güncellenemedi: ${updateError.message || rpcError.message}`)
        }
        
        console.log('✅ Direkt update başarılı')
      } else {
        console.log('✅ RPC function başarılı')
      }

      // 2. Shipment kaydı oluştur (quantity güncellemesi sonrasında)
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
        // Quantity'yi geri al
        await supabase
          .rpc('update_purchase_request_item_quantity', {
            item_id: item.id,
            new_quantity: item.quantity
          })
        throw new Error('Gönderim kaydı oluşturulamadı')
      }

      // 3. Status'u manuel olarak güncelle (trigger güvenilir değil)
      console.log('🔄 Status manuel olarak güncelleniyor...')
      
      try {
        // Doğru fonksiyon adını kullan
        const { data: statusResult, error: statusError } = await supabase
          .rpc('update_purchase_request_status_manual', {
            request_id: request.id
          })
        
        if (statusError) {
          console.error('❌ Status güncelleme hatası:', statusError)
          // Hata olsa bile devam et, en azından quantity güncellendi
        } else if (statusResult && statusResult.length > 0) {
          const result = statusResult[0]
          console.log('📊 Status başarıyla güncellendi:', {
            newStatus: result.updated_status,
            totalRequested: result.total_requested,
            totalShipped: result.total_shipped,
            totalRemaining: result.total_remaining,
            hasDepotUnavailable: result.has_depot_unavailable,
            success: result.success
          })
        }
      } catch (error) {
        console.error('❌ Status RPC call hatası:', error)
        
        // Fallback: Manuel hesaplama ve direkt database güncelleme dene
        try {
          console.log('🔄 Fallback: Manuel hesaplama ile status güncelleme deneniyor...')
          
          // Tüm malzemelerin durumunu analiz et
          let totalRemaining = 0
          let hasDepotUnavailable = false
          
          for (const reqItem of request.purchase_request_items) {
            // Gönderimden sonraki durumu hesapla
            if (reqItem.id === item.id) {
              totalRemaining += newQuantity // Bu item için yeni miktar
            } else {
              totalRemaining += reqItem.quantity || 0
            }
            
            // Depoda yok kontrolü - 0 adet gönderilmiş shipment'lar varsa
            const itemShipments = shipmentData[reqItem.id]
            if (itemShipments?.shipments?.some(s => s.shipped_quantity === 0)) {
              hasDepotUnavailable = true
            }
          }
          
          console.log('📊 Fallback hesaplama:', {
            sentQuantity,
            newQuantity,
            totalRemaining,
            hasDepotUnavailable,
            itemCount: request.purchase_request_items.length
          })
          
          // Status belirleme mantığı:
          let fallbackStatus: string
          if (hasDepotUnavailable) {
            // En az bir malzeme depoda yok -> depoda mevcut değil
            fallbackStatus = 'depoda mevcut değil'
          } else if (totalRemaining <= 0) {
            // Kalan miktar 0, normal gönderim -> gönderildi
            fallbackStatus = 'gönderildi'
          } else {
            // Henüz kalan var -> kısmen gönderildi
            fallbackStatus = 'kısmen gönderildi'
          }
          
          const { error: directUpdateError } = await supabase
            .from('purchase_requests')
            .update({ 
              status: fallbackStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', request.id)
          
          if (!directUpdateError) {
            console.log('✅ Fallback status güncelleme başarılı:', fallbackStatus)
          }
        } catch (fallbackError) {
          console.error('❌ Fallback status güncelleme de başarısız:', fallbackError)
        }
      }

      console.log('✅ Başarılı:', {
        sent: sentQuantity,
        remaining: newQuantity
      })

      showToast(
        newQuantity === 0 
          ? `${item.item_name} tamamen gönderildi!` 
          : `${sentQuantity} ${item.unit} gönderildi. Kalan: ${newQuantity} ${item.unit}`,
        'success'
      )

      // 4. Sonuçları doğrula ve cache'i temizle
      await onRefresh()
      invalidatePurchaseRequestsCache()
      
      // 5. Son kontrol: 2 saniye sonra status'u tekrar kontrol et (eğer trigger geç çalışırsa)
      setTimeout(async () => {
        try {
          console.log('🔄 Son kontrol: Status doğrulanıyor...')
          const { data: statusResult } = await supabase
            .rpc('update_purchase_request_status_manual', {
              request_id: request.id
            })
          
          if (statusResult && statusResult.length > 0) {
            const result = statusResult[0]
            console.log('📊 Son kontrol sonucu:', result.updated_status)
            // Eğer status değiştiyse cache'i yeniden temizle
            if (result.success) {
              invalidatePurchaseRequestsCache()
            }
          }
        } catch (error) {
          console.log('ℹ️ Son kontrol hatası (normal):', error)
        }
      }, 2000)

    } catch (error: any) {
      console.error('❌ Gönderim hatası:', error)
      showToast(error.message || 'Gönderim başarısız', 'error')
    }
  }

  if (!request?.purchase_request_items || request.purchase_request_items.length === 0) {
    return null
  }

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <Package className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900">Depo İşlemleri</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Talep edilen malzemeleri kontrol edin ve gönderim yapın</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {request.purchase_request_items.map((item, index) => {
            const itemShipments = shipmentData[item.id]
            const totalShipped = itemShipments?.total_shipped || 0
            const isShipped = totalShipped > 0
            
            // İlk talep miktarı - original_quantity field'ından al
            const originalQuantity = item.original_quantity || item.quantity
            
            // Kalan miktar - database'de quantity olarak tutuluyor (gönderimler yapıldıkça azalır)
            const remainingQuantity = item.quantity
            
            console.log(`📊 Santiye Depo hesaplaması (${item.item_name}):`, {
              itemId: item.id,
              itemName: item.item_name,
              original_quantity_field: item.original_quantity,
              current_quantity_field: item.quantity,
              totalShipped,
              finalOriginalQuantity: originalQuantity,
              remainingQuantity: remainingQuantity,
              calculation_method: item.original_quantity ? 'using_original_quantity_field' : 'fallback_to_current_quantity',
              // EK DEBUG - Bu değerler UI'da nasıl görünüyor?
              ui_display_original: originalQuantity,
              shipment_details: itemShipments
            })
            
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
                      <h5 className="text-lg font-semibold text-gray-900">{item.item_name}</h5>
                      {item.brand && (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                          {item.brand}
                        </Badge>
                      )}
                    </div>
                    {item.specifications && (
                      <div className="text-xs text-gray-500 mt-2 bg-white p-2 rounded">
                        Açıklama: {item.specifications}
                      </div>
                    )}
                  </div>
                  
                  {/* Durum Badge */}
                  <div>
                    {isShipped ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        ✓ Gönderildi
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        ⏳ Bekliyor
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Miktar Bilgileri ve Resimler */}
                <div className={`grid gap-3 mb-4 ${
                  item.image_urls && item.image_urls.length > 0 
                    ? 'grid-cols-12' 
                    : 'grid-cols-1'
                }`}>
                  {/* Miktar Bilgileri */}
                  <div className={`grid grid-cols-3 gap-3 ${
                    item.image_urls && item.image_urls.length > 0 
                      ? 'col-span-9' 
                      : 'col-span-1'
                  }`}>
                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                      <div className="text-xs font-medium text-blue-600 mb-1 uppercase tracking-wide">İlk Talep</div>
                      <div className="text-base font-bold text-blue-900">{originalQuantity} {item.unit}</div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                      <div className="text-xs font-medium text-green-600 mb-1 uppercase tracking-wide">Gönderilen</div>
                      <div className="text-base font-bold text-green-900">{totalShipped.toFixed(2)} {item.unit}</div>
                    </div>
                    
                    <div className={`rounded-lg p-2 border ${
                      remainingQuantity <= 0 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <div className={`text-xs font-medium mb-1 uppercase tracking-wide ${
                        remainingQuantity <= 0 ? 'text-gray-600' : 'text-orange-600'
                      }`}>
                        Kalan
                      </div>
                      <div className={`text-base font-bold ${
                        remainingQuantity <= 0 ? 'text-gray-600' : 'text-orange-900'
                      }`}>
                        {Math.max(0, remainingQuantity).toFixed(2)} {item.unit}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {remainingQuantity <= 0 ? 'Tamamlandı' : 'Bekliyor'}
                      </div>
                    </div>
                  </div>

                  {/* Malzeme Resimleri - 3 kolon */}
                  {item.image_urls && item.image_urls.length > 0 && (
                    <div className="col-span-3">
                      <div className="bg-gray-50 rounded-lg p-2 border border-gray-200 h-full">
                        <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Malzeme Görselleri</div>
                        <div className="grid grid-cols-2 gap-1">
                          {item.image_urls.slice(0, 4).map((url, imgIndex) => (
                            <div 
                              key={imgIndex} 
                              className="aspect-square bg-white rounded border border-gray-200 overflow-hidden group cursor-pointer"
                              onClick={() => {
                                // Resmi büyük görüntüle
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
                          {item.image_urls.length > 4 && (
                            <div className="aspect-square bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-500 font-medium">
                                +{item.image_urls.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gönderim İşlemleri - Sadece henüz gönderilmemişse göster */}
                {!isShipped ? (
                  <div className="space-y-3">
                    {/* Malzeme depoda var mı kontrolü - hem remaining quantity hem de depoda yok shipment kontrolü */}
                    {remainingQuantity > 0 && !(itemShipments?.shipments?.some(s => s.shipped_quantity === 0)) ? (
                      // Depoda var - normal gönderim işlemleri
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h6 className="text-sm font-medium text-gray-700 mb-3">Gönderim İşlemleri</h6>
                          <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Gönderilecek Miktar
                            </label>
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
                              onWheel={(e) => {
                                // Scroll ile sayı değişimini tamamen engelle
                                e.preventDefault()
                              }}
                              onKeyDown={(e) => {
                                // Yukarı/aşağı ok tuşları ile değişimi de engelle (isteğe bağlı)
                                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                  e.preventDefault()
                                }
                              }}
                              placeholder={`Max: ${item.quantity}`}
                              className="h-10 bg-white no-scroll-number"
                            />
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-sm font-medium text-gray-600">{item.unit}</span>
                          </div>
                          <div className="col-span-3">
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
                                
                                if (sendingItem) {
                                  return
                                }
                                
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
                              className="w-full h-10 bg-green-600 hover:bg-green-700 text-white text-xs"
                            >
                              {sendingItem ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                              ) : (
                                <Package className="h-3 w-3 mr-1" />
                              )}
                              Gönder
                            </Button>
                          </div>
                          <div className="col-span-3">
                            <Button
                              onClick={() => handleSingleItemDepotNotAvailable(item)}
                              variant="outline"
                              disabled={processingDepotStatus[item.id]}
                              className="w-full h-10 border-red-200 text-red-700 hover:bg-red-50 text-xs disabled:opacity-50"
                            >
                              {processingDepotStatus[item.id] ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-700 mr-1"></div>
                              ) : (
                                <X className="h-3 w-3 mr-1" />
                              )}
                              {processingDepotStatus[item.id] ? 'İşleniyor...' : 'Depoda Yok'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Depoda yok - bilgi mesajı
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
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
                    )}
                  </div>
                ) : (
                  /* Gönderim Tamamlandı Mesajı */
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Bu malzeme başarıyla gönderildi
                      </span>
                    </div>
                    {itemShipments && itemShipments.shipments.length > 0 && (
                      <div className="mt-2 text-xs text-green-700">
                        Gönderim tarihi: {new Date(itemShipments.shipments[0].shipped_at).toLocaleDateString('tr-TR')}
                        {itemShipments.shipments[0].profiles?.full_name && (
                          <span className="ml-2">• {itemShipments.shipments[0].profiles.full_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Genel Durum Özeti */}
        {(() => {
          const shippedCount = request.purchase_request_items.filter(item => {
            const itemShipments = shipmentData[item.id]
            return (itemShipments?.total_shipped || 0) > 0
          }).length
          
          const totalCount = request.purchase_request_items.length
          
          if (shippedCount === totalCount) {
            return (
              <div className="mt-6 p-6 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-green-900">Tüm Malzemeler Gönderildi</h4>
                    <p className="text-sm text-green-700">
                      Bu talep için tüm malzemeler başarıyla gönderilmiştir.
                    </p>
                  </div>
                </div>
              </div>
            )
          } else if (shippedCount > 0) {
            return (
              <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Package className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-yellow-800">
                      {shippedCount}/{totalCount} malzeme gönderildi
                    </h5>
                    <p className="text-xs text-yellow-600 mt-1">
                      Kalan malzemelerin gönderimini tamamlayın
                    </p>
                  </div>
                </div>
              </div>
            )
          }
          return null
        })()}
      </CardContent>
    </Card>
  )
}
