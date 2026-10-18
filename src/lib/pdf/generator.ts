/**
 * Modern, Fast PDF Generator
 * Uses browser's native print functionality for instant PDF generation
 */

import type { PDFData, PDFInvoiceData, PDFOrderData, PDFRequestData } from './types'
import { getPDFStyles } from './styles'
import { buildHeader, buildRequestInfo, buildKeyPeopleTimeline, buildOrders, buildInvoicesList, buildInvoiceSummary } from './components'
import { printHtmlDocument } from './printHtml'

/**
 * Generate complete PDF HTML
 */
const generatePDFHTML = (data: PDFData): string => {
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Satın Alma Raporu - ${data.request.title}</title>
  ${getPDFStyles()}
</head>
<body>
  <div class="container">
    ${buildHeader(data.request, data.orders)}
    ${buildRequestInfo(data.request)}
    ${buildKeyPeopleTimeline(data.timeline)}
    ${buildOrders(data.orders)}
    ${buildInvoicesList(data.invoices)}
    ${buildInvoiceSummary(data.invoices, data.statistics)}
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate and show PDF using print dialog - INSTANT
 */
export const generatePDF = async (data: PDFData): Promise<void> => {
  await printHtmlDocument(generatePDFHTML(data))
}

/**
 * Transform API data to PDF data format
 */
export const transformToPDFData = (apiData: any): PDFData => {
  // Extract request info
  const requestNumbers = [...new Set(
    (apiData.orders || [])
      .map((order: any) => String(order.request_number || order.purchase_requests?.request_number || '').trim())
      .filter(Boolean)
  )]
  if (requestNumbers.length === 0 && apiData.request?.request_number) {
    requestNumbers.push(String(apiData.request.request_number).trim())
  }

  const request: PDFRequestData = {
    id: apiData.request.id,
    title: apiData.request.title,
    request_number: requestNumbers.join(', '),
    created_at: apiData.request.created_at,
    status: apiData.request.status || 'Bilinmiyor',
    urgency_level: apiData.request.urgency_level || 'normal',
    material_class: apiData.request.material_class || 'Genel',
    description: apiData.request.description || '',
    site_name: apiData.request.sites?.name || apiData.request.site_name || 'Belirtilmemiş',
    requester_name: apiData.request.profiles?.full_name || '',
    requester_email: apiData.request.profiles?.email || ''
  }

  // Extract orders
  const orders: PDFOrderData[] = (apiData.orders || []).map((order: any) => ({
    id: order.id,
    order_number: order.order_number || '',
    supplier_name: order.suppliers?.name || 'Tedarikçi',
    item_name: order.purchase_request_items?.item_name || 'Malzeme',
    quantity: order.quantity || 0,
    unit: order.purchase_request_items?.unit || 'adet',
    amount: order.amount || 0,
    currency: order.currency || 'TRY',
    delivery_date: order.delivery_date,
    created_at: order.created_at,
    ordered_by: order.profiles?.full_name || order.profiles?.email || 'Purchasing Officer'
  }))

  // Extract invoices
  const invoices: PDFInvoiceData[] = (apiData.invoices || []).map((invoice: any) => ({
    id: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    created_at: invoice.created_at,
    notes: invoice.notes,
    supplier_name: invoice.orders?.suppliers?.name || invoice.suppliers?.name || invoice.supplier_name || 'Tedarikçi',
    item_name: invoice.orders?.purchase_request_items?.item_name || invoice.purchase_request_items?.item_name || invoice.item_name || 'Malzeme',
    added_by: invoice.orders?.profiles?.full_name || invoice.orders?.profiles?.email || invoice.added_by_user?.full_name || invoice.added_by_user?.email || invoice.added_by || 'Purchasing Officer',
    // Fatura detayları - invoices tablosundan gelen
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax: invoice.tax,
    grand_total: invoice.grand_total,
    // Toplu fatura için invoice_group_id'yi ekle
    invoice_group_id: invoice.invoice_group_id || null
  } as any))

  // Extract key people from timeline
  const timeline = []
  const timelineData = apiData.timeline || []

  const creationItem = timelineData.find((item: any) => item.type === 'creation')
  const requesterName =
    creationItem?.actor ||
    request.requester_name ||
    request.requester_email ||
    ''

  if (requesterName) {
    timeline.push({
      person_name: requesterName,
      person_role: 'Talep Eden',
      action: 'Talebi Oluşturdu',
      date: creationItem?.date || request.created_at
    })
  }

  const approvalItems = timelineData.filter((item: any) => item.type === 'approval')
  const approvalItem = approvalItems[approvalItems.length - 1]
  
  if (approvalItem) {
    timeline.push({
      person_name: approvalItem.actor || 'Site Manager',
      person_role: 'Site Manager',
      action: 'Talebi Onayladı',
      date: approvalItem.date
    })
  }

  const orderItem = timelineData.find((item: any) => item.type === 'order')
  
  if (orderItem) {
    timeline.push({
      person_name: orderItem.order_data?.ordered_by || orderItem.actor || 'Purchasing Officer',
      person_role: 'Purchasing Officer',
      action: 'Sipariş Oluşturdu',
      date: orderItem.date
    })
  }

  const deliveredOrder = (apiData.orders || []).find((order: any) => 
    order.actual_delivered_at && order.delivered_by_user
  )
  
  if (deliveredOrder && deliveredOrder.actual_delivered_at) {
    const deliveryUser = deliveredOrder.delivered_by_user
    const deliveryPerson = deliveryUser?.full_name || deliveryUser?.email
    
    if (deliveryPerson) {
      timeline.push({
        person_name: deliveryPerson,
        person_role: 'Teslim Alan',
        action: 'Teslimat Alındı',
        date: deliveredOrder.actual_delivered_at
      })
    }
  }

  return {
    request,
    orders,
    invoices,
    statistics: apiData.statistics,
    timeline: timeline.length > 0 ? timeline : undefined
  }
}

/**
 * Main export function - Generate PDF from API data
 */
export const generatePDFReport = async (apiData: any): Promise<void> => {
  const pdfData = transformToPDFData(apiData)
  await generatePDF(pdfData)
}

