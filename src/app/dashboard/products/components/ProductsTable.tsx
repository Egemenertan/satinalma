/**
 * ProductsTable Component
 * Request table benzeri modern tablo yapısı - solda görsel, sağda bilgiler
 */

'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Building2,
  Hash,
  Box,
  ArrowUpDown,
  Check
} from 'lucide-react'
import type { ProductWithStock } from '../types'
import Image from 'next/image'

/** Merkez / ana depo: isim eşleşmesi (öncelik sırasıyla) */
const ANA_DEPO_NAME_CANDIDATES = ['ana depo', 'sanayi depo']

function normalizeWarehouseName(name: string | null | undefined) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getWarehouseName(stock: any): string {
  const wh = Array.isArray(stock?.warehouse) ? stock.warehouse[0] : stock?.warehouse
  return wh?.name || stock?.warehouses?.name || ''
}

/** Ana depodaki (boşta) fiziksel stok miktarı */
function getBostaQty(product: ProductWithStock): number {
  const stocks = (product.warehouse_stocks || []).filter(
    (stock: any) => stock.user_id == null || stock.user_id === undefined
  )
  if (stocks.length === 0) return 0

  for (const candidate of ANA_DEPO_NAME_CANDIDATES) {
    const match = stocks.filter(
      (stock: any) => normalizeWarehouseName(getWarehouseName(stock)) === candidate
    )
    if (match.length > 0) {
      return match.reduce((sum: number, stock: any) => sum + (Number(stock.quantity) || 0), 0)
    }
  }

  return 0
}

interface ProductsTableProps {
  products: ProductWithStock[]
  isLoading: boolean
  onProductClick: (productId: string) => void
  selectedSiteId?: string
  selectedProducts?: string[]
  onSelectionChange?: (selectedIds: string[]) => void
}

export function ProductsTable({ 
  products, 
  isLoading, 
  onProductClick, 
  selectedSiteId,
  selectedProducts = [],
  onSelectionChange 
}: ProductsTableProps) {
  const [sortField, setSortField] = useState<'name' | 'sku' | 'brand' | 'stock' | 'bosta'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loading size="lg" text="Ürünler yükleniyor..." />
      </div>
    )
  }

  // Empty state
  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
          <Package className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Ürün Bulunamadı
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          Henüz hiç ürün eklenmemiş veya arama kriterlerine uygun ürün bulunmuyor.
        </p>
      </div>
    )
  }

  // Sıralama fonksiyonu
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const showCheckboxes = !!onSelectionChange
  const isWarehouseScoped = Boolean(selectedSiteId)

  const getDisplayStock = (product: ProductWithStock) => {
    if (!selectedSiteId) return product.total_stock || 0

    const stocks = (product.warehouse_stocks || []).filter(
      (stock: any) =>
        stock.warehouse_id === selectedSiteId &&
        (stock.user_id == null || stock.user_id === undefined)
    )

    if (stocks.length > 0) {
      return stocks.reduce((sum: number, stock: any) => sum + (Number(stock.quantity) || 0), 0)
    }

    return product.total_stock || 0
  }

  // Sıralanmış ürünler
  const sortedProducts = [...products].sort((a, b) => {
    let comparison = 0
    
    switch (sortField) {
      case 'name':
        comparison = (a.name || '').localeCompare(b.name || '', 'tr')
        break
      case 'sku':
        comparison = (a.sku || '').localeCompare(b.sku || '', 'tr')
        break
      case 'brand':
        comparison = (a.brand?.name || '').localeCompare(b.brand?.name || '', 'tr')
        break
      case 'stock':
        comparison = getDisplayStock(a) - getDisplayStock(b)
        break
      case 'bosta':
        comparison = getBostaQty(a) - getBostaQty(b)
        break
    }
    
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const getStockStatus = (product: ProductWithStock) => {
    const totalStock = getDisplayStock(product)
    const relevantStocks = selectedSiteId
      ? (product.warehouse_stocks || []).filter((stock: any) => stock.warehouse_id === selectedSiteId)
      : product.warehouse_stocks || []
    const hasLowStock = relevantStocks.some(
      (stock: any) => stock.min_stock_level && stock.quantity <= stock.min_stock_level
    )

    if (totalStock === 0)
      return { text: 'Stokta Yok', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertCircle }
    if (hasLowStock)
      return { text: 'Düşük Stok', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: TrendingDown }
    return { text: 'Stokta Var', color: 'bg-green-50 text-green-600 border-green-200', icon: TrendingUp }
  }

  const SortButton = ({ field, children }: { field: typeof sortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-gray-900' : 'text-gray-400'}`} />
    </button>
  )

  const handleCheckboxClick = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation()
    if (!onSelectionChange) return

    if (selectedProducts.includes(productId)) {
      onSelectionChange(selectedProducts.filter((id) => id !== productId))
    } else {
      onSelectionChange([...selectedProducts, productId])
    }
  }

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onSelectionChange) return

    if (selectedProducts.length === sortedProducts.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(sortedProducts.map((p) => p.id))
    }
  }

  const isAllSelected = sortedProducts.length > 0 && selectedProducts.length === sortedProducts.length
  const isSomeSelected = selectedProducts.length > 0 && selectedProducts.length < sortedProducts.length

  const desktopGridColumns = (() => {
    if (isWarehouseScoped) {
      return showCheckboxes ? '40px 80px 2fr 1fr 1fr 1fr' : '80px 2fr 1fr 1fr 1fr'
    }
    return showCheckboxes
      ? '40px 80px 2fr 1fr 1fr 1fr 1fr 200px'
      : '80px 2fr 1fr 1fr 1fr 1fr 200px'
  })()

  return (
    <div className="space-y-2 overflow-x-auto">
      {/* Header - Desktop Only */}
      <div
        className="hidden lg:grid gap-4 px-4 pb-3 border-b border-gray-200"
        style={{ gridTemplateColumns: desktopGridColumns }}
      >
        {/* Checkbox Header */}
        {showCheckboxes && (
          <div className="flex items-center">
            <button
              onClick={handleSelectAll}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isAllSelected
                  ? 'bg-gray-900 border-gray-900'
                  : isSomeSelected
                  ? 'bg-gray-400 border-gray-400'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {(isAllSelected || isSomeSelected) && (
                <Check className="w-3 h-3 text-white" />
              )}
            </button>
          </div>
        )}
        <div className="text-xs font-medium text-black uppercase tracking-wider">GÖRSEL</div>
        <div className="flex items-center">
          <SortButton field="name">ÜRÜN ADI</SortButton>
        </div>
        <div className="flex items-center">
          <SortButton field="brand">MARKA</SortButton>
        </div>
        <div className="flex items-center">
          <SortButton field="sku">SKU</SortButton>
        </div>
        <div className="flex items-center">
          <SortButton field="stock">{isWarehouseScoped ? 'DEPO STOĞU' : 'STOK DURUMU'}</SortButton>
        </div>
        {!isWarehouseScoped && (
          <div className="flex items-center">
            <SortButton field="bosta">BOŞTA</SortButton>
          </div>
        )}
        {!isWarehouseScoped && (
          <div className="text-xs font-medium text-black uppercase tracking-wider">DEPOLAR</div>
        )}
      </div>

      {/* Product Rows */}
      {sortedProducts.map((product) => {
        const stockStatus = getStockStatus(product)
        const StockIcon = stockStatus.icon
        const totalStock = getDisplayStock(product)
        const primaryImage = product.images?.[0]
        const isSelected = selectedProducts.includes(product.id)

        return (
          <div
            key={product.id}
            className={`bg-white rounded-3xl border border-gray-200 p-4 transition-all duration-200 cursor-pointer hover:border-gray-300 hover:shadow-md ${
              isSelected ? 'bg-primary-50 ring-2 ring-primary-500' : ''
            }`}
            onClick={() => onProductClick(product.id)}
          >
            {/* Desktop Layout */}
            <div
              className="hidden lg:grid gap-4 items-center"
              style={{ gridTemplateColumns: desktopGridColumns }}
            >
              {/* Checkbox */}
              {showCheckboxes && (
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleCheckboxClick(e, product.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-gray-900 border-gray-900'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                </div>
              )}

              {/* Görsel */}
              <div>
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-200">
                  {primaryImage ? (
                    <Image
                      src={primaryImage}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Ürün Adı */}
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gray-100 rounded-2xl">
                    <Package className="w-3 h-3 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-800 line-clamp-2">{product.name}</div>
                    {product.description && (
                      <div className="text-xs text-gray-500 line-clamp-1">{product.description}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Marka */}
              <div>
                {product.brand ? (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-2xl">
                      <Building2 className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="font-medium text-sm text-gray-800">{product.brand.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>

              {/* SKU */}
              <div>
                {product.sku ? (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-2xl">
                      <Hash className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="text-xs font-mono text-gray-600">{product.sku}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>

              {/* Stok Durumu / Depo Stoğu */}
              <div>
                <div className="space-y-2">
                  <Badge className={`${stockStatus.color} border rounded-full px-3 py-1 text-xs`}>
                    <StockIcon className="w-3 h-3 mr-1" />
                    {stockStatus.text}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">
                      {totalStock} {product.unit || 'adet'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Boşta — Ana Depo / Sanayi Depo stoğu (yalnızca Envanter) */}
              {!isWarehouseScoped && (
                <div>
                  {(() => {
                    const bosta = getBostaQty(product)
                    return bosta > 0 ? (
                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                        <span className="text-sm font-bold tabular-nums text-emerald-800">
                          {bosta.toLocaleString('tr-TR')}
                        </span>
                        <span className="text-[11px] text-emerald-700">{product.unit || 'adet'}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )
                  })()}
                </div>
              )}

              {/* Depolar — sadece tüm envanter görünümünde */}
              {!isWarehouseScoped && (
                <div>
                  {product.warehouse_stocks && product.warehouse_stocks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {product.warehouse_stocks.slice(0, 3).map((stock: any) => (
                        <div key={stock.warehouse_id} className="bg-primary-50 border border-primary-200 rounded-lg px-2 py-1">
                          <span className="text-xs font-medium text-primary-700">{stock.quantity}</span>
                          <span className="text-[10px] text-primary-500 ml-1">
                            {getWarehouseName(stock).slice(0, 8) || 'Depo'}
                          </span>
                        </div>
                      ))}
                      {product.warehouse_stocks.length > 3 && (
                        <div className="bg-gray-100 rounded-lg px-2 py-1">
                          <span className="text-xs text-gray-500">+{product.warehouse_stocks.length - 3}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Stok yok</span>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden space-y-3">
              {/* Header Row - Product & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Checkbox - Mobile */}
                  {showCheckboxes && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleCheckboxClick(e, product.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-gray-900 border-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </button>
                    </div>
                  )}
                  {/* Görsel */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-200 flex-shrink-0">
                    {primaryImage ? (
                      <Image
                        src={primaryImage}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-normal text-gray-800 line-clamp-2">{product.name}</div>
                    {product.brand && (
                      <div className="text-sm text-gray-600">{product.brand.name}</div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Badge className={`${stockStatus.color} border rounded-full px-2 py-0.5 text-xs`}>
                    <StockIcon className="w-3 h-3 mr-1" />
                    {stockStatus.text}
                  </Badge>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* SKU */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">SKU</div>
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-gray-100 rounded-lg">
                      <Hash className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-800 text-xs">
                      {product.sku || '-'}
                    </span>
                  </div>
                </div>

                {/* Stok */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {isWarehouseScoped ? 'Depo Stoğu' : 'Toplam Stok'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-gray-100 rounded-lg">
                      <Box className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-800 text-xs">
                      {totalStock} {product.unit || 'adet'}
                    </span>
                  </div>
                </div>

                {!isWarehouseScoped && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Boşta</div>
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-emerald-50 rounded-lg border border-emerald-100">
                        <Box className="w-3 h-3 text-emerald-700" />
                      </div>
                      <span className="font-medium text-gray-800 text-xs">
                        {(() => {
                          const bosta = getBostaQty(product)
                          return bosta > 0
                            ? `${bosta.toLocaleString('tr-TR')} ${product.unit || 'adet'}`
                            : '—'
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Depolar — sadece tüm envanter görünümünde */}
              {!isWarehouseScoped && product.warehouse_stocks && product.warehouse_stocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                  {product.warehouse_stocks.slice(0, 3).map((stock: any) => (
                    <div key={stock.warehouse_id} className="bg-primary-50 border border-primary-200 rounded-lg px-2 py-1">
                      <span className="text-xs font-medium text-primary-700">{stock.quantity}</span>
                      <span className="text-[10px] text-primary-500 ml-1">
                        {getWarehouseName(stock).slice(0, 10) || 'Depo'}
                      </span>
                    </div>
                  ))}
                  {product.warehouse_stocks.length > 3 && (
                    <div className="bg-gray-100 rounded-lg px-2 py-1">
                      <span className="text-xs text-gray-500">+{product.warehouse_stocks.length - 3}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
