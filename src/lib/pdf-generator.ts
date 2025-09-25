// Modern PDF generator using HTML and print CSS

export interface TimelineItem {
  date: string
  action: string
  actor: string
  details: string
  type: string
  shipment_data?: {
    quantity: number
    item_name: string
    unit: string
    shipped_by: string
    shipped_by_role?: string
  }
  order_data?: {
    supplier_name: string
    amount: number
    currency: string
    delivery_date: string
    item_name: string
    ordered_by: string
    ordered_by_role?: string
  }
  invoice_data?: {
    supplier_name: string
    amount: number
    currency: string
    item_name: string
    added_by: string
    added_by_role?: string
    notes?: string
  }
}

export interface ReportData {
  request: {
    id: string
    title: string
    created_at: string
    status: string
    urgency_level: string
    material_class: string
    description: string
    site_name: string
    profiles?: {
      full_name?: string
      email?: string
      role?: string
    }
    sites?: {
      name: string
    }
    purchase_request_items?: Array<{
      item_name: string
      quantity: number
      unit: string
      description?: string
    }>
  }
  timeline: TimelineItem[]
  shipments?: Array<{
    id: string
    shipped_quantity: number
    shipped_at: string
    notes?: string
    purchase_request_items?: {
      item_name: string
      unit: string
    }
    shipped_by_user?: {
      full_name?: string
      email?: string
      role?: string
    }
  }>
  orders?: Array<{
    id: string
    amount: number
    currency: string
    delivery_date?: string
    created_at: string
    delivered_at?: string
    delivery_notes?: string
    status?: string
    suppliers?: {
      name: string
    }
    purchase_request_items?: {
      item_name: string
      unit?: string
    }
    profiles?: {
      full_name?: string
      email?: string
      role?: string
    }
  }>
  invoices?: Array<{
    id: string
    amount: number
    currency: string
    created_at: string
    notes?: string
    orders?: {
      suppliers?: {
        name: string
      }
      purchase_request_items?: {
        item_name: string
      }
      profiles?: {
        full_name?: string
        email?: string
        role?: string
      }
    }
    // Backward compatibility
    suppliers?: {
      name: string
    }
    purchase_request_items?: {
      item_name: string
    }
    added_by_user?: {
      full_name?: string
      email?: string
      role?: string
    }
  }>
  statistics: {
    totalDays: number
    totalOffers: number
    totalShipments: number
    totalInvoices: number
    totalAmount: number
    currency: string
  }
}

// Professional corporate PDF CSS
const getPDFStyles = () => `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  @page {
    size: A4;
    margin: 0;
    background: white;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 10px;
    line-height: 1.4;
    color: #000000;
    background: white;
    -webkit-print-color-adjust: exact;
    color-adjust: exact;
  }
  
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm;
    background: white;
    display: block;
    margin: 0 auto;
    page-break-after: always;
  }
  
  .page:last-child {
    page-break-after: avoid;
  }
  
  /* Header Styles */
  .header {
    background: white;
    color: black;
    padding: 15px 0;
    margin-bottom: 20px;
    border-bottom: 2px solid #000000;
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .logo-section {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .logo {
    width: 85px;
    height: 85px;
    object-fit: contain;
    max-width: 85px;
    max-height: 85px;
    display: block;
  }
  
  .header-title {
    font-size: 12px;
    font-weight: 700;
    color: #000000;
    margin-bottom: 3px;
  }
  
  .header-subtitle {
    font-size: 10px;
    color: #333333;
  }
  
  .header-date {
    text-align: right;
    font-size: 9px;
    color: #333333;
  }
  
  /* Section Styles */
  .section {
    margin-bottom: 20px;
  }
  
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #000000;
    background: #f5f5f5;
    padding: 8px 12px;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  /* Info Card Styles */
  .info-card {
    background: white;
    padding: 15px;
  }
  
  .info-row {
    display: flex;
    margin-bottom: 8px;
    align-items: flex-start;
  }
  
  .info-row:last-child {
    margin-bottom: 0;
  }
  
  .info-label {
    width: 120px;
    font-size: 9px;
    font-weight: 600;
    color: #333333;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  
  .info-value {
    flex: 1;
    font-size: 10px;
    color: #000000;
    font-weight: 400;
  }
  
  .status-value {
    font-weight: 600;
  }
  
  /* Material Styles */
  .material-container {
    margin-top: 10px;
  }
  
  .material-item {
    background: #f8f9fa;
    padding: 12px;
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border: 1px solid #e9ecef;
  }
  
  .material-number {
    background: #000000;
    color: white;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }
  
  .material-content {
    flex: 1;
  }
  
  .material-name {
    font-size: 11px;
    font-weight: 600;
    color: #000000;
    margin-bottom: 4px;
  }
  
  .material-details {
    font-size: 9px;
    color: #333333;
    margin-bottom: 2px;
  }
  
  /* Statistics Styles */
  .stats-container {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
  }
  
  .stat-card {
    background: #fafafa;
    padding: 12px;
    flex: 1;
    text-align: center;
  }
  
  .stat-value {
    font-size: 14px;
    font-weight: 700;
    color: #000000;
    margin-bottom: 3px;
  }
  
  .stat-label {
    font-size: 8px;
    color: #333333;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  
  /* Timeline Styles */
  .timeline-item {
    background: #f8f9fa;
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid #e9ecef;
    border-left: 3px solid #000000;
  }
  
  .timeline-item.shipment {
    border-left-color: #666666;
    background: #f8f9fa;
  }
  
  .timeline-item.approval {
    border-left-color: #666666;
    background: #f8f9fa;
  }
  
  .timeline-item.order {
    border-left-color: #000000;
    background: #f8f9fa;
  }
  
  .timeline-item.invoice {
    border-left-color: #666666;
    background: #f8f9fa;
  }
  
  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }
  
  .timeline-action {
    font-size: 10px;
    font-weight: 600;
    color: #000000;
    flex: 1;
  }
  
  .timeline-date {
    font-size: 8px;
    color: #333333;
    background: #f0f0f0;
    padding: 2px 6px;
  }
  
  .timeline-actor {
    font-size: 8px;
    color: #333333;
    font-weight: 500;
    margin-bottom: 3px;
  }
  
  .timeline-details {
    font-size: 9px;
    color: #000000;
    line-height: 1.3;
  }
  
  /* Shipment Styles (Unused - removed from PDF) */
  .shipment-container {
    margin-top: 10px;
  }
  
  .shipment-item {
    background: #f8f9fa;
    padding: 12px;
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border: 1px solid #e9ecef;
  }
  
  .shipment-icon {
    background: #000000;
    color: white;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }
  
  .shipment-content {
    flex: 1;
  }
  
  .shipment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }
  
  .shipment-material {
    font-size: 11px;
    font-weight: 600;
    color: #000000;
  }
  
  .shipment-date {
    font-size: 8px;
    color: #666666;
    background: #f1f3f4;
    padding: 2px 6px;
  }
  
  .shipment-details {
    font-size: 9px;
    color: #333333;
    margin-bottom: 2px;
  }
  
  .shipment-user {
    font-size: 8px;
    color: #666666;
    font-weight: 500;
  }
  
  /* Order Styles */
  .order-container {
    margin-top: 10px;
  }
  
  .order-item {
    background: #f8f9fa;
    padding: 12px;
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border: 1px solid #e9ecef;
  }
  
  .order-icon {
    background: #000000;
    color: white;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }
  
  .order-content {
    flex: 1;
  }
  
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }
  
  .order-supplier {
    font-size: 11px;
    font-weight: 600;
    color: #000000;
  }
  
  .order-date {
    font-size: 8px;
    color: #666666;
    background: #f1f3f4;
    padding: 2px 6px;
  }
  
  .order-details {
    font-size: 9px;
    color: #333333;
    margin-bottom: 2px;
  }
  
  .order-details.delivery-status {
    color: #333333;
    font-weight: 500;
  }
  
  .order-user {
    font-size: 8px;
    color: #666666;
    font-weight: 500;
  }

  /* Invoice Styles */
  .invoice-container {
    margin-top: 10px;
  }
  
  .invoice-item {
    background: #f8f9fa;
    padding: 12px;
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border: 1px solid #e9ecef;
  }
  
  .invoice-icon {
    background: #000000;
    color: white;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }
  
  .invoice-content {
    flex: 1;
  }
  
  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }
  
  .invoice-supplier {
    font-size: 11px;
    font-weight: 600;
    color: #000000;
  }
  
  .invoice-date {
    font-size: 8px;
    color: #666666;
    background: #f1f3f4;
    padding: 2px 6px;
  }
  
  .invoice-details {
    font-size: 9px;
    color: #333333;
    margin-bottom: 2px;
  }
  
  .invoice-user {
    font-size: 8px;
    color: #666666;
    font-weight: 500;
  }
  
  /* Description Styles */
  .description {
    background: #fafafa;
    padding: 12px;
    font-size: 10px;
    color: #000000;
    line-height: 1.4;
  }
  
  /* Footer Styles */
  .footer {
    position: fixed;
    bottom: 10mm;
    left: 15mm;
    right: 15mm;
    border-top: 1px solid #cccccc;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    color: #333333;
  }
  
  .footer-center {
    font-weight: 500;
  }
  
  /* Statistics Styles */
  .stats-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 10px;
  }
  
  .stat-card {
    background: #f8f9fa;
    padding: 12px;
    text-align: center;
    border: 1px solid #e9ecef;
  }
  
  .stat-value {
    font-size: 14px;
    font-weight: 700;
    color: #000000;
    margin-bottom: 4px;
  }
  
  .stat-label {
    font-size: 8px;
    color: #666666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Print Specific */
  @media print {
    .page {
      margin: 0;
    }
    
    .material-item,
    .timeline-item {
      page-break-inside: avoid;
    }
  }
</style>
`

// HTML Template Generator
const generatePDFHTML = (data: ReportData): string => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReportDate = () => {
    return new Date().toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Supabase storage'dan logo URL'i oluştur
  const getLogoUrl = () => {
    // Doğru Supabase URL'i
    const publicUrl = 'https://yxzmxfwpgsqabtamnfql.supabase.co/storage/v1/object/public/satinalma/dovecb.png'
    
    // Fallback: Local public klasöründeki logo
    const fallbackUrl = '/d.png'
    
    console.log('PDF Logo URL test:', publicUrl)
    
    // Test için önce public URL'i kullanelim
    return publicUrl
  }

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Satın Alma Talebi Raporu - REQ-${data.request.id.slice(0, 8)}</title>
  ${getPDFStyles()}
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <div class="logo-section">
          <img src="${getLogoUrl()}" alt="DOVEC Logo" class="logo" onerror="this.onerror=null; this.src='/d.png';" />
          <div>
            <div class="header-title">SATIN ALMA TALEBİ RAPORU</div>
            <div class="header-subtitle">İnşaat Malzeme Yönetim Sistemi</div>
          </div>
        </div>
        <div class="header-date">
          <div>Rapor Tarihi:</div>
          <div>${getReportDate()}</div>
        </div>
      </div>
    </div>

    <!-- Talep Bilgileri -->
    <div class="section">
      <div class="section-title">TALEP BİLGİLERİ</div>
      <div class="info-card">
        <div class="info-row">
          <div class="info-label">TALEP NO</div>
          <div class="info-value">REQ-${data.request.id.slice(0, 8)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">BAŞLIK</div>
          <div class="info-value">${data.request.title}</div>
        </div>
        <div class="info-row">
          <div class="info-label">DURUM</div>
          <div class="info-value status-value">${data.request.status.toUpperCase()}</div>
        </div>
        
        <div class="info-row">
          <div class="info-label">ŞANTİYE</div>
          <div class="info-value">${data.request.sites?.name || data.request.site_name || 'Belirtilmemiş'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">TALEP EDEN</div>
          <div class="info-value">${data.request.profiles?.full_name || data.request.profiles?.email || 'Bilinmeyen'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">OLUŞTURULMA</div>
          <div class="info-value">${formatDate(data.request.created_at)}</div>
        </div>
      </div>
    </div>


    ${data.request.purchase_request_items && data.request.purchase_request_items.length > 0 ? `
    <!-- Malzemeler -->
    <div class="section">
      <div class="section-title">TALEP EDİLEN MALZEMELER</div>
      <div class="material-container">
        ${data.request.purchase_request_items.map((item, index) => `
          <div class="material-item">
            <div class="material-number">${index + 1}</div>
            <div class="material-content">
              <div class="material-name">${item.item_name}</div>
              <div class="material-details">Miktar: ${item.quantity} ${item.unit}</div>
              ${item.description ? `<div class="material-details">Açıklama: ${item.description}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}


    ${(() => {
      console.log('📦 PDF Generator Orders Debug:', {
        hasOrders: !!data.orders,
        ordersLength: data.orders?.length || 0,
        ordersData: data.orders,
        requestId: data.request.id,
        ordersArray: Array.isArray(data.orders),
        ordersType: typeof data.orders,
        ordersKeys: data.orders ? Object.keys(data.orders) : 'null'
      })
      console.log('📦 Raw Orders Data:', data.orders)
      console.log('📦 Full Timeline Data Keys:', Object.keys(data))
      return data.orders && data.orders.length > 0
    })() ? `
    <!-- Siparişler -->
    <div class="section">
      <div class="section-title">SİPARİŞLER</div>
      <div class="order-container">
        ${data.orders.map((order, index) => `
          <div class="order-item">
            <div class="order-icon">🛒</div>
            <div class="order-content">
              <div class="order-header">
                <div class="order-supplier">${order.suppliers?.name || 'Tedarikçi'} - ${order.purchase_request_items?.item_name || 'Malzeme'}</div>
                <div class="order-date">${formatDate(order.created_at)}</div>
              </div>
              <div class="order-details">Tutar: ${order.amount.toLocaleString('tr-TR')} ${order.currency}</div>
              <div class="order-details">Teslimat Tarihi: ${order.delivery_date ? formatDate(order.delivery_date) : 'Belirtilmemiş'}</div>
              <div class="order-user">Sipariş Veren: ${order.profiles?.full_name || order.profiles?.email || 'Purchasing Officer'}</div>
              ${order.delivered_at ? `<div class="order-details delivery-status">✅ Teslim Alındı: ${formatDate(order.delivered_at)}</div>` : ''}
              ${order.delivery_notes ? `<div class="order-details">Teslimat Notu: ${order.delivery_notes}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}


    <!-- İstatistikler -->
    <div class="section">
      <div class="section-title">İSTATİSTİKLER</div>
      <div class="stats-container">
        <div class="stat-card">
          <div class="stat-value">${data.statistics.totalDays} gün</div>
          <div class="stat-label">Toplam İşlem Süresi</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.statistics.totalOffers}</div>
          <div class="stat-label">Alınan Teklif Sayısı</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.statistics.totalShipments || 0}</div>
          <div class="stat-label">Şantiye Gönderimi</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.orders?.length || 0}</div>
          <div class="stat-label">Sipariş Sayısı</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.statistics.totalInvoices || 0}</div>
          <div class="stat-label">Fatura Sayısı</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.statistics.totalAmount.toLocaleString('tr-TR')} ${data.statistics.currency}</div>
          <div class="stat-label">Toplam Tutar</div>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="section">
      <div class="section-title">TALEBİN ZAMAN ÇİZELGESİ</div>
      ${data.timeline.map((item, index) => `
        <div class="timeline-item ${item.type === 'shipment' ? 'shipment' : item.type === 'approval' ? 'approval' : item.type === 'order' ? 'order' : item.type === 'invoice' ? 'invoice' : ''}">
          <div class="timeline-header">
            <div class="timeline-action">${index + 1}. ${item.action}${item.type === 'shipment' ? ' 📦' : item.type === 'approval' ? ' ✅' : item.type === 'order' ? ' 🛒' : item.type === 'invoice' ? ' 🧾' : ''}</div>
            <div class="timeline-date">${formatDate(item.date)}</div>
          </div>
          <div class="timeline-actor">Kullanıcı: ${item.actor}</div>
          <div class="timeline-details">Detay: ${item.details}</div>
          ${item.shipment_data ? `
            <div class="timeline-details" style="margin-top: 4px; font-weight: 500;">
              ↳ Malzeme: ${item.shipment_data.item_name} (${item.shipment_data.quantity} ${item.shipment_data.unit})
            </div>
          ` : ''}
          ${item.order_data ? `
            <div class="timeline-details" style="margin-top: 4px; font-weight: 500;">
              ↳ Tedarikçi: ${item.order_data.supplier_name} | Malzeme: ${item.order_data.item_name}
            </div>
            <div class="timeline-details" style="margin-top: 2px; font-weight: 500;">
              ↳ Tutar: ${item.order_data.amount.toLocaleString('tr-TR')} ${item.order_data.currency} | Teslimat: ${formatDate(item.order_data.delivery_date)}
            </div>
          ` : ''}
          ${item.invoice_data ? `
            <div class="timeline-details" style="margin-top: 4px; font-weight: 500;">
              ↳ Fatura: ${item.invoice_data.supplier_name} | ${item.invoice_data.item_name}
            </div>
            <div class="timeline-details" style="margin-top: 2px; font-weight: 500;">
              ↳ Tutar: ${item.invoice_data.amount.toLocaleString('tr-TR')} ${item.invoice_data.currency}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Faturalar (En Alt) -->
    ${(() => {
      console.log('💰 PDF Generator Invoices Debug:', {
        hasInvoices: !!data.invoices,
        invoicesLength: data.invoices?.length || 0,
        invoicesData: data.invoices,
        requestId: data.request.id
      })
      console.log('💰 Raw Invoices Data:', data.invoices)
      return data.invoices && data.invoices.length > 0
    })() ? `
    <div class="section">
      <div class="section-title">FATURALAR</div>
      <div class="invoice-container">
        ${data.invoices.map((invoice, index) => `
          <div class="invoice-item">
            <div class="invoice-icon">🧾</div>
            <div class="invoice-content">
              <div class="invoice-header">
                <div class="invoice-supplier">${invoice.orders?.suppliers?.name || 'Tedarikçi'} - ${invoice.orders?.purchase_request_items?.item_name || 'Malzeme'}</div>
                <div class="invoice-date">${formatDate(invoice.created_at)}</div>
              </div>
              <div class="invoice-details">Tutar: ${invoice.amount.toLocaleString('tr-TR')} ${invoice.currency}</div>
              <div class="invoice-user">Ekleyen: ${invoice.orders?.profiles?.full_name || invoice.orders?.profiles?.email || 'Purchasing Officer'}</div>
              ${invoice.notes ? `<div class="invoice-details">Not: ${invoice.notes}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div>Bu rapor sistem tarafından otomatik olarak oluşturulmuştur.</div>
      <div class="footer-center">İnşaat Malzeme Yönetim Sistemi - DOVEC</div>
      <div>Sayfa 1</div>
    </div>
  </div>
</body>
</html>
  `
}

// PDF Generator Function
export const generatePurchaseRequestReport = async (data: ReportData): Promise<void> => {
  try {
    // HTML content oluştur
    const htmlContent = generatePDFHTML(data)
    
    // Yeni pencere aç
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      throw new Error('Pop-up engellendi. Lütfen pop-up engelleyicisini devre dışı bırakın.')
    }
    
    // HTML'i yaz
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // Print dialog'u aç
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 500)
    }
    
  } catch (error) {
    console.error('PDF oluşturma hatası:', error)
    throw new Error('PDF oluşturulurken bir hata oluştu: ' + (error as Error).message)
  }
}