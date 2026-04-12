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
        transition-all duration-300 text-left
        ${isInCart 
          ? 'border-green-200 ring-2 ring-green-500/20 shadow-lg shadow-green-500/10' 
          : 'border-gray-100 hover:border-gray-200 hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1'
        }
      `}
    >
      {/* Image/Icon Area */}
      <div className={`
        relative w-full aspect-square flex items-center justify-center
        transition-colors duration-300
        ${isInCart ? 'bg-green-50' : 'bg-gradient-to-br from-gray-50 to-gray-100 group-hover:from-gray-100 group-hover:to-gray-150'}
      `}>
        <div className={`
          w-16 h-16 rounded-2xl flex items-center justify-center
          transition-all duration-300
          ${isInCart 
            ? 'bg-green-500 shadow-lg shadow-green-500/30' 
            : 'bg-white shadow-md group-hover:shadow-lg group-hover:scale-110'
          }
        `}>
          <Package className={`
            w-8 h-8 transition-colors duration-300
            ${isInCart ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
          `} />
        </div>

        {/* In Cart Badge */}
        {isInCart && (
          <div className="absolute top-3 right-3">
            <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-4 h-4 text-white" />
            </div>
          </div>
        )}

        {/* Hover Overlay with Add Button */}
        <div className={`
          absolute inset-0 flex items-center justify-center
          transition-opacity duration-300
          ${isInCart ? 'bg-green-500/10' : 'bg-black/0 group-hover:bg-black/5'}
        `}>
          {!isInCart && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                <Plus className="w-6 h-6 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {/* Category Badge */}
        {item.group && (
          <Badge 
            variant="secondary" 
            className={`
              mb-2 text-xs font-medium
              ${isInCart 
                ? 'bg-green-100 text-green-700' 
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
          transition-colors duration-300
          ${isInCart ? 'text-green-900' : 'text-gray-900'}
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
          transition-all duration-300
          ${isInCart 
            ? 'bg-green-500 text-white' 
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
        overflow-hidden transition-all duration-300 text-left
        hover:border-gray-300 hover:shadow-lg hover:-translate-y-1
      "
    >
      {/* Icon Area */}
      <div className="
        relative w-full aspect-square flex items-center justify-center
        bg-gradient-to-br from-gray-50 to-gray-100 group-hover:from-gray-100 group-hover:to-gray-150
        transition-colors duration-300
      ">
        <div className="
          w-16 h-16 rounded-2xl flex items-center justify-center
          bg-white shadow-md group-hover:shadow-lg
          transition-all duration-300 group-hover:scale-110
        ">
          <Plus className="w-8 h-8 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        <h3 className="font-semibold text-sm text-gray-700 text-center mb-2">
          Yeni Malzeme Ekle
        </h3>
        <p className="text-xs text-gray-500 text-center">
          Listede yok mu? Kendin ekle
        </p>
      </div>
    </button>
  )
}
