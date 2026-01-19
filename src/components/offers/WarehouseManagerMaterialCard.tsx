'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Package, FileText, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'

interface WarehouseManagerMaterialCardProps {
  item: any
  index: number
  request: any
  shipmentData: any
  onRefresh: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  totalItems: number
  productStock?: {
    totalAvailable: number
    warehouses: Array<{
      name: string
      quantity: number
      conditionBreakdown?: {
        yeni?: number
        kullanılmış?: number
        hek?: number
        arızalı?: number
      }
    }>
  }
  onPDFExport?: () => void
}

export default function WarehouseManagerMaterialCard({ 
  item, 
  index, 
  request, 
  shipmentData, 
  onRefresh, 
  showToast,
  totalItems,
  productStock,
  onPDFExport
}: WarehouseManagerMaterialCardProps) {
  const [sendQuantity, setSendQuantity] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [selectedCondition, setSelectedCondition] = useState<'yeni' | 'kullanılmış' | 'hek'>('yeni')
  const supabase = createClient()

  const handleSend = async () => {
    try {
      const quantity = parseFloat(sendQuantity)
      
      if (!sendQuantity.trim() || quantity <= 0) {
        showToast('Geçerli bir miktar girin.', 'error')
        return
      }
      
      if (quantity > item.quantity) {
        showToast(`Maksimum ${item.quantity} ${item.unit} gönderebilirsiniz.`, 'error')
        return
      }

      setSending(true)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı bilgisi alınamadı')
      }

      // Product ID varsa stok atama işlemi yap (kullanıcıya zimmet)
      const productId = (item as any).product_id
      if (productId && productStock && request.requested_by) {
        console.log(`📦 Stok atama işlemi başlıyor... (product_id: ${productId}, miktar: ${quantity}, condition: ${selectedCondition}, user: ${request.requested_by})`)
        
        // Stok atama stratejisi: Seçilen condition'dan en çok stok olan depodan başla
        let remainingToAssign = quantity
        
        // Warehouse stock kayıtlarını çek (sadece user_id null olanlar - atanmamış stoklar)
        const { data: stockRecords, error: stockError } = await supabase
          .from('warehouse_stock')
          .select('id, warehouse_id, quantity, condition_breakdown, warehouse:sites(name)')
          .eq('product_id', productId)
          .is('user_id', null)
          .order('quantity', { ascending: false })
        
        if (stockError) {
          console.error('❌ Stok kayıtları alınamadı:', stockError)
          throw new Error('Stok bilgileri alınamadı')
        }

        if (!stockRecords || stockRecords.length === 0) {
          console.warn('⚠️ Atanmamış stok kaydı bulunamadı')
        } else {
          // Her depodan sırayla kullanıcıya ata (seçilen condition'dan)
          for (const record of stockRecords) {
            if (remainingToAssign <= 0) break
            
            const conditionBreakdown = (record.condition_breakdown as any) || {}
            const availableInCondition = parseFloat(conditionBreakdown[selectedCondition]?.toString() || '0')
            
            if (availableInCondition <= 0) continue
            
            const assignFromThisWarehouse = Math.min(remainingToAssign, availableInCondition)
            
            // Seçilen condition'dan düş
            conditionBreakdown[selectedCondition] = Math.max(0, availableInCondition - assignFromThisWarehouse)
            
            // Yeni toplam quantity'yi breakdown'dan hesapla
            const newWarehouseQuantity = Object.values(conditionBreakdown).reduce(
              (sum: number, val: any) => sum + (parseFloat(val?.toString() || '0') || 0),
              0
            )
            
            console.log(`📦 ${item.item_name} - ${selectedCondition} breakdown güncellendi:`, conditionBreakdown)
            console.log(`📦 Yeni toplam: ${newWarehouseQuantity}`)
            
            // Depo stokunu azalt
            const { error: updateError } = await supabase
              .from('warehouse_stock')
              .update({ 
                quantity: newWarehouseQuantity,
                condition_breakdown: conditionBreakdown,
                last_updated: new Date().toISOString(),
                updated_by: user.id
              })
              .eq('id', record.id)
            
            if (updateError) {
              console.error(`❌ ${(record.warehouse as any)?.name} stok güncellenemedi:`, updateError)
              throw new Error(`Stok güncellenemedi: ${updateError.message}`)
            }
            
            // Kullanıcıya atanmış stok kaydı oluştur veya güncelle (condition bilgisi ile)
            const userConditionBreakdown = {
              yeni: 0,
              kullanılmış: 0,
              hek: 0,
              arızalı: 0,
              [selectedCondition]: assignFromThisWarehouse
            }
            
            // Önce kullanıcı için bu üründen kayıt var mı kontrol et (warehouse_id null olanlar)
            const { data: existingUserStock } = await supabase
              .from('warehouse_stock')
              .select('id, quantity, condition_breakdown')
              .eq('product_id', productId)
              .eq('user_id', request.requested_by)
              .is('warehouse_id', null)
              .maybeSingle()
            
            if (existingUserStock) {
              // Mevcut kaydı güncelle
              const existingBreakdown = (existingUserStock.condition_breakdown as any) || {
                yeni: 0,
                kullanılmış: 0,
                hek: 0,
                arızalı: 0
              }
              
              const newUserBreakdown = { ...existingBreakdown }
              newUserBreakdown[selectedCondition] = (parseFloat(newUserBreakdown[selectedCondition]?.toString() || '0') || 0) + assignFromThisWarehouse
              
              const newUserTotal = Object.values(newUserBreakdown).reduce(
                (sum: number, val: any) => sum + (parseFloat(val?.toString() || '0') || 0),
                0
              )
              
              const { error: updateError } = await supabase
                .from('warehouse_stock')
                .update({
                  quantity: newUserTotal,
                  condition_breakdown: newUserBreakdown,
                  last_updated: new Date().toISOString(),
                  updated_by: user.id
                })
                .eq('id', existingUserStock.id)
              
              if (updateError) {
                console.error(`❌ Kullanıcı stoku güncellenemedi:`, updateError)
                // Rollback
                const rollbackBreakdown = { ...conditionBreakdown }
                rollbackBreakdown[selectedCondition] = availableInCondition
                const rollbackTotal = Object.values(rollbackBreakdown).reduce(
                  (sum: number, val: any) => sum + (parseFloat(val?.toString() || '0') || 0),
                  0
                )
                await supabase
                  .from('warehouse_stock')
                  .update({ 
                    quantity: rollbackTotal,
                    condition_breakdown: rollbackBreakdown
                  })
                  .eq('id', record.id)
                throw new Error(`Kullanıcı stoku güncellenemedi: ${updateError.message}`)
              }
              
              console.log(`✅ Kullanıcı stoku güncellendi: ${existingUserStock.quantity} → ${newUserTotal}`)
            } else {
              // Yeni kayıt oluştur (warehouse_id null olarak)
              const { error: assignError } = await supabase
                .from('warehouse_stock')
                .insert({
                  product_id: productId,
                  warehouse_id: null, // Kullanıcıya zimmet - depo yok
                  quantity: assignFromThisWarehouse,
                  user_id: request.requested_by,
                  condition_breakdown: userConditionBreakdown,
                  last_updated: new Date().toISOString(),
                  updated_by: user.id
                })
              
              if (assignError) {
                console.error(`❌ Kullanıcıya stok ataması yapılamadı:`, assignError)
                // Rollback - depo stokunu geri yükle
                const rollbackBreakdown = { ...conditionBreakdown }
                rollbackBreakdown[selectedCondition] = availableInCondition
                const rollbackTotal = Object.values(rollbackBreakdown).reduce(
                  (sum: number, val: any) => sum + (parseFloat(val?.toString() || '0') || 0),
                  0
                )
                await supabase
                  .from('warehouse_stock')
                  .update({ 
                    quantity: rollbackTotal,
                    condition_breakdown: rollbackBreakdown
                  })
                  .eq('id', record.id)
                throw new Error(`Stok ataması yapılamadı: ${assignError.message}`)
              }
              
              console.log(`✅ Yeni kullanıcı stok kaydı oluşturuldu`)
            }
            
            console.log(`✅ ${(record.warehouse as any)?.name}: ${availableInCondition} → ${conditionBreakdown[selectedCondition]} (${assignFromThisWarehouse} ${selectedCondition} kullanıcıya atandı)`)
            
            remainingToAssign -= assignFromThisWarehouse
          }
          
          if (remainingToAssign > 0) {
            console.warn(`⚠️ ${selectedCondition} stok yetersiz: ${remainingToAssign} ${item.unit} atanamadı`)
            showToast(`Uyarı: ${selectedCondition} stokta sadece ${quantity - remainingToAssign} ${item.unit} mevcut`, 'error')
            throw new Error(`${selectedCondition} stokta yeterli miktar yok`)
          }
          
          console.log(`✅ Toplam ${quantity} ${item.unit} ${selectedCondition} olarak kullanıcıya atandı`)
        }
      }

      const newQuantity = Math.max(0, item.quantity - quantity)
      
      // Quantity güncelle
      const { error: rpcError } = await supabase
        .rpc('update_purchase_request_item_quantity', {
          item_id: item.id,
          new_quantity: newQuantity
        })
      
      if (rpcError) {
        const { error: updateError } = await supabase
          .from('purchase_request_items')
          .update({ quantity: newQuantity })
          .eq('id', item.id)
        
        if (updateError) {
          throw new Error(`Miktar güncellenemedi: ${updateError.message}`)
        }
      }

      // Shipment kaydı oluştur
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          purchase_request_id: request.id,
          purchase_request_item_id: item.id,
          shipped_quantity: quantity,
          shipped_by: user.id,
          notes: `${item.item_name} - ${quantity} ${item.unit} gönderildi`
        })
        .select()
        .single()

      if (shipmentError) {
        // Rollback
        await supabase
          .rpc('update_purchase_request_item_quantity', {
            item_id: item.id,
            new_quantity: item.quantity
          })
        throw new Error('Gönderim kaydı oluşturulamadı')
      }

      // Zimmet kaydı oluştur - Talep eden kullanıcıya zimmet
      if (request.requested_by) {
        console.log(`📝 Zimmet kaydı oluşturuluyor... (user: ${request.requested_by}, miktar: ${quantity})`)
        
        const { error: inventoryError } = await supabase
          .from('user_inventory')
          .insert({
            user_id: request.requested_by,
            product_id: productId || null,
            item_name: item.item_name,
            quantity: quantity,
            unit: item.unit || 'adet',
            assigned_by: user.id,
            purchase_request_id: request.id,
            shipment_id: shipmentData?.id || null,
            notes: `${request.request_number} - ${item.item_name}`,
            status: 'active'
          })
        
        if (inventoryError) {
          console.error('❌ Zimmet kaydı oluşturulamadı:', inventoryError)
          // Zimmet hatası gönderimi engellemez, sadece log'lanır
        } else {
          console.log(`✅ Zimmet kaydı oluşturuldu: ${item.item_name} (${quantity} ${item.unit})`)
        }
      }

      // Status güncelle
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
          : `${quantity} ${item.unit} gönderildi. Kalan: ${newQuantity} ${item.unit}`,
        'success'
      )

      setSendQuantity('')
      await onRefresh()
      invalidatePurchaseRequestsCache()

    } catch (error: any) {
      console.error('❌ Gönderim hatası:', error)
      showToast(error.message || 'Gönderim başarısız', 'error')
    } finally {
      setSending(false)
    }
  }

  const itemShipments = shipmentData[item.id]
  const totalShipped = itemShipments?.total_shipped || 0
  const isShipped = totalShipped > 0
  const originalQuantity = item.original_quantity || item.quantity
  const remainingQuantity = item.quantity

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-white p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {totalItems > 1 && (
                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {index + 1}
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{item.item_name}</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {item.brand && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Marka:</span>
                  <span className="font-medium text-gray-900">{item.brand}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Amaç:</span>
                <span className="font-medium text-gray-900">{item.purpose}</span>
              </div>
              {item.delivery_date && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Gerekli:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(item.delivery_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              )}
            </div>

            {item.specifications && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">{item.specifications}</p>
              </div>
            )}
          </div>

          <Badge className={`${isShipped ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} flex-shrink-0`}>
            {isShipped ? '✓ Gönderildi' : '⏳ Bekliyor'}
          </Badge>
        </div>
      </div>

      {/* Miktar Bilgileri */}
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">İlk Talep</p>
            <p className="text-lg font-bold text-gray-900">{originalQuantity}</p>
            <p className="text-xs text-gray-500">{item.unit}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Gönderilen</p>
            <p className="text-lg font-bold text-green-600">{totalShipped.toFixed(2)}</p>
            <p className="text-xs text-gray-500">{item.unit}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Kalan</p>
            <p className="text-lg font-bold text-orange-600">{Math.max(0, remainingQuantity).toFixed(2)}</p>
            <p className="text-xs text-gray-500">{item.unit}</p>
          </div>
        </div>
      </div>

      {/* Stok Bilgisi */}
      {productStock && productStock.warehouses && productStock.warehouses.length > 0 ? (
        <div className="p-4 bg-white border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Depo Stok Durumu</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Toplam:</span>
                  <span className={`text-lg font-bold ${productStock.totalAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {productStock.totalAvailable}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">{item.unit || 'adet'}</span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                {productStock.warehouses.map((warehouse, idx) => {
                  const breakdown = warehouse.conditionBreakdown || {}
                  const hasBreakdown = breakdown.yeni || breakdown.kullanılmış || breakdown.hek || breakdown.arızalı
                  
                  return (
                    <div key={idx} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${warehouse.quantity > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <span className="text-sm text-gray-700 font-medium">{warehouse.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold ${warehouse.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {warehouse.quantity}
                          </span>
                          <span className="text-xs text-gray-400">{item.unit || 'adet'}</span>
                        </div>
                      </div>
                      
                      {/* Condition Breakdown */}
                      {hasBreakdown && (
                        <div className="flex items-center gap-2 mt-1 pl-3.5">
                          {breakdown.yeni > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Yeni: {breakdown.yeni}
                            </span>
                          )}
                          {breakdown.kullanılmış > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Kullanılmış: {breakdown.kullanılmış}
                            </span>
                          )}
                          {breakdown.hek > 0 && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                              HEK: {breakdown.hek}
                            </span>
                          )}
                          {breakdown.arızalı > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              Arızalı: {breakdown.arızalı}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Stok Uyarısı */}
              {productStock.totalAvailable === 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">⚠️ Bu ürün hiçbir depoda mevcut değil</p>
                </div>
              )}
              {productStock.totalAvailable > 0 && productStock.totalAvailable < item.quantity && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs text-orange-600 font-medium">
                    ⚠️ Stok yetersiz: Talep edilen {item.quantity} {item.unit}, mevcut {productStock.totalAvailable} {item.unit}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Bu malzeme için stok bilgisi bulunamadı
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ürün sistemde kayıtlı değil veya stok takibi yapılmıyor
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gönderim İşlemleri */}
      {!isShipped && remainingQuantity > 0 ? (
        <div className="p-4">
          <div className="space-y-3">
            {/* Condition Seçimi */}
            {productStock && productStock.warehouses && productStock.warehouses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ürün Durumu Seçin
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['yeni', 'kullanılmış', 'hek'] as const).map((condition) => {
                    // Bu condition'dan toplam kaç adet var hesapla
                    const totalInCondition = productStock.warehouses.reduce((sum, wh) => {
                      const breakdown = wh.conditionBreakdown || {}
                      return sum + (breakdown[condition] || 0)
                    }, 0)
                    
                    const isDisabled = totalInCondition === 0
                    const isSelected = selectedCondition === condition
                    
                    return (
                      <button
                        key={condition}
                        type="button"
                        onClick={() => !isDisabled && setSelectedCondition(condition)}
                        disabled={isDisabled}
                        className={`
                          px-3 py-2 rounded-lg text-sm font-medium transition-all
                          ${isSelected 
                            ? condition === 'yeni' 
                              ? 'bg-green-600 text-white border-2 border-green-600' 
                              : condition === 'kullanılmış'
                              ? 'bg-blue-600 text-white border-2 border-blue-600'
                              : 'bg-orange-600 text-white border-2 border-orange-600'
                            : isDisabled
                            ? 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                            : condition === 'yeni'
                            ? 'bg-green-50 text-green-700 border-2 border-green-200 hover:bg-green-100'
                            : condition === 'kullanılmış'
                            ? 'bg-blue-50 text-blue-700 border-2 border-blue-200 hover:bg-blue-100'
                            : 'bg-orange-50 text-orange-700 border-2 border-orange-200 hover:bg-orange-100'
                          }
                        `}
                      >
                        <div className="text-center">
                          <div className="capitalize">{condition}</div>
                          <div className="text-xs mt-0.5 opacity-90">
                            {totalInCondition} {item.unit || 'adet'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gönderilecek Miktar (Max: {item.quantity} {item.unit})
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={item.quantity}
                  value={sendQuantity}
                  onChange={(e) => setSendQuantity(e.target.value)}
                  onWheel={(e) => e.preventDefault()}
                  placeholder="Miktar girin"
                  className="flex-1 h-11 rounded-xl bg-white"
                />
                <div className="flex items-center px-4 bg-gray-50 rounded-xl border">
                  <span className="text-sm text-gray-600 font-medium">{item.unit}</span>
                </div>
              </div>
            </div>

            {/* Stok Kontrolü Uyarısı - Seçilen Condition İçin */}
            {productStock && parseFloat(sendQuantity || '0') > 0 && (() => {
              const totalInSelectedCondition = productStock.warehouses.reduce((sum, wh) => {
                const breakdown = wh.conditionBreakdown || {}
                return sum + (breakdown[selectedCondition] || 0)
              }, 0)
              
              const requestedQty = parseFloat(sendQuantity || '0')
              
              if (requestedQty > totalInSelectedCondition) {
                return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-xs text-red-700 font-medium">
                      ⚠️ Uyarı: Göndermek istediğiniz miktar ({sendQuantity} {item.unit}) seçili durumda ({selectedCondition}) mevcut stoktan ({totalInSelectedCondition} {item.unit}) fazla!
                    </p>
                  </div>
                )
              }
              
              if (requestedQty > productStock.totalAvailable) {
                return (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="text-xs text-orange-700 font-medium">
                      ⚠️ Uyarı: Göndermek istediğiniz miktar ({sendQuantity} {item.unit}) toplam mevcut stoktan ({productStock.totalAvailable} {item.unit}) fazla!
                    </p>
                  </div>
                )
              }
              
              return null
            })()}

            <Button
              onClick={handleSend}
              disabled={!sendQuantity.trim() || parseFloat(sendQuantity || '0') <= 0 || sending}
              className="w-full h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Gönder
                </>
              )}
            </Button>
          </div>
        </div>
      ) : isShipped ? (
        <div className="p-4 bg-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h6 className="text-sm font-semibold text-green-800">Gönderim Tamamlandı</h6>
              {itemShipments && itemShipments.shipments.length > 0 && (
                <p className="text-xs text-green-700 mt-1">
                  {new Date(itemShipments.shipments[0].shipped_at).toLocaleDateString('tr-TR')}
                  {itemShipments.shipments[0].profiles?.full_name && (
                    <span className="ml-2">• {itemShipments.shipments[0].profiles.full_name}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* PDF Export Button */}
      {onPDFExport && (
        <div className="p-4 border-t border-gray-100">
          <Button
            onClick={onPDFExport}
            variant="outline"
            className="w-full h-10 rounded-xl border-gray-300 hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            PDF İndir
          </Button>
        </div>
      )}
    </div>
  )
}
