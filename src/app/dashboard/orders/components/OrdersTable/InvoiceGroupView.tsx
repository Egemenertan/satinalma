'use client'

import { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Receipt, FileText, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCurrencySymbol } from '@/components/offers/types'
import { useInvoiceGroups, useInvoiceGroupOrders } from '../../hooks'
import { Loading } from '@/components/ui/loading'

interface InvoiceGroupViewProps {
  invoiceGroups: Record<string, any[]>
  noInvoiceOrders: any[]
  selectedOrders: Set<string>
  loadingPDFOrders: Set<string>
  onToggleOrderSelect: (orderId: string, orderData?: any) => void
  onViewInvoices: (invoices: any[]) => void
  onExportPDF: (order: any) => void
  onExportGroupPDF: (orders: any[]) => void
  isGeneratingReport: boolean
  orders: any[] // Tüm siparişler
  searchTerm?: string // Arama terimi
}

export function InvoiceGroupView({
  invoiceGroups,
  noInvoiceOrders,
  selectedOrders,
  loadingPDFOrders,
  onToggleOrderSelect,
  onViewInvoices,
  onExportPDF,
  onExportGroupPDF,
  isGeneratingReport,
  orders,
  searchTerm = '',
}: InvoiceGroupViewProps) {
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // Arama terimi değiştiğinde 1. sayfaya dön
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])
  
  // Supabase'den invoice groups ve TÜM ilgili siparişleri çek (arama ile)
  const { data: invoiceGroupsData, isLoading: isLoadingGroups } = useInvoiceGroups(searchTerm)
  const { data: invoiceGroupOrders, isLoading: isLoadingOrders } = useInvoiceGroupOrders(searchTerm)
  
  // Invoice groups'ları order'larla eşleştir (artık invoiceGroupOrders kullanıyoruz)
  const enrichedInvoiceGroups = useMemo(() => {
    if (!invoiceGroupsData || !invoiceGroupOrders) {
      console.log('❌ Missing data:', { 
        hasInvoiceGroups: !!invoiceGroupsData, 
        hasOrders: !!invoiceGroupOrders,
        ordersCount: invoiceGroupOrders?.length 
      })
      return []
    }
    
    console.log('📊 Starting enrichment:', {
      invoiceGroupsCount: invoiceGroupsData.length,
      ordersCount: invoiceGroupOrders.length,
      sampleOrderIds: invoiceGroupOrders.slice(0, 3).map(o => o.id)
    })
    
    const enriched = invoiceGroupsData.map(group => {
      // View'dan gelen invoices array'inden order_id'leri al
      const orderIds = group.invoices?.map((inv: any) => inv.order_id) || []
      
      console.log(`📦 Group "${group.group_name}":`, {
        groupId: group.id,
        invoiceCount: group.invoice_count,
        orderIds: orderIds
      })
      
      // Bu order_id'lere sahip siparişleri bul (artık invoiceGroupOrders kullanıyoruz)
      const groupOrders = invoiceGroupOrders.filter(order => orderIds.includes(order.id))
      
      console.log(`   ✅ Found ${groupOrders.length} orders for group`)
      
      return {
        ...group,
        orders: groupOrders,
      }
    })
    
    const filtered = enriched.filter(group => group.orders.length > 0)
    
    console.log(`🎯 Final result: ${filtered.length} groups with orders`)
    
    // Supabase'den zaten created_at DESC olarak sıralanmış geliyor
    return filtered
  }, [invoiceGroupsData, invoiceGroupOrders])
  
  // Pagination hesaplamaları
  const totalGroups = enrichedInvoiceGroups.length
  const totalPages = Math.ceil(totalGroups / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedGroups = enrichedInvoiceGroups.slice(startIndex, endIndex)
  
  // Tedarikçi adını al - grup bilgilerinden
  const getSupplierName = (group: any, orders: any[]) => {
    // Önce orders'dan tedarikçi adlarını topla
    const supplierNames = new Set<string>()
    orders.forEach(order => {
      if (order.suppliers?.name) {
        supplierNames.add(order.suppliers.name)
      }
    })
    
    // Tek tedarikçi varsa adını göster, birden fazla varsa "Çoklu Tedarikçi"
    if (supplierNames.size === 1) {
      return Array.from(supplierNames)[0]
    } else if (supplierNames.size > 1) {
      return 'Çoklu Tedarikçi'
    }
    
    return 'Belirtilmemiş'
  }

  // Loading state
  if (isLoadingGroups || isLoadingOrders) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loading size="lg" text="Fatura grupları yükleniyor..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
     

      {/* Fatura Grupları */}
      {totalGroups === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          
          <p className="text-gray-600 font-medium">Fatura grubu bulunamadı</p>
          <p className="text-sm text-gray-500 mt-1">
            Toplu fatura oluşturulduğunda burada görünecektir
          </p>
        </div>
      ) : (
        paginatedGroups.map((group) => {
          const groupOrders = group.orders
          if (!groupOrders || groupOrders.length === 0) return null
          
          const supplierName = getSupplierName(group, groupOrders)

          return (
            <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Fatura Grup Başlığı */}
            <div className="bg-green-50 border-b border-green-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-semibold text-gray-900">
                      {supplierName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {group.invoice_count} sipariş • {getCurrencySymbol(group.currency)}
                      {group.grand_total?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {group.currency}
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Toplu Fatura
                      </span>
                    </div>
                    {group.notes && (
                      <div className="text-xs text-gray-500 mt-1">
                        {group.notes}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // İlk siparişin faturasını göster
                      if (groupOrders[0]?.invoices?.length > 0) {
                        onViewInvoices(groupOrders[0].invoices)
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Fatura Görüntüle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExportGroupPDF(groupOrders)}
                    disabled={isGeneratingReport}
                    className="flex items-center gap-2 bg-white hover:bg-gray-50"
                  >
                    {isGeneratingReport ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                        Rapor Oluşturuluyor...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Toplu Rapor
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Siparişler - En yeniden eskiye sıralanmış */}
            <div className="divide-y divide-gray-100">
              {groupOrders
                .sort((a: any, b: any) => {
                  const dateA = new Date(a.created_at).getTime()
                  const dateB = new Date(b.created_at).getTime()
                  return dateB - dateA // En yeni önce
                })
                .map((order: any) => (
                <div
                  key={order.id}
                  className="px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    {/* Sipariş Bilgileri */}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span>Tedarikçi: {order.suppliers?.name || 'Belirtilmemiş'}</span>
                        <span className="mx-2">•</span>
                        <span>Miktar: {order.quantity} {order.purchase_request_items?.unit || ''}</span>
                        {order.purchase_request_items?.brand && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Marka: {order.purchase_request_items.brand}</span>
                          </>
                        )}
                        <span className="mx-2">•</span>
                        <span className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Durum ve İşlemler */}
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="default"
                        className={order.status === 'delivered' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                      >
                        {order.status === 'delivered' ? 'Teslim Alındı' : order.status}
                      </Badge>
                      
                      <Button
                        onClick={() => onExportPDF(order)}
                        size="sm"
                        variant="outline"
                        disabled={loadingPDFOrders.has(order.id)}
                        className="text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )
        })
      )}

      {/* Pagination Kontrolleri */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">
            {startIndex + 1}-{Math.min(endIndex, totalGroups)} arası gösteriliyor (Toplam {totalGroups} grup)
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-900"
            >
              <ChevronLeft className="w-4 h-4" />
              Önceki
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Sadece mevcut sayfa ve yakınındaki sayfaları göster
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[40px] ${
                        currentPage === page
                          ? 'bg-gray-900 text-white hover:bg-gray-800 border-gray-900'
                          : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                      }`}
                    >
                      {page}
                    </Button>
                  )
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return <span key={page} className="px-2 text-gray-400">...</span>
                }
                return null
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-900"
            >
              Sonraki
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

