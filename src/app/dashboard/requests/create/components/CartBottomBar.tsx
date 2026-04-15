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
    <div className="fixed bottom-6 left-4 right-4 z-50 lg:left-[296px] lg:right-4 flex justify-center animate-fade-in">
      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-gray-200 rounded-3xl shadow-lg">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Cart Info */}
            <button
              onClick={onViewCart}
              className="flex items-center gap-3 group"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                {/* Badge */}
                <div className="absolute -top-2 -right-2 min-w-[24px] h-[24px] px-1.5 bg-white rounded-full flex items-center justify-center shadow-md ring-2 ring-black">
                  <span className="text-xs font-bold text-black">{itemCount}</span>
                </div>
              </div>
              
              <div className="text-left">
                <p className="text-base font-semibold text-gray-900">
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
              className="h-14 px-8 rounded-2xl font-semibold bg-black hover:bg-gray-800 text-white transition-all duration-200"
            >
              <span className="hidden sm:inline">Talebi Gönder</span>
              <span className="sm:hidden">Gönder</span>
              <ArrowRight className="w-5 h-5 ml-2" />
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
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
        <Package className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Sepetiniz Boş
      </h3>
      <p className="text-sm text-gray-600 mb-6 max-w-xs">
        Henüz sepetinize ürün eklemediniz. Kategorilerden ürün seçerek başlayın.
      </p>
      {onBrowse && (
        <Button
          onClick={onBrowse}
          variant="outline"
          className="rounded-2xl border-gray-200 hover:bg-gray-50 transition-all"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Alışverişe Başla
        </Button>
      )}
    </div>
  )
}
