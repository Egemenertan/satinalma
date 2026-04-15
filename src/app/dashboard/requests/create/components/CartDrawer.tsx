'use client'

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  ShoppingCart, 
  Trash2, 
  ChevronRight,
  Calendar,
  Package
} from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { CartDrawerProps, CartItem } from '../types'

interface ExtendedCartDrawerProps extends Omit<CartDrawerProps, 'onCheckout'> {
  onSubmit: () => void
  isLoading: boolean
}

export function CartDrawer({
  open,
  onOpenChange,
  items,
  onRemoveItem,
  onEditItem,
  onSubmit,
  isLoading
}: ExtendedCartDrawerProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col bg-white p-0 gap-0 rounded-3xl border border-gray-200 shadow-xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-black/5 mb-4">
              <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-semibold text-gray-900 tracking-tight">
              Sepetim
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              <span className="text-black font-semibold">{items.length}</span> ürün eklendi
            </p>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-100 mb-4">
                <Package className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sepetiniz Boş
              </h3>
              <p className="text-sm text-gray-500">
                Henüz ürün eklemediniz
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {items.map((item, index) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    onOpenChange(false)
                    setTimeout(() => onEditItem(item, index), 100)
                  }}
                  onRemove={() => onRemoveItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-0">
          <div className="w-full space-y-3">
            {items.length > 0 && (
              <>
                {/* Summary */}
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 font-medium">Toplam Ürün</span>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{items.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={onSubmit}
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-black hover:bg-gray-800 text-white active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Gönderiliyor...</span>
                    </div>
                  ) : (
                    'Talebi Gönder'
                  )}
                </Button>
              </>
            )}
            
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="w-full h-12 rounded-2xl text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
            >
              {items.length > 0 ? 'Alışverişe Devam' : 'Kapat'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CartItemCardProps {
  item: CartItem
  onEdit: () => void
  onRemove: () => void
}

function CartItemCard({ item, onEdit, onRemove }: CartItemCardProps) {
  return (
    <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 transition-all duration-200">
      {/* Main Content - Clickable */}
      <button
        type="button"
        onClick={onEdit}
        className="w-full p-4 text-left flex items-center gap-4 hover:bg-gray-100 transition-colors duration-200"
      >
        {/* Icon/Image */}
        <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {item.image_preview_urls && item.image_preview_urls.length > 0 ? (
            <img 
              src={item.image_preview_urls[0]} 
              alt={item.material_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-black/10 to-black/5 flex items-center justify-center">
              <span className="text-lg font-semibold text-black">
                {item.material_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-base text-gray-900 line-clamp-1 mb-1">
            {item.material_name}
          </h4>
          
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-black">{item.quantity} {item.unit}</span>
            {item.delivery_date && (
              <>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {format(new Date(item.delivery_date), 'd MMM', { locale: tr })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </button>

      {/* Delete Action */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>Kaldır</span>
        </button>
      </div>
    </div>
  )
}
