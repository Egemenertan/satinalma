'use client'

import { OrderGroup } from './OrderGroup'
import { sortGroupedOrders } from '../../utils'
import type { GroupedOrder } from '../../types'

interface OrdersTableDesktopProps {
  groupedOrders: Record<string, GroupedOrder>
  selectedOrders: Set<string>
  loadingPDFOrders: Set<string>
  onToggleOrderSelect: (orderId: string) => void
  onSelectAllInGroup: (groupOrders: any[]) => void
  onViewInvoices: (invoices: any[], index: number) => void
  onExportPDF: (order: any) => void
}

export function OrdersTableDesktop({
  groupedOrders,
  selectedOrders,
  loadingPDFOrders,
  onToggleOrderSelect,
  onSelectAllInGroup,
  onViewInvoices,
  onExportPDF,
}: OrdersTableDesktopProps) {
  const sortedGroups = sortGroupedOrders(groupedOrders)

  return (
    <div className="hidden lg:block">
      {/* Table Header */}
      <div className="grid gap-3 pb-4 text-xs font-medium text-gray-500 border-b border-gray-200" style={{gridTemplateColumns: '40px minmax(160px, 1.8fr) minmax(160px, 1.8fr) minmax(90px, 1fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(50px, 0.7fr) minmax(120px, 1.3fr)'}}>
        <div></div>
        <div>Tedarikçi</div>
        <div>Malzeme</div>
        <div>Miktar</div>
        <div>Şantiye</div>
        <div>Durum</div>
        <div>Teslimat</div>
        <div>İrsaliye</div>
        <div>İşlemler</div>
      </div>
      
      {/* Grouped Table Rows */}
      <div className="space-y-6 pt-4">
        {sortedGroups.map((group, groupIndex) => (
          <OrderGroup
            key={group.request?.id || groupIndex}
            group={group}
            selectedOrders={selectedOrders}
            loadingPDFOrders={loadingPDFOrders}
            onToggleOrderSelect={onToggleOrderSelect}
            onSelectAllInGroup={onSelectAllInGroup}
            onViewInvoices={onViewInvoices}
            onExportPDF={onExportPDF}
          />
        ))}
      </div>
    </div>
  )
}




