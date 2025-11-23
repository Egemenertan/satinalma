/**
 * Request Submitted PDF Components
 * Sadece talep bilgileri ve malzemeler için basit PDF
 */

import type { PDFRequestData } from './types'

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
 * Request Material Item Interface
 */
export interface RequestMaterialItem {
  id: string
  item_name: string
  quantity: number
  unit: string
  brand?: string
  specifications?: string
  purpose?: string
  delivery_date?: string
  material_class?: string
  material_group?: string
}

/**
 * Request Submitted PDF Data
 */
export interface RequestSubmittedPDFData {
  request: PDFRequestData
  materials: RequestMaterialItem[]
  generatedBy: {
    name: string
    email: string
  }
}

/**
 * Header Component - Simple with Logo
 */
export const buildRequestHeader = (request: PDFRequestData): string => `
  <div class="header">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <img src="/d.png" alt="Logo" style="height: 50px; width: auto; filter: brightness(0);" />
      <div style="text-align: right;">
        <div style="font-size: 10pt; color: #666;">
          ${formatDate(new Date().toISOString())}
        </div>
      </div>
    </div>
  </div>
`

/**
 * Request Info Component
 */
export const buildRequestDetails = (request: PDFRequestData): string => `
  <div class="section">
    <div class="section-title">Talep Bilgileri</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Talep Başlığı:</span>
        <span class="info-value">${request.title}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Talep Edilen Yer:</span>
        <span class="info-value">${request.site_name || 'Belirtilmemiş'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Talep Eden:</span>
        <span class="info-value">${request.requester_name || request.requester_email || 'Bilinmiyor'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Oluşturulma Tarihi:</span>
        <span class="info-value">${formatDate(request.created_at)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Malzeme Sınıfı:</span>
        <span class="info-value">${request.material_class || 'Belirtilmemiş'}</span>
      </div>
    </div>
    ${request.description ? `
      <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #111;">
        <strong style="color: #111;">Açıklama:</strong>
        <div style="margin-top: 4px; color: #374151;">${request.description}</div>
      </div>
    ` : ''}
  </div>
`

/**
 * Materials List Component
 */
export const buildMaterialsList = (materials: RequestMaterialItem[]): string => {
  if (!materials || materials.length === 0) {
    return '<div class="section"><div class="section-title">Talep Edilen Malzemeler</div><div class="no-data">Malzeme bulunamadı</div></div>'
  }

  return `
    <div class="section">
      <div class="section-title">Talep Edilen Malzemeler (${materials.length})</div>
      <table class="materials-table">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 30%;">Malzeme Adı</th>
            <th style="width: 15%;">Miktar</th>
            <th style="width: 15%;">Marka</th>
            <th style="width: 35%;">Kullanım Amacı</th>
          </tr>
        </thead>
        <tbody>
          ${materials.map((material, index) => `
            <tr>
              <td style="text-align: center; font-weight: 600; color: #6b7280;">${index + 1}</td>
              <td>
                <div style="font-weight: 600; color: #111; margin-bottom: 2px;">${material.item_name}</div>
                ${material.material_group ? `
                  <div style="font-size: 9pt; color: #6b7280;">
                    ${material.material_group}${material.material_class ? ` → ${material.material_class}` : ''}
                  </div>
                ` : ''}
              </td>
              <td style="font-weight: 600; color: #111;">
                ${formatNumber(material.quantity, 0)} ${material.unit || 'adet'}
              </td>
              <td style="color: #374151;">
                ${material.brand || '-'}
              </td>
              <td style="color: #374151;">
                ${material.purpose || '-'}
                ${material.delivery_date ? `
                  <div style="font-size: 9pt; color: #6b7280; margin-top: 4px;">
                    Gerekli: ${formatDate(material.delivery_date)}
                  </div>
                ` : ''}
              </td>
            </tr>
            ${material.specifications ? `
              <tr>
                <td colspan="5" style="background: #f9fafb; padding: 8px 12px; border-top: none;">
                  <div style="font-size: 9pt; color: #6b7280;">
                    <strong>Teknik Özellikler:</strong> ${material.specifications}
                  </div>
                </td>
              </tr>
            ` : ''}
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

/**
 * Footer Component with Signature Lines
 */
export const buildRequestFooter = (requesterName: string, requesterEmail: string, generatedByName: string, generatedByEmail: string): string => `
  <div class="footer" style="margin-top: 40px; padding-top: 40px; border-top: 2px solid #e5e7eb;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
      <!-- Sol: Talep Karşılayan -->
      <div style="width: 45%; text-align: center;">
        <div style="border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 8px; min-height: 60px;">
        </div>
        <div style="font-size: 10pt; color: #111; font-weight: 600; margin-bottom: 4px;">
          ${generatedByName || generatedByEmail || 'Sistem Kullanıcısı'}
        </div>
        <div style="font-size: 9pt; color: #6b7280;">
          Talep Karşılayan
        </div>
        <div style="font-size: 8pt; color: #9ca3af; margin-top: 2px;">
          ${formatDate(new Date().toISOString())}
        </div>
      </div>
      
      <!-- Sağ: Talep Eden -->
      <div style="width: 45%; text-align: center;">
        <div style="border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 8px; min-height: 60px;">
        </div>
        <div style="font-size: 10pt; color: #111; font-weight: 600; margin-bottom: 4px;">
          ${requesterName || requesterEmail || 'Bilinmiyor'}
        </div>
        <div style="font-size: 9pt; color: #6b7280;">
          Talep Eden
        </div>
      </div>
    </div>
    
    <div style="text-align: center; color: #9ca3af; font-size: 8pt; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Bu belge sistem tarafından otomatik olarak oluşturulmuştur.
    </div>
  </div>
`

