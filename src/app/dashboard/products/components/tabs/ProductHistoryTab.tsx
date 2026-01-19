/**
 * ProductHistoryTab Component
 * Stok hareketleri geçmişi
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, FileText, Receipt } from 'lucide-react'
import { generateStockMovementPDF } from '@/services/pdf.service'

interface ProductHistoryTabProps {
  product: any
  movementsData: any
}

export function ProductHistoryTab({ product, movementsData }: ProductHistoryTabProps) {
  if (!movementsData || movementsData.movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <History className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-500 text-lg font-medium">Henüz hareket kaydı yok</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
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
                      ? 'bg-blue-100 text-blue-700'
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
                  className="rounded-xl border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all flex-shrink-0"
                  title={`${movement.invoice_images.length} Fatura Görüntüle`}
                >
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span className="text-xs ml-1 text-blue-600 font-medium">
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
  )
}
