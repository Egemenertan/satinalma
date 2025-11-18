'use client'

import { Check, Receipt, FileText, Badge as BadgeIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineLoading } from '@/components/ui/loading'
import { getCurrencySymbol } from '@/components/offers/types'
import { getOrderStatusBadgeClass, getOrderStatusText, sortGroupedOrders } from '../../utils'
import type { GroupedOrder, OrderData } from '../../types'

interface OrdersTableMobileProps {
  groupedOrders: Record<string, GroupedOrder>
  selectedOrders: Set<string>
  loadingPDFOrders: Set<string>
  onToggleOrderSelect: (orderId: string) => void
  onSelectAllInGroup: (groupOrders: any[]) => void
  onViewInvoices: (invoices: any[], index: number) => void
  onViewDeliveryPhotos: (photos: string[], index: number) => void
  onExportPDF: (order: any) => void
  onOpenMultiInvoiceModal: () => void
  onExportMultiplePDF: () => void
  isGeneratingReport: boolean
}

export function OrdersTableMobile({
  groupedOrders,
  selectedOrders,
  loadingPDFOrders,
  onToggleOrderSelect,
  onSelectAllInGroup,
  onViewInvoices,
  onViewDeliveryPhotos,
  onExportPDF,
  onOpenMultiInvoiceModal,
  onExportMultiplePDF,
  isGeneratingReport,
}: OrdersTableMobileProps) {
  const router = useRouter()
  const sortedGroups = sortGroupedOrders(groupedOrders)

  return (
    <div className="lg:hidden space-y-6">
      {sortedGroups.map((group, groupIndex) => (
        <div key={group.request?.id || groupIndex} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          {/* Talep Başlığı - Mobile */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-900 text-sm">
                  Talep: {group.request?.request_number ? 
                    group.request.request_number.slice(-6) : 'Bilinmiyor'}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {group.request?.title || 'Başlık belirtilmemiş'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                  {group.orders.length} sipariş
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectAllInGroup(group.orders)}
                    className="text-xs h-6 px-2"
                  >
                    {group.orders.every(order => selectedOrders.has(order.id)) ? 'Kaldır' : 'Tümü'}
                  </Button>
                  {group.orders.some(order => selectedOrders.has(order.id)) && (
                    <>
                      <Button
                        onClick={onOpenMultiInvoiceModal}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs h-6 px-2"
                      >
                        <Receipt className="h-3 w-3 mr-1" />
                        Fatura
                      </Button>
                      <Button
                        onClick={onExportMultiplePDF}
                        size="sm"
                        variant="outline"
                        disabled={isGeneratingReport}
                        className="text-xs h-6 px-2 border-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingReport ? (
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
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Siparişler - Mobile */}
          <div className="divide-y divide-gray-100">
            {group.orders.map((order) => (
              <div 
                key={order.id} 
                className={`p-4 space-y-3 cursor-pointer transition-colors ${
                  selectedOrders.has(order.id) 
                    ? 'bg-gray-100 border-l-4 border-gray-900' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => onToggleOrderSelect(order.id)}
              >
                {/* Checkbox - Mobile */}
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedOrders.has(order.id)
                        ? 'bg-gray-900 border-gray-900'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {selectedOrders.has(order.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {selectedOrders.has(order.id) ? 'Seçili' : 'Seç'}
                  </div>
                </div>

                {/* Tedarikçi & Durum */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">
                      {order.suppliers?.name || 'Tedarikçi belirtilmemiş'}
                    </div>
                    {order.suppliers?.contact_person && (
                      <div className="text-xs text-gray-500 mt-1">{order.suppliers.contact_person}</div>
                    )}
                  </div>
                  <Badge className={getOrderStatusBadgeClass(order.status, order.is_delivered)}>
                    {getOrderStatusText(order.status, order.is_delivered)}
                  </Badge>
                </div>

                {/* Malzeme */}
                <div className="border-t border-gray-200 pt-3">
                  <div className="text-xs text-gray-500 mb-1">Malzeme</div>
                  <div className="font-medium text-gray-900 text-sm">
                    {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
                  </div>
                  {order.purchase_request_items?.brand && (
                    <div className="text-xs text-gray-500 mt-1">Marka: {order.purchase_request_items.brand}</div>
                  )}
                  {order.is_return_reorder && (
                    <div className="text-xs text-purple-600 font-medium mt-1">İade yeniden siparişi</div>
                  )}
                </div>

                {/* Miktar & Tutar */}
                <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Miktar</div>
                    <div className="font-medium text-gray-900 text-sm">
                      {order.quantity} {order.purchase_request_items?.unit || ''}
                    </div>
                    {order.returned_quantity && order.returned_quantity > 0 && (
                      <div className="text-xs text-orange-600 mt-1">
                        İade: {order.returned_quantity} {order.purchase_request_items?.unit || ''}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Tutar</div>
                    {order.amount > 0 ? (
                      <div className="font-medium text-gray-900 text-sm">
                        {getCurrencySymbol(order.currency)}
                        {order.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Belirtilmemiş</span>
                    )}
                  </div>
                </div>

                {/* Şantiye */}
                <div className="border-t border-gray-200 pt-3">
                  <div className="text-xs text-gray-500 mb-1">Şantiye</div>
                  <div className="text-sm text-gray-900">
                    {order.purchase_requests?.site_name || order.purchase_requests?.sites?.name || 'Belirtilmemiş'}
                  </div>
                </div>

                {/* Teslimat Tarihi */}
                <div className="border-t border-gray-200 pt-3">
                  <div className="text-xs text-gray-500 mb-1">Teslimat Tarihi</div>
                  <div className="text-sm text-gray-900">
                    {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                  </div>
                </div>

                {/* İrsaliye Fotoğrafları */}
                {order.delivery_image_urls && order.delivery_image_urls.length > 0 && (
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-500 mb-2">İrsaliye Fotoğrafları</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewDeliveryPhotos(order.delivery_image_urls!, 0)
                        }}
                        className="w-16 h-16 rounded border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 overflow-hidden bg-white"
                      >
                        <img
                          src={order.delivery_image_urls[0]}
                          alt="İrsaliye"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {order.delivery_image_urls.length > 1 && (
                        <span className="text-sm text-gray-500">
                          +{order.delivery_image_urls.length - 1} fotoğraf daha
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* İşlemler */}
                <div className="border-t border-gray-200 pt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  {/* Fatura ve PDF Butonları */}
                  <div className="flex gap-2">
                    {/* Fatura Durumu */}
                    <div className="flex-1">
                      {order.invoices && order.invoices.length > 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewInvoices(order.invoices, 0)
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 hover:bg-green-100 transition-colors cursor-pointer h-9"
                        >
                          <Receipt className="h-4 w-4" />
                          <span className="font-medium">Fatura ({order.invoices.length})</span>
                        </button>
                      ) : selectedOrders.has(order.id) ? (
                        <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm text-gray-700 h-9">
                          <Receipt className="h-4 w-4" />
                          <span className="font-medium">Seçili</span>
                        </div>
                      ) : null}
                    </div>
                    
                    {/* PDF Export Butonu */}
                    <div className="flex-1">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          onExportPDF(order)
                        }}
                        size="sm"
                        variant="outline"
                        disabled={loadingPDFOrders.has(order.id)}
                        className="w-full text-xs border-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed h-9"
                      >
                        {loadingPDFOrders.has(order.id) ? (
                          <>
                            <InlineLoading className="mr-1" />
                            PDF
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-1" />
                            PDF
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Detaylar Butonu */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard/requests/${order.purchase_request_id}/offers`)
                      }}
                      className="w-full text-xs"
                    >
                      Detaylar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}





