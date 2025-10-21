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
    quantity: number
    returned_quantity?: number
    return_notes?: string
    is_return_reorder?: boolean
    unit?: string
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
    quantity: number
    returned_quantity?: number
    return_notes?: string
    is_return_reorder?: boolean
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
    invoices?: Array<{
      id: string
      amount: number
      currency: string
      created_at: string
    }>
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

// Minimal Professional PDF CSS
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
    font-size: 11px;
    line-height: 1.5;
    color: #000000;
    background: white;
    -webkit-print-color-adjust: exact;
    color-adjust: exact;
  }
  
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm;
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
    padding: 0 0 15px 0;
    margin-bottom: 25px;
    border-bottom: 1px solid #000000;
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .logo-section {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .logo {
    width: 60px;
    height: 60px;
    object-fit: contain;
    max-width: 60px;
    max-height: 60px;
    display: block;
  }
  
  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: #000000;
    margin-bottom: 4px;
  }
  
  .header-subtitle {
    font-size: 11px;
    color: #666666;
    font-weight: 400;
  }
  
  .header-date {
    text-align: right;
    font-size: 10px;
    color: #666666;
  }
  
  /* Section Styles */
  .section {
    margin-bottom: 15px;
  }
  
  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #000000;
    padding: 0 0 6px 0;
    margin-bottom: 10px;
    border-bottom: 1px solid #e0e0e0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  /* Info Card Styles */
  .info-card {
    background: white;
    padding: 0;
  }
  
  .info-row {
    display: flex;
    margin-bottom: 6px;
    align-items: flex-start;
  }
  
  .info-row:last-child {
    margin-bottom: 0;
  }
  
  .info-label {
    width: 140px;
    font-size: 10px;
    font-weight: 500;
    color: #666666;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  
  .info-value {
    flex: 1;
    font-size: 11px;
    color: #000000;
    font-weight: 400;
  }
  
  .status-value {
    font-weight: 500;
  }
  
  
  /* Statistics Styles - Tek satır */
  .stats-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding: 10px 0;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .stat-label {
    font-size: 11px;
    color: #666666;
    font-weight: 500;
  }
  
  .stat-value {
    font-size: 12px;
    font-weight: 600;
    color: #000000;
    margin-left: 8px;
  }
  
  /* Timeline Styles */
  .timeline-item {
    background: white;
    padding: 15px 0;
    margin-bottom: 12px;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .timeline-item:last-child {
    border-bottom: none;
  }
  
  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  
  .timeline-action {
    font-size: 12px;
    font-weight: 500;
    color: #000000;
    flex: 1;
  }
  
  .timeline-date {
    font-size: 10px;
    color: #666666;
    font-weight: 400;
  }
  
  .timeline-actor {
    font-size: 10px;
    color: #666666;
    font-weight: 400;
    margin-bottom: 4px;
  }
  
  .timeline-details {
    font-size: 11px;
    color: #333333;
    line-height: 1.4;
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
    margin-top: 15px;
  }
  
  .order-item {
    background: white;
    padding: 15px 0;
    margin-bottom: 15px;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .order-item:last-child {
    border-bottom: none;
  }
  
  .order-content {
    width: 100%;
  }
  
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  
  .order-supplier {
    font-size: 12px;
    font-weight: 500;
    color: #000000;
  }
  
  .order-date {
    font-size: 10px;
    color: #666666;
    font-weight: 400;
  }
  
  .order-details {
    font-size: 11px;
    color: #333333;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  
  .order-amount {
    font-size: 14px;
    font-weight: 700;
    color: #000000;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  
  .order-details.delivery-status {
    color: #000000;
    font-weight: 500;
  }
  
  .order-user {
    font-size: 10px;
    color: #666666;
    font-weight: 400;
  }

  /* Invoice Styles */
  .invoice-container {
    margin-top: 15px;
  }
  
  .invoice-item {
    background: white;
    padding: 15px 0;
    margin-bottom: 15px;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .invoice-item:last-child {
    border-bottom: none;
  }
  
  .invoice-content {
    width: 100%;
  }
  
  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  
  .invoice-supplier {
    font-size: 12px;
    font-weight: 500;
    color: #000000;
  }
  
  .invoice-date {
    font-size: 10px;
    color: #666666;
    font-weight: 400;
  }
  
  .invoice-details {
    font-size: 11px;
    color: #333333;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  
  .invoice-amount {
    font-size: 14px;
    font-weight: 700;
    color: #000000;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  
  .invoice-user {
    font-size: 10px;
    color: #666666;
    font-weight: 400;
  }
  
  /* Description Styles */
  .description {
    background: #fafafa;
    padding: 12px;
    font-size: 10px;
    color: #000000;
    line-height: 1.4;
  }
  
  /* Invoice Summary Styles */
  .invoice-summary {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 2px solid #000000;
  }
  
  .invoice-summary-title {
    font-size: 13px;
    font-weight: 600;
    color: #000000;
    margin-bottom: 15px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .invoice-summary-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  .invoice-list {
    flex: 1;
  }
  
  .invoice-summary-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 11px;
    color: #333333;
  }
  
  .invoice-summary-item:last-child {
    margin-bottom: 0;
  }
  
  .invoice-summary-total {
    text-align: right;
    padding-left: 30px;
    border-left: 1px solid #e0e0e0;
    min-width: 200px;
  }
  
  .total-label {
    font-size: 12px;
    color: #666666;
    margin-bottom: 8px;
  }
  
  .total-amount {
    font-size: 18px;
    font-weight: 700;
    color: #000000;
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
    const publicUrl = 'https://yxzmxfwpgsqabtamnfql.supabase.co/storage/v1/object/public/satinalma/dovecbb.png'
    
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
            <div class="order-content">
              <div class="order-header">
                <div class="order-supplier">${order.suppliers?.name || 'Tedarikçi'} - ${order.purchase_request_items?.item_name || 'Malzeme'}</div>
                <div class="order-date">${formatDate(order.created_at)}</div>
              </div>
              <div class="order-details">Miktar: ${order.quantity} ${order.purchase_request_items?.unit || 'adet'}${order.returned_quantity && order.returned_quantity > 0 ? ` - İade: ${order.returned_quantity} ${order.purchase_request_items?.unit || 'adet'}` : ''}</div>
              ${order.return_notes ? `<div class="order-details">İade Nedeni: ${order.return_notes}</div>` : ''}
              ${order.is_return_reorder ? `<div class="order-details" style="color: #333333; font-weight: 500;">İade nedeniyle yeniden sipariş</div>` : ''}
              <div class="order-details">Teslimat Tarihi: ${order.delivery_date ? formatDate(order.delivery_date) : 'Belirtilmemiş'}</div>
              <div class="order-user">Sipariş Veren: ${order.profiles?.full_name || order.profiles?.email || 'Purchasing Officer'}</div>
              ${order.delivered_at ? `<div class="order-details delivery-status">Teslim Alındı: ${formatDate(order.delivered_at)}</div>` : ''}
              ${order.delivery_notes ? `<div class="order-details">Teslimat Notu: ${order.delivery_notes}</div>` : ''}
              ${(() => {
                // Fatura tutarlarını hesapla - EN SONDA
                const totalInvoiceAmount = order.invoices && order.invoices.length > 0 
                  ? order.invoices.reduce((total, invoice) => total + invoice.amount, 0)
                  : 0
                
                if (totalInvoiceAmount > 0) {
                  // Fatura varsa fatura tutarını göster
                  const currency = order.invoices[0].currency || order.currency
                  return `<div class="order-amount">Fatura Tutarı: ${totalInvoiceAmount.toLocaleString('tr-TR')} ${currency}</div>`
                } else {
                  // Fatura yoksa sipariş tutarını göster
                  return `<div class="order-amount">Sipariş Tutarı: ${order.amount.toLocaleString('tr-TR')} ${order.currency}</div>`
                }
              })()}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}


    <!-- İşlem Süresi -->
    <div class="stats-container">
      <span class="stat-label">Toplam İşlem Süresi:</span>
      <span class="stat-value">${data.statistics.totalDays} gün</span>
    </div>

    <!-- Timeline -->
    <div class="section">
      <div class="section-title">TALEBİN ZAMAN ÇİZELGESİ</div>
      ${data.timeline.filter(item => item.type !== 'invoice').map((item, index) => `
        <div class="timeline-item">
          <div class="timeline-header">
            <div class="timeline-action">${index + 1}. ${item.action}</div>
            <div class="timeline-date">${formatDate(item.date)}</div>
          </div>
          <div class="timeline-actor">${item.actor}</div>
          ${(() => {
            // Shipment için details'ı basitleştir - sadece temel bilgi göster
            if (item.type === 'shipment' && item.shipment_data) {
              return `<div class="timeline-details">Malzeme: ${item.shipment_data.item_name} (${item.shipment_data.quantity} ${item.shipment_data.unit}) gönderildi</div>`
            }
            // Order için details'ı basitleştir - miktar ve tedarikçi bilgisi ile
            else if (item.type === 'order' && item.order_data) {
              let orderDetails = `Tedarikçi: ${item.order_data.supplier_name} - ${item.order_data.item_name} (${item.order_data.quantity} ${item.order_data.unit || 'adet'})`
              
              // İade bilgilerini ekle
              if (item.order_data.returned_quantity && item.order_data.returned_quantity > 0) {
                orderDetails += ` - İade: ${item.order_data.returned_quantity} ${item.order_data.unit || 'adet'}`
                if (item.order_data.return_notes) {
                  orderDetails += ` (${item.order_data.return_notes})`
                }
              }
              
              // Yeniden sipariş işareti
              if (item.order_data.is_return_reorder) {
                orderDetails += ' - İade nedeniyle yeniden sipariş'
              }
              
              return `<div class="timeline-details">${orderDetails}</div>`
            }
            // Invoice timeline'dan kaldırıldı - faturalar ayrı bölümde gösteriliyor
            else if (item.type === 'invoice') {
              return '' // Boş string döndür, timeline'da fatura gösterme
            }
            // Diğer durumlar için orijinal details'ı kullan
            else {
              return `<div class="timeline-details">${item.details}</div>`
            }
          })()}
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
            <div class="invoice-content">
              <div class="invoice-header">
                <div class="invoice-supplier">${invoice.orders?.suppliers?.name || 'Tedarikçi'} - ${invoice.orders?.purchase_request_items?.item_name || 'Malzeme'}</div>
                <div class="invoice-date">${formatDate(invoice.created_at)}</div>
              </div>
              <div class="invoice-amount">Tutar: ${invoice.amount.toLocaleString('tr-TR')} ${invoice.currency}</div>
              <div class="invoice-user">Ekleyen: ${invoice.orders?.profiles?.full_name || invoice.orders?.profiles?.email || 'Purchasing Officer'}</div>
              ${invoice.notes ? `<div class="invoice-details">Not: ${invoice.notes}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Fatura Özeti -->
    ${(() => {
      // Tüm fatura tutarlarını topla
      const allInvoices = []
      let totalAmount = 0
      let currency = 'TRY'
      
      // Siparişlerden fatura bilgilerini çek
      if (data.orders && data.orders.length > 0) {
        data.orders.forEach(order => {
          if (order.invoices && order.invoices.length > 0) {
            order.invoices.forEach(invoice => {
              const supplierName = order.suppliers?.name || 'Tedarikçi'
              const itemName = order.purchase_request_items?.item_name || 'Malzeme'
              allInvoices.push({
                description: `${supplierName} - ${itemName}`,
                amount: invoice.amount,
                currency: invoice.currency
              })
              totalAmount += invoice.amount
              currency = invoice.currency
            })
          } else {
            // Fatura yoksa sipariş tutarını kullan
            const supplierName = order.suppliers?.name || 'Tedarikçi'
            const itemName = order.purchase_request_items?.item_name || 'Malzeme'
            allInvoices.push({
              description: `${supplierName} - ${itemName}`,
              amount: order.amount,
              currency: order.currency
            })
            totalAmount += order.amount
            currency = order.currency
          }
        })
      }
      
      // Ayrı faturalar varsa onları da ekle
      if (data.invoices && data.invoices.length > 0) {
        data.invoices.forEach(invoice => {
          const supplierName = invoice.orders?.suppliers?.name || 'Tedarikçi'
          const itemName = invoice.orders?.purchase_request_items?.item_name || 'Malzeme'
          
          // Zaten sipariş faturalarında eklenmişse tekrar ekleme
          const alreadyAdded = allInvoices.some(inv => 
            inv.description.includes(supplierName) && 
            inv.description.includes(itemName) &&
            inv.amount === invoice.amount
          )
          
          if (!alreadyAdded) {
            allInvoices.push({
              description: `${supplierName} - ${itemName}`,
              amount: invoice.amount,
              currency: invoice.currency
            })
            totalAmount += invoice.amount
            currency = invoice.currency
          }
        })
      }
      
      return allInvoices.length > 0 ? `
        <div class="invoice-summary">
          <div class="invoice-summary-title">Fatura Özeti</div>
          <div class="invoice-summary-content">
            <div class="invoice-list">
              ${allInvoices.map(invoice => `
                <div class="invoice-summary-item">
                  <span>${invoice.description}</span>
                  <span>${invoice.amount.toLocaleString('tr-TR')} ${invoice.currency}</span>
                </div>
              `).join('')}
            </div>
            <div class="invoice-summary-total">
              <div class="total-label">Toplam Tutar</div>
              <div class="total-amount">${totalAmount.toLocaleString('tr-TR')} ${currency}</div>
            </div>
          </div>
        </div>
      ` : ''
    })()}

  </div>
</body>
</html>
  `
}

// Material Purchase Request Interface
export interface MaterialPurchaseRequest {
  request: {
    id: string
    title: string
    created_at: string
    site_name: string
    description?: string
    urgency_level: string
    profiles?: {
      full_name?: string
      email?: string
      role?: string
    }
  }
  material: {
    id: string
    item_name: string
    quantity: number
    unit: string
    brand?: string
    specifications?: string
    description?: string
    image_urls?: string[]
  }
  suppliers?: Array<{
    id: string
    name: string
    contact_person?: string
    phone?: string
    email?: string
    address?: string
  }>
}

// Material-specific PDF template
const generateMaterialPurchaseHTML = (data: MaterialPurchaseRequest): string => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getLogoUrl = () => {
    return 'https://yxzmxfwpgsqabtamnfql.supabase.co/storage/v1/object/public/satinalma/dovecbb.png'
  }

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Malzeme Detayları - ${data.material.item_name}</title>
  ${getPDFStyles()}
  <style>
    .purchase-form {
      max-width: 180mm;
      margin: 0 auto;
      padding: 30px;
    }
    
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 50px;
      padding-bottom: 20px;
      border-bottom: 1px solid #cccccc;
    }
    
    .logo-area {
      flex-shrink: 0;
    }
    
    .form-section {
      margin-bottom: 0;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 25px;
      padding-bottom: 8px;
      border-bottom: 2px solid #000000;
    }
    
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      margin-bottom: 20px;
    }
    
    .form-grid.single {
      grid-template-columns: 1fr;
    }
    
    .form-grid.with-image {
      grid-template-columns: 2fr 1fr;
      gap: 30px;
      align-items: start;
    }
    
    .form-field {
      margin-bottom: 20px;
    }
    
    .form-label {
      display: block;
      font-size: 10px;
      font-weight: 600;
      color: #333333;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 8px;
    }
    
    .form-value {
      font-size: 12px;
      color: #000000;
      padding: 12px 0;
      border-bottom: 1px solid #cccccc;
      min-height: 28px;
      line-height: 1.5;
    }
    
    .form-value.large {
      min-height: 60px;
    }
    
    .material-image {
      width: 100%;
      max-width: 200px;
      height: auto;
      border: 1px solid #dddddd;
      border-radius: 8px;
      object-fit: cover;
    }
    
    .image-container {
      text-align: center;
      padding: 20px;
    }
    
    .image-label {
      font-size: 9px;
      color: #666666;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .clean-layout {
      background: white;
      color: #000000;
    }
  </style>
</head>
<body>
  <div class="page clean-layout">
    <div class="purchase-form">
      <!-- Header -->
      <div class="header-section">
        <div class="logo-area">
          <img src="${getLogoUrl()}" alt="DOVEC Logo" style="width: 80px; height: 80px; object-fit: contain;" onerror="this.onerror=null; this.src='/d.png';" />
        </div>
        
        <div style="text-align: right; font-size: 11px; color: #666666;">
          <div style="font-weight: 600; margin-bottom: 4px;">Tarih:</div>
          <div>${getCurrentDate()}</div>
        </div>
      </div>
      
      <!-- Açıklama Metni -->
      <div style="margin-bottom: 40px; padding: 15px 0;">
        <p style="font-size: 13px; color: #333333; line-height: 1.6; margin: 0; font-weight: 500; text-align: left;">
          Sayın Tedarikçimiz, Şantiyemizden tarafımıza iletilen ihtiyaç ve talepler ekte bilgilerinize sunulmustur. ilgili konularda gerekli aksiyonların alınmasını rica eder, desteginiz igin şimdiden teşekkür ederiz.
        </p>
      </div>
      
      <!-- Malzeme Detayları -->
      <div class="form-section">
        <div class="section-title">Malzeme Detayları</div>
        
        ${data.material.image_urls && data.material.image_urls.length > 0 ? `
        <div class="form-grid with-image">
          <div>
            <div class="form-field">
              <label class="form-label">Malzeme Adı</label>
              <div class="form-value">${data.material.item_name}</div>
            </div>
            
            <div class="form-field">
              <label class="form-label">Talep Edilen Miktar</label>
              <div class="form-value">${data.material.quantity} ${data.material.unit}</div>
            </div>
            
            <div class="form-field">
              <label class="form-label">Birim</label>
              <div class="form-value">${data.material.unit}</div>
            </div>
            
            ${data.material.brand ? `
            <div class="form-field">
              <label class="form-label">Marka</label>
              <div class="form-value">${data.material.brand}</div>
            </div>
            ` : ''}
          </div>
          
          <div class="image-container">
            <img src="${data.material.image_urls[0]}" alt="Malzeme Resmi" class="material-image" />
            <div class="image-label">Malzeme Resmi</div>
          </div>
        </div>
        ` : `
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">Malzeme Adı</label>
            <div class="form-value">${data.material.item_name}</div>
          </div>
          <div class="form-field">
            <label class="form-label">Talep Edilen Miktar</label>
            <div class="form-value">${data.material.quantity} ${data.material.unit}</div>
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">Birim</label>
            <div class="form-value">${data.material.unit}</div>
          </div>
          ${data.material.brand ? `
          <div class="form-field">
            <label class="form-label">Marka</label>
            <div class="form-value">${data.material.brand}</div>
          </div>
          ` : `
          <div class="form-field">
            <label class="form-label">Marka</label>
            <div class="form-value">Belirtilmemiş</div>
          </div>
          `}
        </div>
        `}
        
        ${data.material.specifications ? `
        <div class="form-grid single">
          <div class="form-field">
            <label class="form-label">Teknik Özellikler</label>
            <div class="form-value large">${data.material.specifications}</div>
          </div>
        </div>
        ` : ''}
        
        ${data.material.description ? `
        <div class="form-grid single">
          <div class="form-field">
            <label class="form-label">Malzeme Açıklaması</label>
            <div class="form-value large">${data.material.description}</div>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  </div>
</body>
</html>
  `
}

// Material Purchase Request HTML Generator (for modal)
export const getMaterialPurchaseHTML = (data: MaterialPurchaseRequest): string => {
  return generateMaterialPurchaseHTML(data)
}

// Material Purchase Request PDF Generator
export const generateMaterialPurchaseRequest = async (data: MaterialPurchaseRequest): Promise<void> => {
  try {
    console.log('🔍 Malzeme satın alma formu oluşturuluyor:', {
      requestId: data.request.id,
      materialName: data.material.item_name,
      suppliersCount: data.suppliers?.length || 0
    })

    // HTML content oluştur
    const htmlContent = generateMaterialPurchaseHTML(data)
    
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
    console.error('Malzeme satın alma formu oluşturma hatası:', error)
    throw new Error('PDF oluşturulurken bir hata oluştu: ' + (error as Error).message)
  }
}

// Hızlı PDF Generator - İframe kullanarak
export const generatePurchaseRequestReportFast = async (data: ReportData): Promise<void> => {
  try {
    console.log('⚡ Hızlı PDF oluşturma başlatılıyor...')
    
    // HTML content oluştur
    const htmlContent = generatePDFHTML(data)
    
    // Gizli iframe oluştur
    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.top = '-9999px'
    iframe.style.left = '-9999px'
    iframe.style.width = '1px'
    iframe.style.height = '1px'
    iframe.style.opacity = '0'
    
    document.body.appendChild(iframe)
    
    // HTML'i iframe'e yaz
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      throw new Error('İframe document erişilemedi')
    }
    
    iframeDoc.open()
    iframeDoc.write(htmlContent)
    iframeDoc.close()
    
    // Print işlemini başlat
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        
        console.log('✅ Hızlı PDF print dialog açıldı')
        
        // İframe'i temizle
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 1000)
        
      } catch (error) {
        console.error('Print hatası:', error)
        document.body.removeChild(iframe)
        // Fallback olarak normal yöntemi çağır
        generatePurchaseRequestReport(data)
      }
    }, 100) // Çok hızlı
    
  } catch (error) {
    console.error('❌ Hızlı PDF oluşturma hatası:', error)
    // Fallback olarak normal yöntemi çağır
    return generatePurchaseRequestReport(data)
  }
}

// PDF Generator Function - Pop-up engelleyicisini bypass eden versiyon
export const generatePurchaseRequestReport = async (data: ReportData): Promise<void> => {
  try {
    console.log('🔄 PDF oluşturma başlatılıyor...')
    
    // HTML content oluştur
    const htmlContent = generatePDFHTML(data)
    
    // Blob oluştur
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    
    console.log('📄 HTML Blob oluşturuldu, boyut:', blob.size, 'bytes')
    
    // Yeni pencere aç (kullanıcı etkileşimi sırasında)
    const printWindow = window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    
    if (!printWindow) {
      console.log('⚠️ Pop-up engellendi, alternatif yöntem deneniyor...')
      
      // Alternatif: Aynı pencerede aç
      const currentWindow = window.open('', '_self')
      if (currentWindow) {
        currentWindow.document.write(htmlContent)
        currentWindow.document.close()
        
        // Print dialog'u aç
        setTimeout(() => {
          currentWindow.print()
          // Print tamamlandıktan sonra geri dön (opsiyonel)
          setTimeout(() => {
            currentWindow.history.back()
          }, 1000)
        }, 500)
      } else {
        // Son çare: Download link oluştur
        console.log('📥 Download link oluşturuluyor...')
        const downloadLink = document.createElement('a')
        downloadLink.href = url
        downloadLink.download = `siparis-raporu-${data.request.id.slice(0, 8)}.html`
        downloadLink.style.display = 'none'
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        
        // Kullanıcıya bilgi ver
        alert('PDF dosyası indirildi. Dosyayı açıp yazdırabilirsiniz.')
      }
    } else {
      console.log('✅ Yeni pencere açıldı')
      
      // Print dialog'u aç
      printWindow.onload = () => {
        console.log('📄 Pencere yüklendi, print dialog açılıyor...')
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
        }, 300) // Daha kısa timeout
      }
      
      // Timeout fallback
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          try {
            printWindow.focus()
            printWindow.print()
          } catch (e) {
            console.log('Print fallback çalıştırıldı')
          }
        }
      }, 1000)
    }
    
    // URL'i temizle (biraz sonra)
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 5000)
    
    console.log('✅ PDF oluşturma tamamlandı')
    
  } catch (error) {
    console.error('❌ PDF oluşturma hatası:', error)
    throw new Error('PDF oluşturulurken bir hata oluştu: ' + (error as Error).message)
  }
}