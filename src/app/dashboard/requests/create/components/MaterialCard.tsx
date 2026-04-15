'use client'

import { Package, Plus, Check, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MaterialCardProps } from '../types'

export function MaterialCard({ item, isInCart, onClick }: MaterialCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative w-full bg-white rounded-2xl border overflow-hidden
        transition-all duration-200 text-left
        ${isInCart 
          ? 'border-[#d6002a] ring-2 ring-[#d6002a]/20 shadow-md' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-lg hover:-translate-y-1'
        }
      `}
    >
      {/* Image/Icon Area */}
      <div className={`
        relative w-full aspect-square flex items-center justify-center
        transition-all duration-200
        ${isInCart ? 'bg-[#d6002a]/5' : 'bg-gradient-to-br from-gray-50 to-gray-100'}
      `}>
        <div className={`
          w-16 h-16 rounded-2xl flex items-center justify-center
          transition-all duration-200
          ${isInCart 
            ? 'bg-[#d6002a] shadow-md' 
            : 'bg-white shadow-md group-hover:shadow-lg group-hover:scale-110'
          }
        `}>
          <Package className={`
            w-8 h-8 transition-colors duration-200
            ${isInCart ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
          `} />
        </div>

        {/* In Cart Badge */}
        {isInCart && (
          <div className="absolute top-3 right-3 animate-scale-in">
            <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md ring-2 ring-[#d6002a]">
              <Check className="w-4 h-4 text-[#d6002a]" />
            </div>
          </div>
        )}

        {/* Hover Overlay with Add Button */}
        {!isInCart && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4">
        {/* Category Badge */}
        {item.group && (
          <Badge 
            variant="secondary" 
            className={`
              mb-2 text-xs font-medium transition-all duration-200
              ${isInCart 
                ? 'bg-[#d6002a]/10 text-[#d6002a]' 
                : 'bg-gray-100 text-gray-600'
              }
            `}
          >
            {item.group}
          </Badge>
        )}

        {/* Product Name */}
        <h3 className={`
          font-semibold text-sm leading-tight line-clamp-2 mb-2
          transition-colors duration-200
          ${isInCart ? 'text-[#d6002a]' : 'text-gray-900'}
        `}>
          {item.name}
        </h3>

        {/* Description if exists */}
        {item.description && (
          <p className="text-xs text-gray-500 line-clamp-1 mb-3">
            {item.description}
          </p>
        )}

        {/* Action Button */}
        <div className={`
          w-full py-2.5 rounded-xl text-sm font-medium
          flex items-center justify-center gap-2
          transition-all duration-200
          ${isInCart 
            ? 'bg-[#d6002a] text-white' 
            : 'bg-gray-100 text-gray-700 group-hover:bg-gray-900 group-hover:text-white'
          }
        `}>
          {isInCart ? (
            <>
              <ShoppingCart className="w-4 h-4" />
              <span>Sepette</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Sepete Ekle</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

interface NewMaterialCardProps {
  onClick: () => void
}

export function NewMaterialCard({ onClick }: NewMaterialCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group relative w-full bg-white rounded-2xl border-2 border-dashed border-gray-200
        overflow-hidden transition-all duration-200 text-left
        hover:border-gray-300 hover:shadow-lg hover:-translate-y-1
      "
    >
      {/* Icon Area */}
      <div className="
        relative w-full aspect-square flex items-center justify-center
        bg-gradient-to-br from-gray-50 to-gray-100
        transition-all duration-200
      ">
        <div className="
          w-16 h-16 rounded-2xl flex items-center justify-center
          bg-white shadow-md group-hover:shadow-lg
          transition-all duration-200 group-hover:scale-110
        ">
          <Plus className="w-8 h-8 text-gray-400 transition-colors" />
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        <h3 className="font-semibold text-sm text-gray-700 text-center mb-2 transition-colors">
          Yeni Malzeme Ekle
        </h3>
        <p className="text-xs text-gray-500 text-center">
          Listede yok mu? Kendin ekle
        </p>
      </div>
    </button>
  )
}
