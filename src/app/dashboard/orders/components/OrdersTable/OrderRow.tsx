'use client'

import { Check, Receipt, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineLoading } from '@/components/ui/loading'
import { getCurrencySymbol } from '@/components/offers/types'
import { getOrderStatusBadgeClass, getOrderStatusText } from '../../utils'
import type { OrderData } from '../../types'

interface OrderRowProps {
  order: OrderData
  isSelected: boolean
  onToggleSelect: () => void
  onViewInvoices: () => void
  onViewDeliveryPhotos: () => void
  onExportPDF: () => void
  isLoadingPDF: boolean
}

export function OrderRow({
  order,
  isSelected,
  onToggleSelect,
  onViewInvoices,
  onViewDeliveryPhotos,
  onExportPDF,
  isLoadingPDF,
}: OrderRowProps) {
  return (
    <div 
      className={`grid gap-3 items-start py-3 px-4 text-xs cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-gray-100 border-l-4 border-gray-900' 
          : 'hover:bg-gray-50'
      }`}
      style={{gridTemplateColumns: '40px minmax(160px, 1.8fr) minmax(160px, 1.8fr) minmax(90px, 1fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(50px, 0.7fr) minmax(120px, 1.3fr)'}}
      onClick={onToggleSelect}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <div 
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-gray-900 border-gray-900'
              : 'border-gray-300 hover:border-gray-500'
          }`}
        >
          {isSelected && (
            <Check className="w-3 h-3 text-white" />
          )}
        </div>
      </div>
      
      {/* Tedarikçi */}
      <div className="min-w-0">
        <div className="font-medium text-gray-900 text-sm break-words leading-tight">
          {order.suppliers?.name || 'Tedarikçi belirtilmemiş'}
        </div>
        {order.suppliers?.contact_person && (
          <div className="text-xs text-gray-500 break-words leading-tight mt-1">{order.suppliers.contact_person}</div>
        )}
      </div>
      
      {/* Malzeme */}
      <div className="min-w-0">
        <div className="font-medium text-gray-900 text-sm break-words leading-tight">
          {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
        </div>
        {order.purchase_request_items?.brand && (
          <div className="text-xs text-gray-500 break-words leading-tight mt-1">Marka: {order.purchase_request_items.brand}</div>
        )}
        {order.is_return_reorder && (
          <div className="text-xs text-purple-600 font-medium mt-1">İade yeniden siparişi</div>
        )}
      </div>
      
      {/* Miktar */}
      <div>
        <div className="font-medium text-gray-900 text-sm">
          {order.quantity} {order.purchase_request_items?.unit || ''}
        </div>
      </div>
      
      {/* Şantiye */}
      <div className="text-gray-600 text-sm break-words leading-tight min-w-0">
        {order.purchase_requests?.site_name || order.purchase_requests?.sites?.name || 'Belirtilmemiş'}
      </div>
      
      {/* Durum */}
      <div>
        <Badge className={getOrderStatusBadgeClass(order.status, order.is_delivered)}>
          {getOrderStatusText(order.status, order.is_delivered)}
        </Badge>
      </div>
      
      {/* Teslimat */}
      <div className="text-gray-600 text-xs">
        {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
      </div>
      
      {/* İrsaliye Fotoğrafları */}
      <div className="flex items-center">
        {order.delivery_image_urls && order.delivery_image_urls.length > 0 ? (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onViewDeliveryPhotos()
              }}
              className="w-8 h-8 rounded border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 overflow-hidden bg-white"
            >
              <img
                src={order.delivery_image_urls[0]}
                alt="İrsaliye"
                className="w-full h-full object-cover"
              />
            </button>
            {order.delivery_image_urls.length > 1 && (
              <span className="text-xs text-gray-500">
                +{order.delivery_image_urls.length - 1}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>
      
      {/* İşlemler */}
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Fatura Durumu */}
        <div className="flex-1">
          {order.invoices && order.invoices.length > 0 ? (
            <button
              onClick={onViewInvoices}
              className="w-full flex items-center justify-center gap-1 px-1 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700 hover:bg-green-100 transition-colors cursor-pointer h-9"
            >
              <Receipt className="h-3 w-3" />
              <span className="font-medium text-xs">Fatura ({order.invoices.length})</span>
            </button>
          ) : isSelected ? (
            <div className="w-full flex items-center justify-center gap-1 px-1 py-1 bg-gray-100 border border-gray-300 rounded text-xs text-gray-700 h-7">
              <Receipt className="h-3 w-3" />
              <span className="font-medium text-xs">Seçili</span>
            </div>
          ) : null}
        </div>
        
        {/* PDF Export Butonu */}
        <div className="flex-1">
          <Button
            onClick={onExportPDF}
            size="sm"
            variant="outline"
            disabled={isLoadingPDF}
            className="w-full text-xs px-1 py-1 h-9 border-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingPDF ? (
              <>
                <InlineLoading className="mr-1" />
                PDF
              </>
            ) : (
              <>
                <FileText className="h-3 w-3 mr-1" />
                PDF
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}





