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
 * Toplu faturaları grupla ve tek fatura olarak göster
 */
export const buildInvoicesList = (invoices: PDFInvoiceData[]): string => {
  if (!invoices || invoices.length === 0) {
    return '<div class="section"><div class="section-title">Faturalar</div><div class="no-data">Fatura bulunamadı</div></div>'
  }

  // Faturaları invoice_group_id'ye göre grupla
  const groupedInvoices = new Map<string, PDFInvoiceData[]>()
  const standaloneInvoices: PDFInvoiceData[] = []
  
  invoices.forEach(invoice => {
    const groupId = (invoice as any).invoice_group_id
    if (groupId) {
      if (!groupedInvoices.has(groupId)) {
        groupedInvoices.set(groupId, [])
      }
      groupedInvoices.get(groupId)!.push(invoice)
    } else {
      standaloneInvoices.push(invoice)
    }
  })
  
  console.log('📋 Fatura Gruplama:', {
    topluFaturaGrupSayisi: groupedInvoices.size,
    tekFaturaSayisi: standaloneInvoices.length,
    toplamFatura: invoices.length
  })

  return `
    <div class="section">
      <div class="section-title">Faturalar</div>
      <div class="invoice-list">
        ${Array.from(groupedInvoices.entries()).map(([groupId, groupInvoices]) => {
          // Toplu fatura için - breakdown bilgilerini topla
          const firstInvoice = groupInvoices[0]
          const materialCount = groupInvoices.length
          const currency = firstInvoice.currency
          
          // Breakdown var mı kontrol et
          const hasBreakdown = groupInvoices.some(inv => 
            (inv.subtotal !== null && inv.subtotal !== undefined) ||
            (inv.discount !== null && inv.discount !== undefined) ||
            (inv.tax !== null && inv.tax !== undefined)
          )
          
          const totalSubtotal = groupInvoices.reduce((sum, inv) => sum + (inv.subtotal || inv.amount), 0)
          const totalDiscount = groupInvoices.reduce((sum, inv) => sum + (inv.discount || 0), 0)
          const totalTax = groupInvoices.reduce((sum, inv) => sum + (inv.tax || 0), 0)
          const totalGrandTotal = groupInvoices.reduce((sum, inv) => sum + (inv.grand_total || inv.amount), 0)
          
            return `
              <div class="invoice-item">
                <div class="invoice-header">
                  <div class="invoice-supplier">
                    <strong>Toplu Fatura</strong> - ${materialCount} Malzeme
                  </div>
                  <div class="invoice-date">${formatDate(firstInvoice.created_at)}</div>
                </div>
                
                ${hasBreakdown ? `
                  <div class="invoice-breakdown">
                    <div>Ara Toplam: ${formatNumber(totalSubtotal)} ${currency}</div>
                    ${totalDiscount > 0 ? `<div>İndirim: -${formatNumber(totalDiscount)} ${currency}</div>` : ''}
                    ${totalTax > 0 ? `<div>KDV: +${formatNumber(totalTax)} ${currency}</div>` : ''}
                    <div><strong>Toplam: ${formatNumber(totalGrandTotal)} ${currency}</strong></div>
                  </div>
                ` : `
                  <div class="invoice-amount">${formatNumber(totalGrandTotal)} ${currency}</div>
                `}
                
                <div class="invoice-meta">Ekleyen: ${firstInvoice.added_by}</div>
                ${firstInvoice.notes ? `<div class="invoice-notes"><strong>Not:</strong> ${firstInvoice.notes}</div>` : ''}
               
              </div>
            `
        }).join('')}
        
        ${standaloneInvoices.map(invoice => {
          const hasBreakdown = (invoice.subtotal !== null && invoice.subtotal !== undefined) ||
                               (invoice.discount !== null && invoice.discount !== undefined) ||
                               (invoice.tax !== null && invoice.tax !== undefined)
          
          return `
          <div class="invoice-item">
            <div class="invoice-header">
              <div class="invoice-supplier">${invoice.supplier_name} - ${invoice.item_name}</div>
              <div class="invoice-date">${formatDate(invoice.created_at)}</div>
            </div>
              
              ${hasBreakdown ? `
                <div class="invoice-breakdown">
                  <div>Ara Toplam: ${formatNumber(invoice.subtotal || invoice.amount)} ${invoice.currency}</div>
                  ${invoice.discount && invoice.discount > 0 ? `<div>İndirim: -${formatNumber(invoice.discount)} ${invoice.currency}</div>` : ''}
                  ${invoice.tax && invoice.tax > 0 ? `<div>KDV: +${formatNumber(invoice.tax)} ${invoice.currency}</div>` : ''}
                  <div><strong>Toplam: ${formatNumber(invoice.grand_total || invoice.amount)} ${invoice.currency}</strong></div>
                </div>
              ` : `
            <div class="invoice-amount">${formatNumber(invoice.amount)} ${invoice.currency}</div>
              `}
              
            <div class="invoice-meta">Ekleyen: ${invoice.added_by}</div>
            ${invoice.notes ? `<div class="invoice-notes"><strong>Not:</strong> ${invoice.notes}</div>` : ''}
          </div>
          `
        }).join('')}
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

  const currency = invoices[0]?.currency || statistics.currency || 'TRY'
  
  console.log('📊 buildInvoiceSummary - Fatura Özeti:', {
    invoicesCount: invoices.length,
    invoices: invoices.map(inv => ({
      supplier: inv.supplier_name,
      item: inv.item_name,
      amount: inv.amount,
      subtotal: inv.subtotal,
      discount: inv.discount,
      tax: inv.tax,
      grand_total: inv.grand_total,
      invoice_group_id: (inv as any).invoice_group_id
    })),
    statistics: {
      subtotal: statistics.subtotal,
      discount: statistics.discount,
      tax: statistics.tax,
      grandTotal: statistics.grandTotal
    }
  })
  
  // Invoice group var mı kontrol et (statistics'te subtotal/discount/tax varsa)
  const hasInvoiceGroupData = (statistics.subtotal !== undefined && statistics.subtotal !== null) ||
                               (statistics.discount !== undefined && statistics.discount !== null) ||
                               (statistics.tax !== undefined && statistics.tax !== null)
  
  // Invoice group varsa, statistics'teki breakdown'u göster
  if (hasInvoiceGroupData && invoices.length > 1) {
    return `
      <div class="invoice-summary">
        <div class="invoice-summary-title">Fatura Özeti (${invoices.length} Adet - Toplu Fatura)</div>
        
        ${invoices.map((invoice) => `
          <div class="summary-row">
            <span class="summary-label">${invoice.supplier_name} - ${invoice.item_name}</span>
            <span class="summary-value">${formatNumber(invoice.amount)} ${invoice.currency}</span>
          </div>
        `).join('')}
        
        <div class="summary-row subtotal">
          <span class="summary-label">Ara Toplam</span>
          <span class="summary-value">${formatNumber(statistics.subtotal || 0)} ${currency}</span>
        </div>
        
        ${statistics.discount && statistics.discount > 0 ? `
          <div class="summary-row discount">
            <span class="summary-label">İndirim</span>
            <span class="summary-value">-${formatNumber(statistics.discount)} ${currency}</span>
          </div>
        ` : ''}
        
        ${statistics.tax && statistics.tax > 0 ? `
          <div class="summary-row tax">
            <span class="summary-label">KDV</span>
            <span class="summary-value">+${formatNumber(statistics.tax)} ${currency}</span>
          </div>
        ` : ''}
        
        <div class="summary-row total">
          <span class="summary-label">Genel Toplam</span>
          <span class="summary-value">${formatNumber(statistics.grandTotal || 0)} ${currency}</span>
        </div>
      </div>
    `
  }
  
  // Invoice group yoksa, her faturanın kendi grand_total'ini göster
  return `
    <div class="invoice-summary">
      <div class="invoice-summary-title">Fatura Özeti${invoices.length > 1 ? ` (${invoices.length} Adet)` : ''}</div>
      
      ${invoices.map((invoice) => `
        <div class="summary-row">
          <span class="summary-label">${invoice.supplier_name} - ${invoice.item_name}</span>
          <span class="summary-value">${formatNumber(invoice.grand_total || invoice.amount)} ${invoice.currency}</span>
        </div>
      `).join('')}
      
      <div class="summary-row total">
        <span class="summary-label">Genel Toplam</span>
        <span class="summary-value">${formatNumber(invoices.reduce((sum, inv) => sum + (inv.grand_total || inv.amount), 0))} ${currency}</span>
      </div>
    </div>
  `
}

