/**
 * ProductsTable Component
 * Request table benzeri modern tablo yapısı - solda görsel, sağda bilgiler
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
}

export function ProductsTable({ products, isLoading, onProductClick }: ProductsTableProps) {
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
    <div className="space-y-3">
      {/* Header - Desktop Only */}
      <div className="hidden lg:grid grid-cols-12 gap-4 px-4 pb-3 border-b border-gray-200">
        <div className="col-span-1 flex items-center">
          <span className="text-xs font-medium text-gray-500">GÖRSEL</span>
        </div>
        <div className="col-span-3 flex items-center">
          <SortButton field="name">ÜRÜN ADI</SortButton>
        </div>
        <div className="col-span-2 flex items-center">
          <SortButton field="brand">MARKA</SortButton>
        </div>
        <div className="col-span-2 flex items-center">
          <SortButton field="sku">SKU</SortButton>
        </div>
        <div className="col-span-2 flex items-center">
          <SortButton field="stock">STOK DURUMU</SortButton>
        </div>
        <div className="col-span-2 flex items-center">
          <span className="text-xs font-medium text-gray-500">DEPOLAR</span>
        </div>
      </div>

      {/* Product Rows */}
      {sortedProducts.map((product) => {
        const stockStatus = getStockStatus(product)
        const StockIcon = stockStatus.icon
        const totalStock = product.total_stock || 0
        const primaryImage = product.images?.[0]

        return (
          <Card
            key={product.id}
            className="border-0 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer rounded-2xl overflow-hidden bg-white"
            onClick={() => onProductClick(product.id)}
          >
            <CardContent className="p-4">
              {/* Desktop Layout */}
              <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                {/* Görsel */}
                <div className="col-span-1">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-200">
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
                <div className="col-span-3">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {product.description}
                    </p>
                  )}
                </div>

                {/* Marka */}
                <div className="col-span-2">
                  {product.brand ? (
                    <Badge 
                      variant="secondary" 
                      className="bg-gray-100 text-gray-700 border-0 rounded-full px-3 py-1 text-xs"
                    >
                      <Building2 className="w-3 h-3 mr-1" />
                      {product.brand.name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>

                {/* SKU */}
                <div className="col-span-2">
                  {product.sku ? (
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-mono text-gray-600">
                        {product.sku}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>

                {/* Stok Durumu */}
                <div className="col-span-2">
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
                <div className="col-span-2">
                  {product.warehouse_stocks && product.warehouse_stocks.length > 0 ? (
                    <div className="space-y-1">
                      {product.warehouse_stocks.slice(0, 2).map((stock: any) => (
                        <div key={stock.warehouse_id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate mr-2">
                            {stock.warehouses?.name || 'Depo'}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {stock.quantity}
                          </span>
                        </div>
                      ))}
                      {product.warehouse_stocks.length > 2 && (
                        <span className="text-xs text-gray-400">
                          +{product.warehouse_stocks.length - 2} depo daha
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Depo atanmamış</span>
                  )}
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="lg:hidden flex gap-3">
                {/* Görsel */}
                <div className="flex-shrink-0">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-200">
                    {primaryImage ? (
                      <Image
                        src={primaryImage}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* İçerik */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Ürün Adı */}
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
                      {product.name}
                    </h3>
                    {product.brand && (
                      <Badge 
                        variant="secondary" 
                        className="bg-gray-100 text-gray-700 border-0 rounded-full px-2 py-0.5 text-xs"
                      >
                        {product.brand.name}
                      </Badge>
                    )}
                  </div>

                  {/* SKU ve Stok */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {product.sku && (
                      <div className="flex items-center gap-1">
                        <Hash className="w-3 h-3 text-gray-400" />
                        <span className="text-xs font-mono text-gray-600">
                          {product.sku}
                        </span>
                      </div>
                    )}
                    <Badge className={`${stockStatus.color} border rounded-full px-2 py-0.5 text-xs`}>
                      <StockIcon className="w-3 h-3 mr-1" />
                      {stockStatus.text}
                    </Badge>
                  </div>

                  {/* Toplam Stok */}
                  <div className="flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">
                      Toplam: {totalStock} {product.unit || 'adet'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
