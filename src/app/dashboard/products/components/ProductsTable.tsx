/**
 * ProductsTable Component
 * Request table benzeri modern tablo yapısı - solda görsel, sağda bilgiler
 */

'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Building2,
  Hash,
  Box,
  ArrowUpDown
} from 'lucide-react'
import type { ProductWithStock } from '../types'
import Image from 'next/image'

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
  const [sortField, setSortField] = useState<'name' | 'sku' | 'brand' | 'stock'>('name')
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
        comparison = (a.total_stock || 0) - (b.total_stock || 0)
        break
    }
    
    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Stok durumu helper
  const getStockStatus = (product: ProductWithStock) => {
    const totalStock = product.total_stock || 0
    const hasLowStock = (product.warehouse_stocks || []).some(
      (stock) => stock.min_stock_level && stock.quantity <= stock.min_stock_level
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

  return (
    <div className="space-y-2 overflow-x-auto">
      {/* Header - Desktop Only */}
      <div className="hidden lg:grid gap-4 px-4 pb-3 border-b border-gray-200" style={{gridTemplateColumns: '80px 2fr 1fr 1fr 1fr 200px'}}>
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
          <SortButton field="stock">STOK DURUMU</SortButton>
        </div>
        <div className="text-xs font-medium text-black uppercase tracking-wider">DEPOLAR</div>
      </div>

      {/* Product Rows */}
      {sortedProducts.map((product) => {
        const stockStatus = getStockStatus(product)
        const StockIcon = stockStatus.icon
        const totalStock = product.total_stock || 0
        const primaryImage = product.images?.[0]
        const isSelected = selectedProducts.includes(product.id)

        return (
          <div
            key={product.id}
            className={`bg-white rounded-3xl border border-gray-200 p-4 transition-all duration-200 cursor-pointer hover:border-gray-300 hover:shadow-md ${
              isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : ''
            }`}
            onClick={() => onProductClick(product.id)}
          >
            {/* Desktop Layout */}
            <div className="hidden lg:grid gap-4 items-center" style={{gridTemplateColumns: '80px 2fr 1fr 1fr 1fr 200px'}}>
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

              {/* Stok Durumu */}
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

              {/* Depolar */}
              <div>
                {product.warehouse_stocks && product.warehouse_stocks.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {product.warehouse_stocks.slice(0, 3).map((stock: any) => (
                      <div key={stock.warehouse_id} className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                        <span className="text-xs font-medium text-blue-700">{stock.quantity}</span>
                        <span className="text-[10px] text-blue-500 ml-1">{stock.warehouses?.name?.slice(0, 8) || 'Depo'}</span>
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
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden space-y-3">
              {/* Header Row - Product & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
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

                {/* Toplam Stok */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Toplam Stok</div>
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-gray-100 rounded-lg">
                      <Box className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-800 text-xs">
                      {totalStock} {product.unit || 'adet'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Depolar */}
              {product.warehouse_stocks && product.warehouse_stocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                  {product.warehouse_stocks.slice(0, 3).map((stock: any) => (
                    <div key={stock.warehouse_id} className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                      <span className="text-xs font-medium text-blue-700">{stock.quantity}</span>
                      <span className="text-[10px] text-blue-500 ml-1">{stock.warehouses?.name?.slice(0, 10) || 'Depo'}</span>
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
