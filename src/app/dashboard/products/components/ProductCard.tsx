/**
 * ProductCard Component
 * Ürün kartı UI - marka bilgisi, stok durumu göstergesi
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react'
import type { ProductWithStock } from '../types'

interface ProductCardProps {
  product: ProductWithStock
  onClick: (productId: string) => void
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const [imageError, setImageError] = useState(false)
  
  const totalStock = product.total_stock || 0
  const hasLowStock = (product.warehouse_stocks || []).some(
    stock => stock.min_stock_level && stock.quantity <= stock.min_stock_level
  )

  // Stok durumu
  const getStockStatus = () => {
    if (totalStock === 0) return { text: 'Stokta Yok', color: 'bg-red-50 text-red-600', icon: AlertCircle }
    if (hasLowStock) return { text: 'Düşük Stok', color: 'bg-orange-50 text-orange-600', icon: TrendingDown }
    return { text: 'Stokta Var', color: 'bg-green-50 text-green-600', icon: TrendingUp }
  }

  const stockStatus = getStockStatus()
  const StockIcon = stockStatus.icon

  // İlk resim veya placeholder
  const imageUrl = imageError ? '/placeholder-product.png' : (product.images?.[0] || '/placeholder-product.png')

  return (
    <Card
      onClick={() => onClick(product.id)}
      className="bg-white rounded-3xl border-0 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group"
    >
      <CardContent className="p-5">
        {/* Product Image */}
        <div className="relative w-full aspect-square mb-4 rounded-2xl overflow-hidden bg-gray-50">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={() => setImageError(true)}
          />
          {/* Stock Badge */}
          <div className="absolute top-2 right-2">
            <Badge className={`${stockStatus.color} border-0 font-medium`}>
              <StockIcon className="w-3 h-3 mr-1" />
              {stockStatus.text}
            </Badge>
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-3">
          {/* Brand & Category */}
          <div className="flex items-center gap-2 flex-wrap">
            {product.brand && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">
                {product.brand.name}
              </Badge>
            )}
            {product.category && (
              <Badge variant="outline" className="border-gray-300 text-gray-600 text-xs">
                {product.category.name}
              </Badge>
            )}
          </div>

          {/* Product Name */}
          <h3 className="text-lg font-medium text-gray-900 line-clamp-2">
            {product.name}
          </h3>

          {/* SKU */}
          {product.sku && (
            <p className="text-sm text-gray-500">
              SKU: {product.sku}
            </p>
          )}

          {/* Price and Stock */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Birim Fiyat</p>
              <p className="text-lg font-semibold text-gray-900">
                {product.unit_price
                  ? `${Number(product.unit_price).toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ${product.currency || 'TRY'}`
                  : 'Belirtilmemiş'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Toplam Stok</p>
              <p className="text-lg font-semibold text-gray-900 flex items-center gap-1">
                <Package className="w-4 h-4" />
                {totalStock}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

