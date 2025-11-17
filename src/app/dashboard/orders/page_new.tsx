'use client'

/**
 * Orders Page - Refactored Version
 * Modern, maintainable ve senior-level kod yapısı
 * 
 * Özellikler:
 * - React Query ile data management
 * - Custom hooks ile logic separation
 * - Component-based architecture
 * - Full type safety
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import FullScreenImageViewer from '@/components/FullScreenImageViewer'

// Components
import { OrderFilters } from './components/OrderFilters'
import { OrderStatsCards } from './components/OrderStats'
import { OrdersTable } from './components/OrdersTable'
import { InvoiceGroupView } from './components/OrdersTable/InvoiceGroupView'
import { MultiSelectActions } from './components/MultiSelect'

// Hooks
import { useOrders, useOrderFilters, useMultiSelect, usePDFExport } from './hooks'

// Note: Invoice Modal ve diğer büyük modal'lar geçici olarak
// orijinal page.tsx'ten alınacak (çok büyük oldukları için)
// İlerleyen aşamada bunlar da ayrı component'lere çevrilebilir

export default function OrdersPage() {
  const router = useRouter()
  const { showToast } = useToast()

  // Filters Hook
  const {
    filters,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    clearDateFilters,
    currentPage,
    setCurrentPage,
  } = useOrderFilters()

  // Orders Data Hook
  const { data: ordersData, error, isLoading } = useOrders(filters)

  // Multi-Select Hook
  const {
    selectedOrders,
    toggleOrderSelection,
    selectAllOrdersInGroup,
    clearSelection,
    getSelectedOrdersData,
  } = useMultiSelect()

  // PDF Export Hook
  const {
    loadingPDFOrders,
    isGeneratingReport,
    exportSingleOrder,
    exportMultipleOrders,
  } = usePDFExport()

  // View Mode State - Fatura bazlı görünüm
  const [viewMode, setViewMode] = useState<'default' | 'invoice'>('default')

  // Image Viewer State
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Invoice Modal State (geçici - sonradan ayrı component yapılacak)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Invoice Viewer State
  const [isInvoiceViewerOpen, setIsInvoiceViewerOpen] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([])

  const orders = ordersData?.orders || []
  const totalCount = ordersData?.totalCount || 0
  const totalPages = ordersData?.totalPages || 1

  // Fatura bazlı gruplama - aynı invoice_photos'a sahip siparişleri birleştir
  const groupOrdersByInvoice = (orders: any[]) => {
    const invoiceGroups: Record<string, any[]> = {}
    const noInvoiceOrders: any[] = []

    orders.forEach(order => {
      if (order.invoices && order.invoices.length > 0) {
        const invoice = order.invoices[0]
        
        // Önce invoice_group_id'ye göre grupla
        if (invoice.invoice_group_id) {
          const groupId = invoice.invoice_group_id
          if (!invoiceGroups[groupId]) {
            invoiceGroups[groupId] = []
          }
          invoiceGroups[groupId].push(order)
        } else {
          // invoice_group_id yoksa, invoice_photos'a göre grupla
          // Aynı fatura fotoğraflarına sahip siparişleri birleştir
          const photoKey = JSON.stringify(invoice.invoice_photos?.sort() || [])
          const groupId = `photo_${photoKey}_${invoice.id}`
          
          // Aynı fotoğraflara sahip başka bir grup var mı kontrol et
          let foundGroup = false
          for (const [existingGroupId, existingOrders] of Object.entries(invoiceGroups)) {
            if (existingGroupId.startsWith('photo_')) {
              const existingInvoice = existingOrders[0]?.invoices[0]
              const existingPhotoKey = JSON.stringify(existingInvoice?.invoice_photos?.sort() || [])
              
              if (photoKey === existingPhotoKey && photoKey !== '[]') {
                // Aynı fotoğraflar, bu gruba ekle
                invoiceGroups[existingGroupId].push(order)
                foundGroup = true
                break
              }
            }
          }
          
          if (!foundGroup) {
            if (!invoiceGroups[groupId]) {
              invoiceGroups[groupId] = []
            }
            invoiceGroups[groupId].push(order)
          }
        }
      } else {
        noInvoiceOrders.push(order)
      }
    })

    return { invoiceGroups, noInvoiceOrders }
  }

  const { invoiceGroups, noInvoiceOrders } = groupOrdersByInvoice(orders)

  // Handlers
  const handleViewDeliveryPhotos = (photos: string[], index = 0) => {
    setSelectedImages(photos)
    setSelectedImageIndex(index)
    setIsImageViewerOpen(true)
  }

  const handleViewInvoices = (invoices: any[], index = 0) => {
    setSelectedInvoices(invoices)
    setSelectedImageIndex(index)
    setIsInvoiceViewerOpen(true)
  }

  const handleOpenMultiInvoiceModal = () => {
    if (selectedOrders.size === 0) {
      showToast('Lütfen en az bir sipariş seçin', 'error')
      return
    }
    setSelectedOrderId(null)
    setIsInvoiceModalOpen(true)
  }

  const handleExportMultiplePDF = async () => {
    if (selectedOrders.size === 0) {
      showToast('Lütfen en az bir sipariş seçin', 'error')
      return
    }

    try {
      await exportMultipleOrders(orders, Array.from(selectedOrders))
      showToast(`${selectedOrders.size} sipariş için PDF başarıyla oluşturuldu`, 'success')
    } catch (error) {
      showToast('Toplu PDF oluşturulurken hata oluştu', 'error')
    }
  }

  const handleExportOrderPDF = async (order: any) => {
    try {
      await exportSingleOrder(order)
      showToast('PDF başarıyla oluşturuldu', 'success')
    } catch (error: any) {
      showToast('PDF oluşturma hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    }
  }

  const handleExportGroupPDF = async (groupOrders: any[]) => {
    try {
      const orderIds = groupOrders.map(o => o.id)
      await exportMultipleOrders(orders, orderIds)
      showToast(`${groupOrders.length} sipariş için toplu rapor başarıyla oluşturuldu`, 'success')
    } catch (error: any) {
      showToast('Toplu rapor oluşturma hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    }
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <h2 className="text-xl font-semibold">Hata Oluştu</h2>
            <p className="text-gray-600 mt-2">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-8 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Siparişler</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Teslim alınmış taleplere ait sipariş yönetimi</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs sm:text-sm">
              {orders.length} Sipariş
            </Badge>
            {selectedOrders.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-600 text-white text-xs sm:text-sm">
                  {selectedOrders.size} Seçili
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {orders.length > 0 && <OrderStatsCards orders={orders} />}

      {/* Orders Table */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Sipariş Listesi</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Teslim alınmış taleplere ait sipariş detayları</p>
              </div>
            </div>
            
            {/* Filters */}
            <OrderFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onClearDateFilters={clearDateFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loading size="lg" text="Siparişler yükleniyor..." />
            </div>
          ) : viewMode === 'invoice' ? (
            <InvoiceGroupView
              invoiceGroups={invoiceGroups}
              noInvoiceOrders={noInvoiceOrders}
              selectedOrders={selectedOrders}
              loadingPDFOrders={loadingPDFOrders}
              onToggleOrderSelect={toggleOrderSelection}
              onViewInvoices={handleViewInvoices}
              onExportPDF={handleExportOrderPDF}
              onExportGroupPDF={handleExportGroupPDF}
              isGeneratingReport={isGeneratingReport}
              orders={orders}
              searchTerm={searchTerm}
            />
          ) : (
            <OrdersTable
              orders={orders}
              selectedOrders={selectedOrders}
              loadingPDFOrders={loadingPDFOrders}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              isGeneratingReport={isGeneratingReport}
              onToggleOrderSelect={toggleOrderSelection}
              onSelectAllInGroup={selectAllOrdersInGroup}
              onViewInvoices={handleViewInvoices}
              onViewDeliveryPhotos={handleViewDeliveryPhotos}
              onExportPDF={handleExportOrderPDF}
              onPageChange={setCurrentPage}
              onOpenMultiInvoiceModal={handleOpenMultiInvoiceModal}
              onExportMultiplePDF={handleExportMultiplePDF}
            />
          )}
        </CardContent>
      </Card>

      {/* Multi-Select Actions */}
      <MultiSelectActions
        selectedCount={selectedOrders.size}
        onClearSelection={clearSelection}
        onOpenInvoiceModal={handleOpenMultiInvoiceModal}
        onExportPDF={handleExportMultiplePDF}
        isGeneratingReport={isGeneratingReport}
      />

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        title="İrsaliye Fotoğrafları"
      />

      {/* 
        TODO: Invoice Modals
        - InvoiceModal (fatura ekleme)
        - InvoiceViewer (fatura görüntüleme/düzenleme)
        - PDFInvoiceSelectionModal
        
        Bu modal'lar çok büyük olduğu için şimdilik
        orijinal page.tsx'ten alınacak ve eklenecek.
        İlerleyen aşamada bunlar da ayrı component'lere dönüştürülebilir.
      */}
    </div>
  )
}



