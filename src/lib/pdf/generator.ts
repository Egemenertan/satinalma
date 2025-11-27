/**
 * Modern, Fast PDF Generator
 * Uses browser's native print functionality for instant PDF generation
 */

import type { PDFData, PDFInvoiceData, PDFOrderData, PDFRequestData } from './types'
import { getPDFStyles } from './styles'
import { buildHeader, buildRequestInfo, buildKeyPeopleTimeline, buildOrders, buildInvoicesList, buildInvoiceSummary } from './components'

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
    ${buildHeader(data.request)}
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
  try {
    console.log('⚡ Fast PDF Generation Started')
    console.log('📊 PDF Data:', {
      request: data.request.title,
      orders: data.orders.length,
      invoices: data.invoices.length,
      hasSubtotal: data.statistics.subtotal !== undefined,
      hasDiscount: data.statistics.discount !== undefined && data.statistics.discount > 0,
      hasTax: data.statistics.tax !== undefined && data.statistics.tax > 0,
      subtotal: data.statistics.subtotal,
      discount: data.statistics.discount,
      tax: data.statistics.tax,
      grandTotal: data.statistics.grandTotal,
      fullStatistics: data.statistics
    })
    
    console.log('💰 Invoice Summary Debug:', {
      invoicesCount: data.invoices.length,
      invoicesTotalAmount: data.invoices.reduce((sum, inv) => sum + inv.amount, 0),
      statisticsSubtotal: data.statistics.subtotal,
      statisticsDiscount: data.statistics.discount,
      statisticsTax: data.statistics.tax,
      statisticsGrandTotal: data.statistics.grandTotal,
      willShowBreakdown: !!(data.statistics.discount || data.statistics.tax || data.statistics.subtotal !== undefined)
    })
    
    console.log('📝 Invoice Notes Debug:', {
      invoicesWithNotes: data.invoices.filter(inv => inv.notes).length,
      allInvoices: data.invoices.map(inv => ({
        id: inv.id.substring(0, 8),
        amount: inv.amount,
        currency: inv.currency,
        supplier: inv.supplier_name,
        item: inv.item_name,
        hasNotes: !!inv.notes,
        notes: inv.notes
      }))
    })
    
    console.log('📦 Orders Debug:', {
      ordersCount: data.orders.length,
      allOrders: data.orders.map(order => ({
        id: order.id.substring(0, 8),
        amount: order.amount,
        currency: order.currency,
        supplier: order.supplier_name,
        item: order.item_name
      }))
    })

    // Generate HTML
    const htmlContent = generatePDFHTML(data)

    // Create hidden iframe for printing
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.top = '-99999px'
    iframe.style.left = '-99999px'
    iframe.style.width = '210mm'
    iframe.style.height = '297mm'
    iframe.style.border = 'none'
    
    document.body.appendChild(iframe)

    // Get iframe document
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      throw new Error('Iframe document not accessible')
    }

    // Write HTML to iframe
    iframeDoc.open()
    iframeDoc.write(htmlContent)
    iframeDoc.close()

    // Wait for resources to load
    await new Promise<void>((resolve) => {
      if (iframe.contentWindow) {
        iframe.contentWindow.onload = () => {
          // Small delay to ensure all styles are applied
          setTimeout(() => resolve(), 100)
        }
      } else {
        setTimeout(() => resolve(), 100)
      }
    })

    // Trigger print dialog
    console.log('🖨️ Opening print dialog...')
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    // Cleanup after print dialog is closed
    setTimeout(() => {
      document.body.removeChild(iframe)
      console.log('✅ PDF generation complete, iframe cleaned up')
    }, 1000)

  } catch (error) {
    console.error('❌ PDF generation error:', error)
    throw error
  }
}

/**
 * Transform API data to PDF data format
 */
export const transformToPDFData = (apiData: any): PDFData => {
  // Extract request info
  const request: PDFRequestData = {
    id: apiData.request.id,
    title: apiData.request.title,
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
    supplier_name: invoice.orders?.suppliers?.name || invoice.suppliers?.name || 'Tedarikçi',
    item_name: invoice.orders?.purchase_request_items?.item_name || invoice.purchase_request_items?.item_name || 'Malzeme',
    added_by: invoice.orders?.profiles?.full_name || invoice.orders?.profiles?.email || invoice.added_by_user?.full_name || invoice.added_by_user?.email || 'Purchasing Officer'
  }))

  // Extract key people from timeline
  const timeline = []
  const timelineData = apiData.timeline || []

  console.log('🕐 Timeline Debug:', {
    hasTimeline: !!apiData.timeline,
    timelineLength: timelineData.length,
    timelineItems: timelineData.map((item: any) => ({
      type: item.type,
      action: item.action,
      actor: item.actor
    }))
  })

  // 1. Site Manager - Onaylayan (birden fazla approval olabilir, en son onayanı al)
  const approvalItems = timelineData.filter((item: any) => item.type === 'approval')
  const approvalItem = approvalItems[approvalItems.length - 1] // Son onay
  
  console.log('🔍 Approval Item:', approvalItem)
  
  if (approvalItem) {
    timeline.push({
      person_name: approvalItem.actor || 'Site Manager',
      person_role: 'Site Manager',
      action: 'Talebi Onayladı',
      date: approvalItem.date
    })
  }

  // 2. Purchasing Officer - Sipariş oluşturan
  const orderItem = timelineData.find((item: any) => item.type === 'order')
  
  console.log('🔍 Order Item:', {
    found: !!orderItem,
    actor: orderItem?.actor,
    ordered_by: orderItem?.order_data?.ordered_by
  })
  
  if (orderItem) {
    timeline.push({
      person_name: orderItem.order_data?.ordered_by || orderItem.actor || 'Purchasing Officer',
      person_role: 'Purchasing Officer',
      action: 'Sipariş Oluşturdu',
      date: orderItem.date
    })
  }

  // 3. Teslim Alan - order_deliveries tablosundan
  const deliveredOrder = (apiData.orders || []).find((order: any) => 
    order.actual_delivered_at && order.delivered_by_user
  )
  
  console.log('🔍 Delivery from order_deliveries:', {
    found: !!deliveredOrder,
    actual_delivered_at: deliveredOrder?.actual_delivered_at,
    delivered_by_user: deliveredOrder?.delivered_by_user,
    allOrders: (apiData.orders || []).map((o: any) => ({
      id: o.id?.substring(0, 8),
      actual_delivered_at: o.actual_delivered_at,
      has_delivered_by_user: !!o.delivered_by_user
    }))
  })
  
  if (deliveredOrder && deliveredOrder.actual_delivered_at) {
    const deliveryUser = deliveredOrder.delivered_by_user
    const deliveryPerson = deliveryUser?.full_name || deliveryUser?.email
    
    console.log('📅 Teslimat Bilgileri:', {
      person: deliveryPerson,
      date: deliveredOrder.actual_delivered_at,
      formatted: new Date(deliveredOrder.actual_delivered_at).toLocaleDateString('tr-TR')
    })
    
    if (deliveryPerson) {
      timeline.push({
        person_name: deliveryPerson,
        person_role: 'Teslim Alan',
        action: 'Teslimat Alındı',
        date: deliveredOrder.actual_delivered_at
      })
    }
  }

  console.log('✅ Extracted Key People:', {
    timelineCount: timeline.length,
    people: timeline
  })

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

