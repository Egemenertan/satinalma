/**
 * Zimmet (Inventory) PDF Generator
 * Teslim Tesellüm ve Sayım Tutanağı PDF'leri oluşturur
 */

import { getPDFStyles } from './styles'

export interface ZimmetItemData {
  id: string
  item_name: string
  quantity: number
  unit: string
  assigned_date: string
  status: string
  notes?: string
  category: string | null
  consumed_quantity: number
  user: {
    id: string
    full_name: string
    email: string
  }
  assigned_by_profile?: {
    full_name: string
    email: string
  }
  purchase_request?: {
    request_number: string
    id: string
  }
}

/**
 * Logo URL'ini oluştur
 */
const getLogoUrl = (): string => {
  const storageBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || 
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/satinalma`
  return `${storageBaseUrl}/dovecbb.png`
}

/**
 * Tarih formatlama
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Bugünün tarihini al
 */
const getCurrentDate = (): string => {
  return new Date().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Teslim Tesellüm PDF HTML'i oluştur
 */
const generateTeslimPDFHTML = (item: ZimmetItemData): string => {
  const remainingQuantity = item.quantity - (item.consumed_quantity || 0)
  const isConsumable = item.category === 'kontrollü sarf' || item.category === 'sarf malzemesi'

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teslim Tesellüm Formu - ${item.item_name}</title>
  ${getPDFStyles()}
  <style>
    .signature-section {
      margin-top: 60px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-line {
      border-top: 2px solid #000000;
      margin-bottom: 8px;
      height: 80px;
    }
    
    .signature-label {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .signature-name {
      font-size: 10px;
      color: #666666;
      margin-top: 4px;
    }
    
    .declaration {
      background: #f8f9fa;
      padding: 15px;
      margin-top: 30px;
      border-left: 3px solid #000000;
      font-size: 10px;
      line-height: 1.6;
      color: #333333;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="pdf-header">
      <div class="header-content">
        <div class="logo-section">
          <img src="${getLogoUrl()}" alt="DOVEC Logo" class="logo" onerror="this.onerror=null; this.src='/d.png';" />
          <div>
            <div class="header-title">TESLİM TESELLÜM FORMU</div>
            <div class="header-subtitle">Malzeme Zimmet Belgesi</div>
          </div>
        </div>
        <div class="header-date">
          <div>Belge Tarihi:</div>
          <div>${getCurrentDate()}</div>
        </div>
      </div>
    </div>

    <!-- Zimmet Bilgileri -->
    <div class="section">
      <div class="section-title">ZİMMET BİLGİLERİ</div>
      <div class="info-card">
        <div class="info-row">
          <div class="info-label">Malzeme Adı</div>
          <div class="info-value">${item.item_name}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Miktar</div>
          <div class="info-value">${item.quantity} ${item.unit}</div>
        </div>
        ${isConsumable ? `
        <div class="info-row">
          <div class="info-label">Sarf Edilen</div>
          <div class="info-value">${item.consumed_quantity || 0} ${item.unit}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Kalan Miktar</div>
          <div class="info-value">${remainingQuantity} ${item.unit}</div>
        </div>
        ` : ''}
        <div class="info-row">
          <div class="info-label">Kategori</div>
          <div class="info-value">${item.category || 'Belirtilmemiş'}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Teslim Tarihi</div>
          <div class="info-value">${formatDate(item.assigned_date)}</div>
        </div>
        ${item.purchase_request ? `
        <div class="info-row">
          <div class="info-label">Talep No</div>
          <div class="info-value">${item.purchase_request.request_number}</div>
        </div>
        ` : ''}
        ${item.notes ? `
        <div class="info-row">
          <div class="info-label">Notlar</div>
          <div class="info-value">${item.notes}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Kullanıcı Bilgileri -->
    <div class="section">
      <div class="section-title">KULLANCI BİLGİLERİ</div>
      <div class="info-card">
        <div class="info-row">
          <div class="info-label">Ad Soyad</div>
          <div class="info-value">${item.user.full_name}</div>
        </div>
        <div class="info-row">
          <div class="info-label">E-posta</div>
          <div class="info-value">${item.user.email}</div>
        </div>
        ${item.assigned_by_profile ? `
        <div class="info-row">
          <div class="info-label">Teslim Eden</div>
          <div class="info-value">${item.assigned_by_profile.full_name} (${item.assigned_by_profile.email})</div>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Taahhütname -->
    <div class="declaration">
      <strong>Taahhütname:</strong><br/>
      Yukarıda belirtilen malzemeyi zimmetli olarak teslim aldığımı, bu malzemenin bakım ve sorumluluğunun tarafıma ait olduğunu, 
      herhangi bir kayıp, hasar veya eksiklik durumunda bunun bedelini ödemeyi taahhüt ederim. Malzemeyi görevimden ayrılırken 
      veya talep edildiğinde eksiksiz ve sağlam olarak iade edeceğimi beyan ederim.
    </div>

    <!-- İmza Bölümü -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Teslim Eden</div>
        <div class="signature-name">${item.assigned_by_profile?.full_name || 'Depo Yöneticisi'}</div>
        <div class="signature-name">Tarih: ${getCurrentDate()}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Teslim Alan</div>
        <div class="signature-name">${item.user.full_name}</div>
        <div class="signature-name">Tarih: ${getCurrentDate()}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Sayım Tutanağı PDF HTML'i oluştur
 */
const generateSayimPDFHTML = (item: ZimmetItemData): string => {
  const remainingQuantity = item.quantity - (item.consumed_quantity || 0)
  const isConsumable = item.category === 'kontrollü sarf' || item.category === 'sarf malzemesi'

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sayım Tutanağı - ${item.item_name}</title>
  ${getPDFStyles()}
  <style>
    .count-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    
    .count-table th,
    .count-table td {
      border: 1px solid #000000;
      padding: 12px;
      text-align: left;
      font-size: 11px;
    }
    
    .count-table th {
      background: #f8f9fa;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .count-table .number-cell {
      text-align: center;
      font-weight: 600;
      font-size: 12px;
    }
    
    .signature-section {
      margin-top: 60px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-line {
      border-top: 2px solid #000000;
      margin-bottom: 8px;
      height: 80px;
    }
    
    .signature-label {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .notes-section {
      margin-top: 30px;
      padding: 15px;
      border: 2px solid #e0e0e0;
      min-height: 100px;
    }
    
    .notes-title {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="pdf-header">
      <div class="header-content">
        <div class="logo-section">
          <img src="${getLogoUrl()}" alt="DOVEC Logo" class="logo" onerror="this.onerror=null; this.src='/d.png';" />
          <div>
            <div class="header-title">SAYIM TUTANAĞI</div>
            <div class="header-subtitle">Zimmet Sayım Formu</div>
          </div>
        </div>
        <div class="header-date">
          <div>Sayım Tarihi:</div>
          <div>${getCurrentDate()}</div>
        </div>
      </div>
    </div>

    <!-- Zimmet Bilgileri -->
    <div class="section">
      <div class="section-title">ZİMMET BİLGİLERİ</div>
      <div class="info-card">
        <div class="info-row">
          <div class="info-label">Kullanıcı</div>
          <div class="info-value">${item.user.full_name} (${item.user.email})</div>
        </div>
        <div class="info-row">
          <div class="info-label">İlk Teslim Tarihi</div>
          <div class="info-value">${formatDate(item.assigned_date)}</div>
        </div>
        ${item.purchase_request ? `
        <div class="info-row">
          <div class="info-label">Talep No</div>
          <div class="info-value">${item.purchase_request.request_number}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Sayım Tablosu -->
    <div class="section">
      <div class="section-title">SAYIM DETAYI</div>
      <table class="count-table">
        <thead>
          <tr>
            <th>Malzeme Adı</th>
            <th>Kategori</th>
            <th style="text-align: center;">Teslim Edilen</th>
            ${isConsumable ? `
            <th style="text-align: center;">Sarf Edilen</th>
            <th style="text-align: center;">Olması Gereken</th>
            ` : ''}
            <th style="text-align: center;">Sayılan Miktar</th>
            <th style="text-align: center;">Fark</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${item.item_name}</td>
            <td>${item.category || 'Belirtilmemiş'}</td>
            <td class="number-cell">${item.quantity} ${item.unit}</td>
            ${isConsumable ? `
            <td class="number-cell">${item.consumed_quantity || 0} ${item.unit}</td>
            <td class="number-cell">${remainingQuantity} ${item.unit}</td>
            ` : ''}
            <td class="number-cell" style="background: #f0f0f0;">________</td>
            <td class="number-cell" style="background: #f0f0f0;">________</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Notlar Bölümü -->
    <div class="notes-section">
      <div class="notes-title">Sayım Notları ve Açıklamalar:</div>
      <div style="min-height: 60px;">
        ${item.notes || ''}
      </div>
    </div>

    <!-- İmza Bölümü -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Sayım Yapan</div>
        <div style="font-size: 9px; color: #666666; margin-top: 4px;">Tarih: ${getCurrentDate()}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Kontrol Eden</div>
        <div style="font-size: 9px; color: #666666; margin-top: 4px;">Tarih: ${getCurrentDate()}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Onaylayan</div>
        <div style="font-size: 9px; color: #666666; margin-top: 4px;">Tarih: ${getCurrentDate()}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Teslim Tesellüm PDF'i oluştur ve yazdır
 */
export const generateTeslimPDF = async (item: ZimmetItemData): Promise<void> => {
  try {
    console.log('📋 Teslim Tesellüm PDF oluşturuluyor:', item.item_name)
    
    const htmlContent = generateTeslimPDFHTML(item)
    
    // Yeni pencerede aç ve yazdır
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      throw new Error('Pop-up engellendi. Lütfen pop-up engelleyicisini devre dışı bırakın.')
    }
    
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // Print dialog'u aç
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 500)
    }
    
    console.log('✅ Teslim Tesellüm PDF oluşturuldu')
  } catch (error) {
    console.error('❌ Teslim Tesellüm PDF oluşturma hatası:', error)
    throw error
  }
}

/**
 * Sayım Tutanağı PDF'i oluştur ve yazdır
 */
export const generateSayimPDF = async (item: ZimmetItemData): Promise<void> => {
  try {
    console.log('📋 Sayım Tutanağı PDF oluşturuluyor:', item.item_name)
    
    const htmlContent = generateSayimPDFHTML(item)
    
    // Yeni pencerede aç ve yazdır
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      throw new Error('Pop-up engellendi. Lütfen pop-up engelleyicisini devre dışı bırakın.')
    }
    
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // Print dialog'u aç
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 500)
    }
    
    console.log('✅ Sayım Tutanağı PDF oluşturuldu')
  } catch (error) {
    console.error('❌ Sayım Tutanağı PDF oluşturma hatası:', error)
    throw error
  }
}
