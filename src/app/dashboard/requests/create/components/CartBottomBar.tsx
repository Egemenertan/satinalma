'use client'

import { ShoppingCart, ChevronUp, ArrowRight, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CartBottomBarProps } from '../types'

export function CartBottomBar({ 
  itemCount, 
  onViewCart, 
  onCheckout,
  isVisible 
}: CartBottomBarProps) {
  if (!isVisible || itemCount === 0) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 lg:left-[296px] lg:right-4 flex justify-center">
      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl shadow-gray-900/20">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Cart Info */}
            <button
              onClick={onViewCart}
              className="flex items-center gap-3 group"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                {/* Badge */}
                <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 bg-green-500 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                  <span className="text-xs font-bold text-white">{itemCount}</span>
                </div>
              </div>
              
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">
                  {itemCount} Ürün
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1 group-hover:text-gray-700 transition-colors">
                  Sepeti Gör
                  <ChevronUp className="w-3 h-3" />
                </p>
              </div>
            </button>

            {/* Right: Checkout Button */}
            <Button
              onClick={onCheckout}
              className="h-12 px-6 rounded-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <span className="hidden sm:inline">Talebi Gönder</span>
              <span className="sm:hidden">Gönder</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface CartEmptyStateProps {
  onBrowse?: () => void
}

export function CartEmptyState({ onBrowse }: CartEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Package className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Sepetiniz Boş
      </h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Henüz sepetinize ürün eklemediniz. Kategorilerden ürün seçerek başlayın.
      </p>
      {onBrowse && (
        <Button
          onClick={onBrowse}
          variant="outline"
          className="rounded-xl border-gray-200 hover:bg-gray-50"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Alışverişe Başla
        </Button>
      )}
    </div>
  )
}
