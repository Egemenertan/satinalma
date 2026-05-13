/**
 * ProductHistoryTab Component
 * Stok hareketleri ve zimmet geçmişi
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, FileText, Receipt, UserCheck } from 'lucide-react'
import { generateStockMovementPDF } from '@/services/pdf.service'

interface ProductHistoryTabProps {
  product: any
  movementsData: any
  inventoryData?: any
}

export function ProductHistoryTab({ product, movementsData, inventoryData }: ProductHistoryTabProps) {
  const hasMovements = movementsData && movementsData.movements.length > 0
  const hasInventory = inventoryData && inventoryData.length > 0

  if (!hasMovements && !hasInventory) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <History className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-500 text-lg font-medium">Henüz hareket kaydı yok</p>
      </div>
    )
  }

  // Zimmet belgesi oluşturma fonksiyonu
  const generateInventoryPDF = (inventory: any) => {
    // Zimmet belgesi için PDF oluştur
    import('@/services/pdf.service').then(({ generateInventoryAssignmentPDF }) => {
      generateInventoryAssignmentPDF({
        inventory: {
          id: inventory.id,
          item_name: inventory.item_name,
          quantity: inventory.quantity,
          unit: inventory.unit,
          assigned_date: inventory.assigned_date,
          status: inventory.status,
          notes: inventory.notes,
          user: inventory.user,
          assigned_by_profile: inventory.assigned_by_profile,
        },
        productDetails: {
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          brand: product.brand,
        },
      })
    })
  }

  return (
    <div className="space-y-6">
      {/* Zimmet Kayıtları */}
      {hasInventory && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Zimmet Kayıtları</h3>
            <Badge className="bg-purple-100 text-purple-700 border-0">
              {inventoryData.length}
            </Badge>
          </div>
          
          {inventoryData.map((inventory: any) => {
            const user = Array.isArray(inventory.user) ? inventory.user[0] : inventory.user
            const assignedBy = Array.isArray(inventory.assigned_by_profile) ? inventory.assigned_by_profile[0] : inventory.assigned_by_profile
            
            return (
              <div
                key={inventory.id}
                className="bg-purple-50/50 backdrop-blur-xl rounded-3xl p-5 border border-purple-200/50 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`text-xs border-0 ${
                      inventory.status === 'active' 
                        ? 'bg-green-100 text-green-700'
                        : inventory.status === 'returned'
                        ? 'bg-slate-100 text-slate-700'
                        : inventory.status === 'lost'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {inventory.status === 'active' ? 'Aktif' : 
                       inventory.status === 'returned' ? 'İade Edildi' :
                       inventory.status === 'lost' ? 'Kayıp' : 'Hasarlı'}
                    </Badge>
                  </div>
                  
                  <p className="font-semibold text-gray-900 text-base">
                    {user?.full_name || user?.email || 'Bilinmeyen Kullanıcı'}
                  </p>
                  
                  {assignedBy && (
                    <p className="text-xs text-gray-600 mt-1">
                      Zimmet Veren: {assignedBy.full_name || assignedBy.email}
                    </p>
                  )}
                  
                  {inventory.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">
                      {inventory.notes}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-gray-400">
                      {new Date(inventory.assigned_date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {inventory.consumed_quantity > 0 && (
                      <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
                        Sarf: {inventory.consumed_quantity} {inventory.unit}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold text-purple-900">
                      {parseFloat(inventory.quantity).toLocaleString('tr-TR')}
                    </p>
                    <p className="text-sm text-purple-600 font-medium mt-1">
                      {inventory.unit || 'adet'}
                    </p>
                    {inventory.consumed_quantity > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        Kalan: {(inventory.quantity - inventory.consumed_quantity).toLocaleString('tr-TR')}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateInventoryPDF(inventory)}
                    className="rounded-xl border-purple-300 hover:bg-purple-50 hover:border-purple-400 transition-all flex-shrink-0"
                    title="Zimmet Belgesi İndir"
                  >
                    <FileText className="w-4 h-4 text-purple-600" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Stok Hareketleri */}
      {hasMovements && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Stok Hareketleri</h3>
            <Badge className="bg-gray-100 text-gray-700 border-0">
              {movementsData.movements.length}
            </Badge>
          </div>
      {movementsData.movements.map((movement: any) => (
        <div
          key={movement.id}
          className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-gray-200/50 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4"
        >
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-lg">
              {movement.movement_type.toUpperCase()}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-600 font-medium">
                {movement.warehouse?.name || '-'}
              </p>
              {movement.product_condition && (
                <Badge
                  className={`text-xs border-0 ${
                    movement.product_condition === 'yeni'
                      ? 'bg-green-100 text-green-700'
                      : movement.product_condition === 'kullanılmış'
                      ? 'bg-orange-100 text-orange-700'
                      : movement.product_condition === 'hek'
                      ? 'bg-primary-100 text-primary-800'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {movement.product_condition === 'yeni'
                    ? '🆕 Yeni'
                    : movement.product_condition === 'kullanılmış'
                    ? '♻️ Kullanılmış'
                    : movement.product_condition === 'hek'
                    ? '📦 HEK'
                    : '⚠️ Arızalı'}
                </Badge>
              )}
            </div>
            {movement.supplier_name && (
              <p className="text-xs text-gray-600 mt-1">
                📦 {movement.supplier_name}
              </p>
            )}
            {movement.serial_number && movement.movement_type === 'giriş' && (
              <p className="text-xs text-gray-700 mt-1 font-mono">
                Seri no: {movement.serial_number}
              </p>
            )}
            {movement.reason && (
              <p className="text-xs text-gray-500 mt-1 italic">
                {movement.reason}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs text-gray-400">
                {new Date(movement.created_at).toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {movement.unit_price && movement.movement_type === 'giriş' && (
                <Badge className="bg-gray-100 text-gray-700 border-0 text-xs font-semibold">
                  💰 {parseFloat(movement.unit_price).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} {movement.currency || 'TRY'}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {movement.movement_type === 'giriş' ? '+' : '-'}
                {parseFloat(movement.quantity).toLocaleString('tr-TR')}
              </p>
              <p className="text-sm text-gray-500 font-medium mt-1">
                {movement.previous_quantity?.toLocaleString('tr-TR')} →{' '}
                {movement.new_quantity?.toLocaleString('tr-TR')}
              </p>
              {movement.unit_price && movement.movement_type === 'giriş' && (
                <p className="text-xs text-gray-600 font-semibold mt-1">
                  Toplam: {(parseFloat(movement.quantity) * parseFloat(movement.unit_price)).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} {movement.currency || 'TRY'}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {movement.invoice_images && movement.invoice_images.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    movement.invoice_images?.forEach((url: string) => {
                      window.open(url, '_blank')
                    })
                  }}
                  className="rounded-xl border-primary-300 hover:bg-primary-50 hover:border-primary-400 transition-all flex-shrink-0"
                  title={`${movement.invoice_images.length} Fatura Görüntüle`}
                >
                  <Receipt className="w-4 h-4 text-primary-600" />
                  <span className="text-xs ml-1 text-primary-600 font-medium">
                    {movement.invoice_images.length}
                  </span>
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (product) {
                    generateStockMovementPDF({
                      transaction: {
                        id: movement.id,
                        quantity: movement.quantity,
                        movement_type: movement.movement_type,
                        reason: movement.reason,
                        created_at: movement.created_at,
                        supplier_name: movement.supplier_name,
                        product_condition: movement.product_condition,
                        warehouse: movement.warehouse,
                      },
                      productDetails: {
                        name: product.name,
                        sku: product.sku,
                        unit: product.unit,
                        unit_price: product.unit_price as any,
                        currency: product.currency,
                        category: product.category,
                        brand: product.brand,
                      },
                    })
                  }
                }}
                className="rounded-xl border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all flex-shrink-0"
                title="PDF İndir"
              >
                <FileText className="w-4 h-4 text-gray-600" />
              </Button>
            </div>
          </div>
        </div>
      ))}
        </div>
      )}
    </div>
  )
}
