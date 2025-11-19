'use client'

import { Package } from 'lucide-react'
import { OrdersTableDesktop } from './OrdersTableDesktop'
import { OrdersTableMobile } from './OrdersTableMobile'
import { Pagination } from './Pagination'
import { groupOrdersByRequest } from '../../utils'
import type { OrderData } from '../../types'

interface OrdersTableProps {
  orders: OrderData[]
  selectedOrders: Set<string>
  loadingPDFOrders: Set<string>
  currentPage: number
  totalPages: number
  totalCount: number
  isGeneratingReport: boolean
  onToggleOrderSelect: (orderId: string, orderData?: any) => void
  onSelectAllInGroup: (groupOrders: any[]) => void
  onViewInvoices: (invoices: any[], index: number) => void
  onViewDeliveryPhotos: (photos: string[], index: number) => void
  onExportPDF: (order: any) => void
  onPageChange: (page: number) => void
  onOpenMultiInvoiceModal: () => void
  onExportMultiplePDF: () => void
}

export function OrdersTable({
  orders,
  selectedOrders,
  loadingPDFOrders,
  currentPage,
  totalPages,
  totalCount,
  isGeneratingReport,
  onToggleOrderSelect,
  onSelectAllInGroup,
  onViewInvoices,
  onViewDeliveryPhotos,
  onExportPDF,
  onPageChange,
  onOpenMultiInvoiceModal,
  onExportMultiplePDF,
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sipariş Bulunamadı</h3>
        <p className="text-gray-600">
          Henüz teslim alınmış sipariş bulunmuyor.
        </p>
      </div>
    )
  }

  const groupedOrders = groupOrdersByRequest(orders)

  return (
    <>
      {/* Desktop Table */}
      <OrdersTableDesktop
        groupedOrders={groupedOrders}
        selectedOrders={selectedOrders}
        loadingPDFOrders={loadingPDFOrders}
        onToggleOrderSelect={onToggleOrderSelect}
        onSelectAllInGroup={onSelectAllInGroup}
        onViewInvoices={onViewInvoices}
        onViewDeliveryPhotos={onViewDeliveryPhotos}
        onExportPDF={onExportPDF}
      />

      {/* Mobile Table */}
      <OrdersTableMobile
        groupedOrders={groupedOrders}
        selectedOrders={selectedOrders}
        loadingPDFOrders={loadingPDFOrders}
        onToggleOrderSelect={onToggleOrderSelect}
        onSelectAllInGroup={onSelectAllInGroup}
        onViewInvoices={onViewInvoices}
        onViewDeliveryPhotos={onViewDeliveryPhotos}
        onExportPDF={onExportPDF}
        onOpenMultiInvoiceModal={onOpenMultiInvoiceModal}
        onExportMultiplePDF={onExportMultiplePDF}
        isGeneratingReport={isGeneratingReport}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={onPageChange}
      />
    </>
  )
}





