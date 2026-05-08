/**
 * ProductInfoTab Component
 * Ürün bilgileri ve alım geçmişi gösterimi
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { TrendingUp, Receipt, Hash } from 'lucide-react'

interface ProductInfoTabProps {
  product: any
  movementsData: any
  serialNumbers?: {
    active: Array<{ serial_number: string; user?: { full_name: string } }>
    pending: Array<{ serial_number: string; user?: { full_name: string } }>
  } | null
}

export function ProductInfoTab({ product, movementsData, serialNumbers }: ProductInfoTabProps) {
  return (
    <>
      {/* Ürün Bilgi Kartları */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün Adı</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">{product.name}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">{product.sku || '-'}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kategori</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {product.category?.name || '-'}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün Tipi</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {product.product_type || '-'}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Birim</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">{product.unit || '-'}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Birim Fiyat</label>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {product.unit_price
              ? `${Number(product.unit_price).toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                })} ${product.currency || 'TRY'}`
              : '-'}
          </p>
        </div>
      </div>

      {/* Açıklama */}
      {product.description && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 block">
            Açıklama
          </label>
          <p className="text-gray-900 leading-relaxed">{product.description}</p>
        </div>
      )}

      {/* Seri Numaraları */}
      {serialNumbers && (serialNumbers.active.length > 0 || serialNumbers.pending.length > 0) && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Seri Numaraları
          </label>
          <div className="space-y-3">
            {/* Aktif Zimmetler */}
            {serialNumbers.active.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Aktif Zimmetler</p>
                <div className="grid grid-cols-2 gap-2">
                  {serialNumbers.active.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200"
                    >
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          {item.serial_number}
                        </span>
                      </div>
                      {item.user && (
                        <span className="text-xs text-gray-600">
                          👤 {item.user.full_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bekleyen Zimmetler */}
            {serialNumbers.pending.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Bekleyen Zimmetler</p>
                <div className="grid grid-cols-2 gap-2">
                  {serialNumbers.pending.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-200"
                    >
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          {item.serial_number}
                        </span>
                      </div>
                      {item.user && (
                        <span className="text-xs text-gray-600">
                          👤 {item.user.full_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alım Geçmişi */}
      {movementsData && movementsData.movements.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 shadow-sm">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Alım Geçmişi ve Fiyatlar
          </label>
          <div className="space-y-3">
            {movementsData.movements
              .filter((m: any) => m.movement_type === 'giriş' && m.unit_price)
              .map((movement: any) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-sm transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {parseFloat(movement.quantity).toLocaleString('tr-TR')} {product.unit}
                      </p>
                      {movement.product_condition && (
                        <Badge
                          className={`text-xs border-0 ${
                            movement.product_condition === 'yeni'
                              ? 'bg-primary-100 text-primary-800'
                              : movement.product_condition === 'kullanılmış'
                              ? 'bg-orange-100 text-orange-700'
                              : movement.product_condition === 'hek'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {movement.product_condition === 'yeni'
                            ? 'Yeni'
                            : movement.product_condition === 'kullanılmış'
                            ? 'Kullanılmış'
                            : movement.product_condition === 'hek'
                            ? 'HEK'
                            : 'Arızalı'}
                        </Badge>
                      )}
                    </div>
                    {movement.supplier_name && (
                      <p className="text-xs text-gray-600 mb-1">
                        📦 {movement.supplier_name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">
                        📅 {new Date(movement.created_at).toLocaleDateString('tr-TR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {movement.invoice_images && movement.invoice_images.length > 0 && (
                        <button
                          onClick={() => {
                            movement.invoice_images?.forEach((url: string) => {
                              window.open(url, '_blank')
                            })
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-md transition-all"
                          title="Faturaları Görüntüle"
                        >
                          <Receipt className="w-3 h-3" />
                          <span className="text-xs font-medium">{movement.invoice_images.length}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span className="text-xs text-gray-500">Birim:</span>
                      <span className="text-lg font-bold text-gray-900">
                        {parseFloat(movement.unit_price).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} {movement.currency || 'TRY'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-500">Toplam:</span>
                      <span className="text-base font-bold text-gray-900">
                        {(parseFloat(movement.quantity) * parseFloat(movement.unit_price)).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} {movement.currency || 'TRY'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            {movementsData.movements.filter((m: any) => m.movement_type === 'giriş' && m.unit_price).length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Henüz fiyat bilgisi olan alım kaydı yok</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
