/**
 * PDF HTML Component Builders
 */

import type { PDFRequestData, PDFOrderData, PDFInvoiceData, PDFStatistics, PDFTimelineItem } from './types'

/**
 * Format date to Turkish locale
 */
const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

/**
 * Format number to Turkish locale
 */
const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Header Component - With Logo Only
 */
export const buildHeader = (request: PDFRequestData): string => `
  <div class="header">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <img src="/d.png" alt="Logo" style="height: 40px; width: auto; filter: brightness(0);" />
      <div style="text-align: right;">
        <div style="font-size: 11pt; color: #333; font-weight: 600;">
          ${request.title}
        </div>
      </div>
    </div>
  </div>
`

/**
 * Request Info Component
 */
export const buildRequestInfo = (request: PDFRequestData): string => `
  <div class="section">
    <div class="section-title">Talep Bilgileri</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Talep Başlığı:</span>
        <span class="info-value">${request.title}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Şantiye:</span>
        <span class="info-value">${request.site_name || 'Belirtilmemiş'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Talep Eden:</span>
        <span class="info-value">${request.requester_name || request.requester_email || 'Bilinmiyor'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Oluşturulma:</span>
        <span class="info-value">${formatDate(request.created_at)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Malzeme Sınıfı:</span>
        <span class="info-value">${request.material_class || 'Belirtilmemiş'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Durum:</span>
        <span class="info-value">${request.status}</span>
      </div>
    </div>
    ${request.description ? `
      <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
        <strong>Açıklama:</strong> ${request.description}
      </div>
    ` : ''}
  </div>
`

/**
 * Key People Timeline Component - Sadece 3 önemli kişi
 */
export const buildKeyPeopleTimeline = (timeline?: PDFTimelineItem[]): string => {
  if (!timeline || timeline.length === 0) {
    return ''
  }

  return `
    <div class="section">
      <div class="section-title">Süreç Özeti</div>
      <div class="timeline-grid">
        ${timeline.map(item => `
          <div class="timeline-card">
            <div class="timeline-person">${item.person_name}</div>
            <div class="timeline-action">${item.action}</div>
            <div class="timeline-date">${formatDate(item.date)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

/**
 * Orders Component
 */
export const buildOrders = (orders: PDFOrderData[]): string => {
  if (!orders || orders.length === 0) {
    return '<div class="section"><div class="section-title">Siparişler</div><div class="no-data">Sipariş bulunamadı</div></div>'
  }

  return `
    <div class="section">
      <div class="section-title">Siparişler</div>
      <table class="orders-table">
        <thead>
          <tr>
            <th>Tedarikçi</th>
            <th>Malzeme</th>
            <th>Miktar</th>
            <th>Sipariş Tarihi</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td>${order.supplier_name}</td>
              <td>${order.item_name}</td>
              <td>${order.quantity} ${order.unit || 'adet'}</td>
              <td>${formatDate(order.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

/**
 * Invoices List Component
 */
export const buildInvoicesList = (invoices: PDFInvoiceData[]): string => {
  if (!invoices || invoices.length === 0) {
    return '<div class="section"><div class="section-title">Faturalar</div><div class="no-data">Fatura bulunamadı</div></div>'
  }

  return `
    <div class="section">
      <div class="section-title">Faturalar</div>
      <div class="invoice-list">
        ${invoices.map(invoice => `
          <div class="invoice-item">
            <div class="invoice-header">
              <div class="invoice-supplier">${invoice.supplier_name} - ${invoice.item_name}</div>
              <div class="invoice-date">${formatDate(invoice.created_at)}</div>
            </div>
            <div class="invoice-amount">${formatNumber(invoice.amount)} ${invoice.currency}</div>
            <div class="invoice-meta">Ekleyen: ${invoice.added_by}</div>
            ${invoice.notes ? `<div class="invoice-notes"><strong>Not:</strong> ${invoice.notes}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `
}

/**
 * Invoice Summary Component - THE MAIN FIX
 */
export const buildInvoiceSummary = (invoices: PDFInvoiceData[], statistics: PDFStatistics): string => {
  if (!invoices || invoices.length === 0) {
    return ''
  }

  // Calculate subtotal from invoices
  const calculatedSubtotal = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const currency = invoices[0]?.currency || statistics.currency || 'TRY'

  // Use statistics if available, otherwise use calculated values
  const subtotal = statistics.subtotal ?? calculatedSubtotal
  const discount = statistics.discount ?? 0
  const tax = statistics.tax ?? 0
  const grandTotal = statistics.grandTotal ?? (subtotal - discount + tax)

  const hasBreakdown = (discount > 0 || tax > 0 || statistics.subtotal !== undefined)

  console.log('🧾 Building Invoice Summary:', {
    invoicesCount: invoices.length,
    calculatedSubtotal,
    statisticsSubtotal: statistics.subtotal,
    statisticsDiscount: statistics.discount,
    statisticsTax: statistics.tax,
    statisticsGrandTotal: statistics.grandTotal,
    finalSubtotal: subtotal,
    finalDiscount: discount,
    finalTax: tax,
    finalGrandTotal: grandTotal,
    hasBreakdown,
    currency
  })

  return `
    <div class="invoice-summary">
      <div class="invoice-summary-title">Fatura Özeti</div>
      
      ${invoices.map(invoice => `
        <div class="summary-row">
          <span class="summary-label">${invoice.supplier_name} - ${invoice.item_name}</span>
          <span class="summary-value">${formatNumber(invoice.amount)} ${invoice.currency}</span>
        </div>
      `).join('')}
      
      ${hasBreakdown ? `
        <div class="summary-row subtotal">
          <span class="summary-label">Ara Toplam</span>
          <span class="summary-value">${formatNumber(subtotal)} ${currency}</span>
        </div>
        
        ${discount > 0 ? `
          <div class="summary-row discount">
            <span class="summary-label">İndirim</span>
            <span class="summary-value">-${formatNumber(discount)} ${currency}</span>
          </div>
        ` : ''}
        
        ${tax > 0 ? `
          <div class="summary-row tax">
            <span class="summary-label">KDV</span>
            <span class="summary-value">+${formatNumber(tax)} ${currency}</span>
          </div>
        ` : ''}
      ` : ''}
      
      <div class="summary-row total">
        <span class="summary-label">Genel Toplam</span>
        <span class="summary-value">${formatNumber(grandTotal)} ${currency}</span>
      </div>
    </div>
  `
}

