/**
 * usePDFExport Hook
 * PDF export işlemleri — tek timeline isteği, ekstra client sorgusu yok.
 */

import { useState } from 'react'
import { generatePDFReport } from '@/lib/pdf'
import type { OrderData } from '../types'

const TIMELINE_TIMEOUT_MS = 20_000

function getInvoiceGroupId(order?: OrderData | null): string | null {
  return order?.invoices?.find((invoice) => invoice.invoice_group_id)?.invoice_group_id ?? null
}

async function fetchTimelineForPdf(params: {
  requestId: string
  invoiceGroupId?: string | null
  orderIds?: string[]
}) {
  const apiUrl = new URL('/api/reports/timeline', window.location.origin)
  apiUrl.searchParams.set('requestId', params.requestId)
  apiUrl.searchParams.set('purpose', 'pdf')

  if (params.orderIds && params.orderIds.length > 0) {
    apiUrl.searchParams.set('orderIds', params.orderIds.join(','))
  } else if (params.invoiceGroupId) {
    apiUrl.searchParams.set('invoiceGroupId', params.invoiceGroupId)
  }

  const response = await fetch(apiUrl.toString(), {
    signal: AbortSignal.timeout(TIMELINE_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error('Timeline verileri alınamadı')
  }

  return response.json()
}

function filterTimeline(
  timeline: any[] | undefined,
  orders: any[],
  invoices: any[]
) {
  return (timeline || []).filter((item: any) => {
    if (item.type === 'order' && item.order_data) {
      return orders.some(
        (order: any) =>
          item.order_data.supplier_name === order.suppliers?.name &&
          item.order_data.item_name === order.purchase_request_items?.item_name
      )
    }
    if (item.type === 'invoice' && item.invoice_data) {
      return invoices.some(
        (invoice: any) =>
          invoice.id === item.invoice_data.id ||
          (invoice.amount === item.invoice_data.amount &&
            invoice.currency === item.invoice_data.currency &&
            new Date(invoice.created_at).getTime() === new Date(item.invoice_data.created_at).getTime())
      )
    }
    if (item.type === 'order' || item.type === 'shipment') {
      return !item.order_id || orders.some((order: any) => order.id === item.order_id)
    }
    if (item.type === 'invoice') {
      return !item.invoice?.order_id || invoices.some((invoice: any) => invoice.order_id === item.invoice.order_id)
    }
    return ['creation', 'approval', 'shipment'].includes(item.type) || item.type === 'delivery'
  })
}

export function usePDFExport() {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [loadingPDFOrders, setLoadingPDFOrders] = useState<Set<string>>(new Set())

  const [isPDFInvoiceSelectionOpen, setIsPDFInvoiceSelectionOpen] = useState(false)
  const [pdfOrderContext, setPDFOrderContext] = useState<OrderData | null>(null)
  const [selectedPDFInvoices, setSelectedPDFInvoices] = useState<Set<string>>(new Set())

  const exportSingleOrder = async (
    order: OrderData,
    selectedInvoiceIds?: string[]
  ): Promise<boolean> => {
    if (!selectedInvoiceIds && order.invoices && order.invoices.length > 1) {
      setPDFOrderContext(order)
      setSelectedPDFInvoices(new Set(order.invoices.map((invoice) => invoice.id)))
      setIsPDFInvoiceSelectionOpen(true)
      return false
    }

    setLoadingPDFOrders((prev) => new Set([...prev, order.id]))

    try {
      const invoiceGroupId = getInvoiceGroupId(order)
      const timelineData = await fetchTimelineForPdf({
        requestId: order.purchase_request_id,
        invoiceGroupId,
        orderIds: invoiceGroupId ? undefined : [order.id],
      })

      const relatedOrderIds = invoiceGroupId
        ? (timelineData.orders || []).map((item: any) => item.id)
        : [order.id]

      const specificOrders =
        (timelineData.orders || []).filter((item: any) => relatedOrderIds.includes(item.id))

      let specificInvoices =
        (timelineData.invoices || []).filter((invoice: any) => relatedOrderIds.includes(invoice.order_id))

      if (selectedInvoiceIds && selectedInvoiceIds.length > 0) {
        specificInvoices = specificInvoices.filter((invoice: any) => selectedInvoiceIds.includes(invoice.id))
      }

      const totalAmount =
        specificInvoices.length > 0
          ? specificInvoices.reduce((sum: number, invoice: any) => sum + (invoice.grand_total || invoice.amount), 0)
          : specificOrders.reduce((sum: number, item: any) => sum + item.amount, 0)

      const invoiceCurrency =
        specificInvoices.length > 0
          ? specificInvoices[0].currency
          : specificOrders.length > 0
            ? specificOrders[0].currency
            : 'TRY'

      const shouldUseStatistics =
        !!invoiceGroupId &&
        (!selectedInvoiceIds || selectedInvoiceIds.length === 0 || selectedInvoiceIds.length > 1)

      await generatePDFReport({
        request: timelineData.request,
        timeline: filterTimeline(timelineData.timeline, specificOrders, specificInvoices),
        orders: specificOrders.length > 0 ? specificOrders : [order],
        invoices: specificInvoices,
        statistics: {
          totalDays: Math.ceil(
            (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
          totalOffers: specificOrders.length,
          totalShipments: specificOrders.filter((item: any) => item.is_delivered).length,
          totalInvoices: specificInvoices.length,
          totalAmount,
          currency: invoiceCurrency,
          subtotal: shouldUseStatistics ? timelineData.statistics?.subtotal : undefined,
          discount: shouldUseStatistics ? timelineData.statistics?.discount : undefined,
          tax: shouldUseStatistics ? timelineData.statistics?.tax : undefined,
          grandTotal: shouldUseStatistics ? timelineData.statistics?.grandTotal : undefined,
        },
      })
      return true
    } catch (error) {
      console.error('PDF export error:', error)
      throw error
    } finally {
      setLoadingPDFOrders((prev) => {
        const next = new Set(prev)
        next.delete(order.id)
        return next
      })
    }
  }

  const exportMultipleOrders = async (
    orders: OrderData[],
    selectedOrderIds: string[]
  ): Promise<number> => {
    setIsGeneratingReport(true)

    try {
      if (orders.length === 0 || selectedOrderIds.length === 0) {
        throw new Error('Seçili sipariş bulunamadı')
      }

      const selectedOrdersData = orders.filter((order) => selectedOrderIds.includes(order.id))
      if (selectedOrdersData.length === 0) {
        throw new Error('Seçili sipariş bulunamadı')
      }

      const sharedGroupIds = [
        ...new Set(
          selectedOrdersData
            .map((order) => getInvoiceGroupId(order))
            .filter((id): id is string => Boolean(id))
        ),
      ]
      const invoiceGroupId = sharedGroupIds.length === 1 ? sharedGroupIds[0] : null

      const requestIds = [
        ...new Set(selectedOrdersData.map((order) => order.purchase_request_id).filter(Boolean)),
      ]
      const sharedRequestId = requestIds.length === 1 ? requestIds[0] : null
      const loadedSameRequest = sharedRequestId
        ? orders.filter((order) => order.purchase_request_id === sharedRequestId)
        : []
      // Tümünü seç: sayfadaki talebin bütün siparişleri seçiliyse fatura olmasa da
      // talebin tüm kalemlerini tek PDF'te topla.
      const includeEntireRequest =
        Boolean(sharedRequestId) &&
        loadedSameRequest.length > 0 &&
        loadedSameRequest.every((order) => selectedOrderIds.includes(order.id))

      const timelineData = await fetchTimelineForPdf(
        includeEntireRequest
          ? { requestId: sharedRequestId as string }
          : {
              requestId: selectedOrdersData[0].purchase_request_id,
              orderIds: selectedOrderIds,
            }
      )

      const apiOrders = includeEntireRequest
        ? timelineData.orders || []
        : (timelineData.orders || []).filter((order: any) => selectedOrderIds.includes(order.id))
      const includedIds = new Set(apiOrders.map((order: any) => order.id))
      const missingSelected = selectedOrdersData.filter((order) => !includedIds.has(order.id))
      const filteredOrders = [...apiOrders, ...missingSelected]
      const filteredInvoices = (timelineData.invoices || []).filter((invoice: any) =>
        filteredOrders.some((order: any) => order.id === invoice.order_id)
      )

      const totalAmount =
        filteredInvoices.length > 0
          ? filteredInvoices.reduce((sum: number, invoice: any) => sum + invoice.amount, 0)
          : filteredOrders.reduce((sum: number, order: any) => sum + order.amount, 0)

      const totalDays = Math.ceil(
        (Date.now() -
          new Date(filteredOrders[filteredOrders.length - 1]?.created_at || Date.now()).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      const invoiceCurrency =
        filteredInvoices.length > 0
          ? filteredInvoices[0].currency
          : filteredOrders.length > 0
            ? filteredOrders[0].currency
            : 'TRY'

      await generatePDFReport({
        request: timelineData.request,
        timeline: filterTimeline(timelineData.timeline, filteredOrders, filteredInvoices),
        orders: filteredOrders,
        invoices: filteredInvoices,
        statistics: {
          totalDays,
          totalOffers: filteredOrders.length,
          totalShipments: filteredOrders.filter((order: any) => order.is_delivered).length,
          totalInvoices: filteredInvoices.length,
          totalAmount,
          currency: invoiceCurrency,
          subtotal: invoiceGroupId ? timelineData.statistics?.subtotal : undefined,
          discount: invoiceGroupId ? timelineData.statistics?.discount : undefined,
          tax: invoiceGroupId ? timelineData.statistics?.tax : undefined,
          grandTotal: invoiceGroupId ? timelineData.statistics?.grandTotal : undefined,
        },
      })
      return filteredOrders.length
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
