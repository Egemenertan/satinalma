// Modern PDF generator using HTML and print CSS

export interface TimelineItem {
  date: string
  action: string
  actor: string
  details: string
  type: string
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
  statistics: {
    totalDays: number
    totalOffers: number
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
    width: 50px;
    height: 50px;
    object-fit: contain;
    max-width: 50px;
    max-height: 50px;
    display: block;
  }
  
  .header-title {
    font-size: 18px;
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
    background: #fafafa;
    padding: 12px;
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
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
    background: white;
    padding: 12px;
    margin-bottom: 8px;
    border-left: 3px solid #000000;
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
    const publicUrl = 'https://yxzmxfwpgsqabtamnfql.supabase.co/storage/v1/object/public/satinalma/dunya.png'
    
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
          <div class="info-label">ACİLİYET</div>
          <div class="info-value">${data.request.urgency_level}</div>
        </div>
        <div class="info-row">
          <div class="info-label">MALZEME SINIFI</div>
          <div class="info-value">${data.request.material_class}</div>
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

    ${data.request.description ? `
    <!-- Açıklama -->
    <div class="section">
      <div class="section-title">TALEP AÇIKLAMASI</div>
      <div class="description">${data.request.description}</div>
    </div>
    ` : ''}

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
          <div class="stat-value">${data.statistics.totalAmount.toLocaleString('tr-TR')} ${data.statistics.currency}</div>
          <div class="stat-label">Toplam Tutar</div>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="section">
      <div class="section-title">TALEBİN ZAMAN ÇİZELGESİ</div>
      ${data.timeline.map((item, index) => `
        <div class="timeline-item">
          <div class="timeline-header">
            <div class="timeline-action">${index + 1}. ${item.action}</div>
            <div class="timeline-date">${formatDate(item.date)}</div>
          </div>
          <div class="timeline-actor">Kullanıcı: ${item.actor}</div>
          <div class="timeline-details">Detay: ${item.details}</div>
        </div>
      `).join('')}
    </div>

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