'use client'

import { Button } from '@/components/ui/button'
import { OrderRow } from './OrderRow'
import type { GroupedOrder, OrderData } from '../../types'

interface OrderGroupProps {
  group: GroupedOrder
  selectedOrders: Set<string>
  loadingPDFOrders: Set<string>
  onToggleOrderSelect: (orderId: string, orderData?: OrderData) => void
  onSelectAllInGroup: (groupOrders: any[]) => void
  onViewInvoices: (invoices: any[], index: number) => void
  onViewDeliveryPhotos: (photos: string[], index: number) => void
  onExportPDF: (order: any) => void
}

export function OrderGroup({
  group,
  selectedOrders,
  loadingPDFOrders,
  onToggleOrderSelect,
  onSelectAllInGroup,
  onViewInvoices,
  onViewDeliveryPhotos,
  onExportPDF,
}: OrderGroupProps) {
  const allSelected = group.orders.every(order => selectedOrders.has(order.id))

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Talep Başlığı */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-gray-900">
              Talep: {group.request?.request_number ? 
                group.request.request_number.slice(-7) : 'Bilinmiyor'}
            </div>
            <div className="text-sm text-gray-600">
              {group.request?.title || 'Başlık belirtilmemiş'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              {group.orders.length} sipariş
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectAllInGroup(group.orders)}
              className="text-xs h-7 px-2"
            >
              {allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Siparişler */}
      <div className="divide-y divide-gray-100">
        {group.orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            isSelected={selectedOrders.has(order.id)}
            onToggleSelect={(orderData) => onToggleOrderSelect(orderData.id, orderData)}
            onViewInvoices={() => onViewInvoices(order.invoices || [], 0)}
            onViewDeliveryPhotos={() => onViewDeliveryPhotos(order.delivery_image_urls || [], 0)}
            onExportPDF={() => onExportPDF(order)}
            isLoadingPDF={loadingPDFOrders.has(order.id)}
          />
        ))}
      </div>
    </div>
  )
}





