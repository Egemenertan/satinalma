/**
 * ProductsGrid Component
 * Ürün kartları grid layout - loading ve empty states
 */

'use client'

import { ProductCard } from './ProductCard'
import { Loading } from '@/components/ui/loading'
import { Package } from 'lucide-react'
import type { ProductWithStock } from '../types'

interface ProductsGridProps {
  products: ProductWithStock[]
  isLoading: boolean
  onProductClick: (productId: string) => void
}

export function ProductsGrid({ products, isLoading, onProductClick }: ProductsGridProps) {
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

  // Grid view
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={onProductClick}
        />
      ))}
    </div>
  )
}





