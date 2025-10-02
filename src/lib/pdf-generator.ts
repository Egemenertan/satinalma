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
              <div class="order-details">Miktar: ${order.quantity} ${order.purchase_request_items?.unit || 'adet'}</div>
              ${(() => {
                // Fatura tutarlarını hesapla
                const totalInvoiceAmount = order.invoices && order.invoices.length > 0 
                  ? order.invoices.reduce((total, invoice) => total + invoice.amount, 0)
                  : 0
                
                if (totalInvoiceAmount > 0) {
                  // Fatura varsa fatura tutarını göster
                  const currency = order.invoices[0].currency || order.currency
                  return `<div class="order-details">Fatura Tutarı: ${totalInvoiceAmount.toLocaleString('tr-TR')} ${currency}</div>`
                } else {
                  // Fatura yoksa sipariş tutarını göster
                  return `<div class="order-details">Sipariş Tutarı: ${order.amount.toLocaleString('tr-TR')} ${order.currency}</div>`
                }
              })()}
              <div class="order-details">Teslimat Tarihi: ${order.delivery_date ? formatDate(order.delivery_date) : 'Belirtilmemiş'}</div>
              <div class="order-user">Sipariş Veren: ${order.profiles?.full_name || order.profiles?.email || 'Purchasing Officer'}</div>
              ${order.delivered_at ? `<div class="order-details delivery-status"> Teslim Alındı: ${formatDate(order.delivered_at)}</div>` : ''}
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
      <div class="stats-container" style="display: flex; justify-content: center;">
        <div class="stat-card" style="max-width: 200px;">
          <div class="stat-value">${data.statistics.totalDays} gün</div>
          <div class="stat-label">Toplam İşlem Süresi</div>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="section">
      <div class="section-title">TALEBİN ZAMAN ÇİZELGESİ</div>
      ${data.timeline.filter(item => item.type !== 'invoice').map((item, index) => `
        <div class="timeline-item ${item.type === 'shipment' ? 'shipment' : item.type === 'approval' ? 'approval' : item.type === 'order' ? 'order' : item.type === 'invoice' ? 'invoice' : ''}">
          <div class="timeline-header">
            <div class="timeline-action">${index + 1}. ${item.action}${item.type === 'shipment' ? ' 📦' : item.type === 'approval' ? ' ✅' : item.type === 'order' ? ' 🛒' : item.type === 'invoice' ? ' 🧾' : ''}</div>
            <div class="timeline-date">${formatDate(item.date)}</div>
          </div>
          <div class="timeline-actor">Kullanıcı: ${item.actor}</div>
          ${(() => {
            // Shipment için details'ı basitleştir - sadece temel bilgi göster
            if (item.type === 'shipment' && item.shipment_data) {
              return `<div class="timeline-details">Malzeme: ${item.shipment_data.item_name} (${item.shipment_data.quantity} ${item.shipment_data.unit}) gönderildi</div>`
            }
            // Order için details'ı basitleştir - miktar ve tedarikçi bilgisi ile
            else if (item.type === 'order' && item.order_data) {
              return `<div class="timeline-details">Tedarikçi: ${item.order_data.supplier_name} - ${item.order_data.item_name} (${item.order_data.quantity} ${item.order_data.unit || 'adet'})</div>`
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
          Sayın Tedarikçimiz, aşağıda belirtilen malzeme için teklif talebinde bulunmaktayız. 
          Lütfen en uygun fiyat ve teslimat sürenizi bize bildirin. Teklifinizi bizimle paylaştığınız için teşekkür ederiz.
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