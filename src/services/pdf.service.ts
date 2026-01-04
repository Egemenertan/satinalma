/**
 * PDF Service
 * Stok işlemleri için PDF oluşturma
 */

interface StockMovementPDFData {
  transaction: {
    id: string
    quantity: number
    movement_type: string
    reason: string | null
    created_at: string
    supplier_name?: string | null
    product_condition?: string | null
    warehouse?: {
      name: string
    } | null
  }
  productDetails: {
    name: string
    sku: string | null
    unit: string
    unit_price: string | null
    currency: string | null
    category?: {
      name: string
    } | null
    brand?: {
      name: string
    } | null
  }
}

/**
 * Stok hareketi için PDF oluştur ve indir
 */
export async function generateStockMovementPDF(data: StockMovementPDFData) {
  const { transaction, productDetails } = data
  
  const supplierInfo = transaction.supplier_name || '-'
  const cleanNotes = transaction.reason || ''
  
  const statusLabels: Record<string, string> = {
    'giriş': 'GİRİŞ',
    'çıkış': 'ÇIKIŞ',
    'transfer': 'TRANSFER',
    'düzeltme': 'DÜZELTME'
  }

  const conditionLabels: Record<string, string> = {
    'yeni': 'Yeni',
    'kullanılmış': 'Kullanılmış',
    'hek': 'HEK',
    'arızalı': 'Arızalı'
  }

  const conditionColors: Record<string, string> = {
    'yeni': '#10b981',
    'kullanılmış': '#f97316',
    'hek': '#3b82f6',
    'arızalı': '#ef4444'
  }

  // Logo için tam URL oluştur
  const logoUrl = `${window.location.origin}/d.png`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 210mm;
      height: 297mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000000;
      padding: 15mm;
      background: white;
    }
    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
        margin: 0 !important;
        padding: 0 !important;
      }
      body {
        padding: 15mm !important;
      }
      @page {
        size: A4 portrait;
        margin: 15mm;
      }
      .logo {
        filter: brightness(0) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #11402E;
    }
    .logo {
      width: 80px;
      height: 80px;
      object-fit: contain;
      filter: brightness(0);
    }
    .title-section {
      text-align: right;
    }
    .title {
      font-size: 18pt;
      font-weight: 600;
      color: #11402E;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    .subtitle {
      font-size: 9pt;
      color: #455851;
      margin-top: 4px;
      line-height: 1.2;
    }
    .info-bar {
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      color: #666;
      margin-bottom: 12px;
    }
    .warehouse-info {
      font-size: 10pt;
      margin-bottom: 15px;
    }
    .warehouse-info .label {
      color: #455851;
      font-weight: 400;
    }
    .warehouse-info .value {
      color: #11402E;
      font-weight: 600;
      margin-left: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    thead {
      background-color: #11402E;
      color: white;
    }
    th {
      padding: 8px 8px;
      text-align: left;
      font-size: 8pt;
      font-weight: 500;
    }
    td {
      padding: 10px 8px;
      border: 1px solid #e5e5e5;
      font-size: 8pt;
    }
    tbody tr {
      background-color: #fafafa;
    }
    .product-name {
      font-weight: 500;
      color: #000;
    }
    .quantity {
      font-weight: 600;
      color: #11402E;
      font-size: 10pt;
    }
    .status-badge {
      display: inline-block;
      background-color: #11402E;
      color: white;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 400;
    }
    .section {
      margin-top: 12px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 9pt;
      color: #11402E;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .notes-box {
      background-color: #fafafa;
      border: 1px solid #e5e5e5;
      padding: 10px;
      border-radius: 4px;
      font-size: 8pt;
      color: #555;
      line-height: 1.5;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 8pt;
      color: #999;
      padding-top: 15px;
      border-top: 1px solid #e5e5e5;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="Döveç Logo" class="logo" crossorigin="anonymous" />
    <div class="title-section">
      <div class="title">STOK ${statusLabels[transaction.movement_type]?.toUpperCase() || 'İŞLEM'} BELGESİ</div>
      <div class="subtitle">Stok Yönetim Sistemi</div>
    </div>
  </div>

  <div class="info-bar">
    <span>Belge No: ${transaction.id.slice(-8).toUpperCase()}</span>
    <span>Tarih: ${new Date(transaction.created_at).toLocaleDateString('tr-TR')}</span>
    <span>Saat: ${new Date(transaction.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>

  ${supplierInfo && supplierInfo !== '-' && transaction.movement_type === 'giriş' ? `
    <div class="warehouse-info">
      <span class="label">Tedarikçi Firma:</span>
      <span class="value">${supplierInfo}</span>
    </div>
  ` : ''}

  <div class="warehouse-info">
    <span class="label">${transaction.movement_type === 'giriş' ? 'Giriş Yapılan Depo' : transaction.movement_type === 'çıkış' ? 'Çıkış Yapılan Depo' : 'Depo'}:</span>
    <span class="value">${transaction.warehouse?.name || '-'}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 12%;">STOK NO</th>
        <th style="width: 28%;">MALZEME ADI</th>
        <th style="width: 18%;">KATEGORİ</th>
        <th style="width: 15%;">MARKA</th>
        <th style="width: 15%; text-align: right;">BİRİM FİYAT</th>
        <th style="width: 12%; text-align: center;">MİKTAR</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${productDetails.sku || '-'}</td>
        <td class="product-name">${productDetails.name}</td>
        <td>${productDetails.category?.name || '-'}</td>
        <td>${productDetails.brand?.name || '-'}</td>
        <td style="text-align: right; font-weight: 500;">
          ${productDetails.unit_price ? 
            `${parseFloat(productDetails.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${productDetails.currency || 'TRY'}` 
            : '-'}
        </td>
        <td class="quantity" style="text-align: center;">${transaction.quantity} ${productDetails.unit}</td>
      </tr>
    </tbody>
  </table>

  <div class="section" style="display: flex; gap: 20px; align-items: center;">
    <div>
      <span class="label" style="color: #455851; font-size: 9pt; margin-right: 10px;">İşlem Tipi:</span>
      <span class="status-badge">${statusLabels[transaction.movement_type] || transaction.movement_type}</span>
    </div>
    ${transaction.product_condition ? `
      <div>
        <span class="label" style="color: #455851; font-size: 9pt; margin-right: 10px;">Ürün Durumu:</span>
        <span class="status-badge" style="background-color: ${conditionColors[transaction.product_condition] || '#6b7280'}">
          ${conditionLabels[transaction.product_condition] || transaction.product_condition}
        </span>
      </div>
    ` : ''}
  </div>

  ${cleanNotes ? `
    <div class="section">
      <div class="section-title">Açıklama:</div>
      <div class="notes-box">${cleanNotes}</div>
    </div>
  ` : ''}

  <div class="footer">
    <div>Bu belge elektronik ortamda oluşturulmuş olup imza gerektirmez.</div>
    <div style="margin-top: 4px;">Döveç Stok Yönetim Sistemi | © ${new Date().getFullYear()}</div>
  </div>
</body>
</html>`

  // Yeni pencerede aç ve yazdır
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    
    // Tüm kaynakların yüklenmesini bekle
    printWindow.onload = () => {
      // Logo ve diğer resimlerin yüklenmesi için ekstra bekle
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
        
        // Print dialog kapandıktan sonra pencereyi kapat (opsiyonel)
        // printWindow.onafterprint = () => {
        //   printWindow.close()
        // }
      }, 500)
    }
    
    // Fallback: onload çalışmazsa
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        try {
          printWindow.print()
        } catch (e) {
          console.error('Print error:', e)
        }
      }
    }, 1000)
  }
}

/**
 * PDF download için filename oluştur
 */
export function generatePDFFilename(movementType: string, date: string, productName: string): string {
  const formattedDate = new Date(date).toLocaleDateString('tr-TR').replace(/\./g, '-')
  const sanitizedProductName = productName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 30)
  return `Stok_${movementType}_${sanitizedProductName}_${formattedDate}.pdf`
}

