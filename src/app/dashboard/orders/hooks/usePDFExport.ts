/**
 * usePDFExport Hook
 * PDF export işlemleri state yönetimi
 */

import { useState } from 'react'
import { generatePurchaseRequestReportFast, type ReportData } from '@/lib/pdf-generator'
import type { OrderData } from '../types'

export function usePDFExport() {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [loadingPDFOrders, setLoadingPDFOrders] = useState<Set<string>>(new Set())
  
  // PDF Invoice Selection Modal state
  const [isPDFInvoiceSelectionOpen, setIsPDFInvoiceSelectionOpen] = useState(false)
  const [pdfOrderContext, setPDFOrderContext] = useState<OrderData | null>(null)
  const [selectedPDFInvoices, setSelectedPDFInvoices] = useState<Set<string>>(new Set())

  /**
   * Tek sipariş için PDF export
   */
  const exportSingleOrder = async (
    order: OrderData,
    selectedInvoiceIds?: string[]
  ): Promise<void> => {
    // Eğer birden fazla fatura varsa ve henüz seçim yapılmadıysa, seçim modalını aç
    if (!selectedInvoiceIds && order.invoices && order.invoices.length > 1) {
      setPDFOrderContext(order)
      // Varsayılan olarak tüm faturaları seç
      setSelectedPDFInvoices(new Set(order.invoices.map(inv => inv.id)))
      setIsPDFInvoiceSelectionOpen(true)
      return
    }
    
    // Loading state'i başlat
    setLoadingPDFOrders(prev => new Set([...prev, order.id]))
    
    try {
      console.log('📋 PDF Export başlatılıyor:', {
        orderId: order.id,
        requestId: order.purchase_request_id,
        supplierName: order.suppliers?.name,
        itemName: order.purchase_request_items?.item_name
      })

      // Timeline API'sini kullan
      const response = await fetch(`/api/reports/timeline?requestId=${order.purchase_request_id}`)
      
      if (!response.ok) {
        throw new Error('Timeline verileri alınamadı')
      }
      
      const timelineData = await response.json()

      // Bu siparişin faturasının invoice_group_id'sini kontrol et
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      let relatedOrderIds = [order.id]
      let invoiceGroupId = null
      
      // Eğer sipariş faturası varsa, invoice group'u kontrol et
      if (order.invoices && order.invoices.length > 0) {
        const { data: invoiceWithGroup } = await supabase
          .from('invoices')
          .select('invoice_group_id')
          .eq('order_id', order.id)
          .single()
        
        if (invoiceWithGroup?.invoice_group_id) {
          invoiceGroupId = invoiceWithGroup.invoice_group_id
          
          // Aynı group'taki tüm invoice'ları ve order'ları bul
          const { data: groupInvoices } = await supabase
            .from('invoices')
            .select('order_id')
            .eq('invoice_group_id', invoiceGroupId)
          
          if (groupInvoices && groupInvoices.length > 0) {
            relatedOrderIds = groupInvoices.map(inv => inv.order_id)
            console.log('📦 Toplu fatura grubu bulundu:', {
              groupId: invoiceGroupId,
              relatedOrdersCount: relatedOrderIds.length,
              relatedOrderIds
            })
          }
        }
      }

      // İlgili tüm siparişleri filtrele
      const specificOrders = timelineData.orders?.filter((o: any) => 
        relatedOrderIds.includes(o.id)
      ) || []
      
      // İlgili tüm faturaları filtrele
      let specificInvoices = timelineData.invoices?.filter((inv: any) => 
        relatedOrderIds.includes(inv.order_id)
      ) || []
      
      // Eğer belirli faturalar seçildiyse, sadece onları dahil et
      if (selectedInvoiceIds && selectedInvoiceIds.length > 0) {
        specificInvoices = specificInvoices.filter((inv: any) => selectedInvoiceIds.includes(inv.id))
      }
      
      console.log('📋 PDF için seçilen siparişler:', {
        ordersCount: specificOrders.length,
        invoicesCount: specificInvoices.length,
        hasInvoiceGroup: !!invoiceGroupId
      })

      // Timeline'ı ilgili siparişler için filtrele
      const filteredTimeline = timelineData.timeline?.filter((item: any) => {
        if (item.type === 'order' && item.order_data) {
          // İlgili siparişlerden birinin supplier ve item bilgisiyle eşleşiyorsa dahil et
          return specificOrders.some((o: any) => 
            item.order_data.supplier_name === o.suppliers?.name &&
            item.order_data.item_name === o.purchase_request_items?.item_name
          )
        }
        if (item.type === 'invoice' && item.invoice_data) {
          return specificInvoices.some((inv: any) => 
            inv.id === item.invoice_data.id ||
            (inv.amount === item.invoice_data.amount &&
             inv.currency === item.invoice_data.currency &&
             new Date(inv.created_at).getTime() === new Date(item.invoice_data.created_at).getTime())
          )
        }
        return ['creation', 'approval', 'shipment'].includes(item.type)
      }) || []

      // Toplam tutar ve para birimi hesapla
      const totalAmount = specificInvoices.length > 0 
        ? specificInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
        : specificOrders.reduce((sum: number, o: any) => sum + o.amount, 0)
      
      const invoiceCurrency = specificInvoices.length > 0 
        ? specificInvoices[0].currency 
        : (specificOrders.length > 0 ? specificOrders[0].currency : 'TRY')

      // PDF verilerini hazırla
      const pdfData: ReportData = {
        request: timelineData.request,
        timeline: filteredTimeline,
        orders: specificOrders.length > 0 ? specificOrders : [order],
        invoices: specificInvoices,
        statistics: {
          totalDays: Math.ceil(
            (new Date().getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
          totalOffers: specificOrders.length,
          totalShipments: specificOrders.filter((o: any) => o.is_delivered).length,
          totalInvoices: specificInvoices.length,
          totalAmount: totalAmount,
          currency: invoiceCurrency,
          // API'den gelen invoice group bilgilerini kullan (varsa)
          // Eğer invoice group varsa, bu değerler API'den gelecek
          subtotal: timelineData.statistics?.subtotal,
          discount: timelineData.statistics?.discount,
          tax: timelineData.statistics?.tax,
          grandTotal: timelineData.statistics?.grandTotal,
        }
      }
      
      console.log('📄 PDF Data hazırlandı:', {
        ordersCount: pdfData.orders.length,
        invoicesCount: pdfData.invoices.length,
        hasGroupData: !!(pdfData.statistics.subtotal || pdfData.statistics.discount || pdfData.statistics.tax),
        subtotal: pdfData.statistics.subtotal,
        discount: pdfData.statistics.discount,
        tax: pdfData.statistics.tax,
        grandTotal: pdfData.statistics.grandTotal
      })

      await generatePurchaseRequestReportFast(pdfData)
      
    } catch (error: any) {
      console.error('PDF export error:', error)
      throw error
    } finally {
      setLoadingPDFOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(order.id)
        return newSet
      })
    }
  }

  /**
   * Toplu sipariş için PDF export
   */
  const exportMultipleOrders = async (
    orders: OrderData[],
    selectedOrderIds: string[]
  ): Promise<void> => {
    setIsGeneratingReport(true)
    
    try {
      if (orders.length === 0 || selectedOrderIds.length === 0) {
        throw new Error('Seçili sipariş bulunamadı')
      }

      // Seçili siparişleri al
      const selectedOrdersData = orders.filter(order => selectedOrderIds.includes(order.id))
      
      // İlk siparişin request_id'sini al
      const firstRequestId = selectedOrdersData[0].purchase_request_id
      
      // Timeline verilerini çek
      const response = await fetch(`/api/reports/timeline?requestId=${firstRequestId}`)
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const timelineData = await response.json()

      // Sadece seçili siparişlerin verilerini filtrele
      const filteredOrders = timelineData.orders.filter((order: any) => 
        selectedOrderIds.includes(order.id)
      )
      
      const filteredInvoices = timelineData.invoices.filter((invoice: any) => 
        selectedOrderIds.includes(invoice.order_id)
      )

      // Timeline'ı seçili siparişlere göre filtrele
      const filteredTimeline = timelineData.timeline.filter((item: any) => {
        if (item.type === 'order' || item.type === 'shipment') {
          return selectedOrderIds.includes(item.order_id)
        }
        if (item.type === 'invoice') {
          return selectedOrderIds.includes(item.invoice?.order_id)
        }
        return true
      })

      // İstatistikleri hesapla
      const totalAmount = filteredOrders.reduce((sum: number, order: any) => {
        const invoiceAmount = order.invoices?.reduce((invSum: number, inv: any) => invSum + inv.amount, 0) || 0
        return sum + (invoiceAmount > 0 ? invoiceAmount : order.amount)
      }, 0)

      const totalDays = Math.ceil(
        (new Date().getTime() - new Date(filteredOrders[filteredOrders.length - 1]?.created_at || new Date()).getTime()) / (1000 * 60 * 60 * 24)
      )

      // PDF verilerini hazırla - API'den gelen statistics'i kullan
      const pdfData: ReportData = {
        request: timelineData.request,
        timeline: filteredTimeline,
        orders: filteredOrders,
        invoices: filteredInvoices,
        statistics: {
          totalDays: totalDays,
          totalOffers: filteredOrders.length,
          totalShipments: filteredOrders.filter((o: any) => o.is_delivered).length,
          totalInvoices: filteredOrders.reduce((sum: number, order: any) => sum + (order.invoices?.length || 0), 0),
          totalAmount: totalAmount,
          currency: filteredOrders[0]?.currency || 'TRY',
          // API'den gelen invoice group bilgilerini kullan (varsa)
          subtotal: timelineData.statistics?.subtotal,
          discount: timelineData.statistics?.discount,
          tax: timelineData.statistics?.tax,
          grandTotal: timelineData.statistics?.grandTotal,
        }
      }

      await generatePurchaseRequestReportFast(pdfData)
      
    } catch (error) {
      console.error('Toplu PDF export error:', error)
      throw error
    } finally {
      setIsGeneratingReport(false)
    }
  }

  return {
    isGeneratingReport,
    loadingPDFOrders,
    isPDFInvoiceSelectionOpen,
    setIsPDFInvoiceSelectionOpen,
    pdfOrderContext,
    setPDFOrderContext,
    selectedPDFInvoices,
    setSelectedPDFInvoices,
    exportSingleOrder,
    exportMultipleOrders,
  }
}



