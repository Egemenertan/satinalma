/**
 * Request Submitted PDF Generator
 * Basit talep PDF'i - sadece talep bilgileri ve malzemeler
 */

import type { RequestSubmittedPDFData } from './requestPdfComponents'
import { getPDFStyles } from './styles'
import { 
  buildRequestHeader, 
  buildRequestDetails, 
  buildMaterialsList, 
  buildRequestFooter 
} from './requestPdfComponents'

/**
 * Generate Request Submitted PDF HTML
 */
const generateRequestPDFHTML = (data: RequestSubmittedPDFData): string => {
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.request.title}</title>
  ${getPDFStyles()}
  <style>
    /* Additional styles for materials table */
    .materials-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 10pt;
    }
    
    .materials-table thead {
      background: #111;
      color: white;
    }
    
    .materials-table th {
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .materials-table tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }
    
    .materials-table tbody tr:last-child {
      border-bottom: 2px solid #111;
    }
    
    .materials-table tbody tr:hover {
      background: #f9fafb;
    }
    
    .materials-table td {
      padding: 12px;
      vertical-align: top;
    }
    
    @media print {
      .materials-table {
        page-break-inside: auto;
      }
      
      .materials-table tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      .materials-table thead {
        display: table-header-group;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    ${buildRequestHeader(data.request)}
    ${buildRequestDetails(data.request)}
    ${buildMaterialsList(data.materials)}
    ${buildRequestFooter(
      data.request.requester_name, 
      data.request.requester_email,
      data.generatedBy.name,
      data.generatedBy.email
    )}
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate and show Request PDF using print dialog
 */
export const generateRequestPDF = async (data: RequestSubmittedPDFData): Promise<void> => {
  try {
    console.log('⚡ Request PDF Generation Started')
    console.log('📋 Request Data:', {
      title: data.request.title,
      materials: data.materials.length,
      site: data.request.site_name
    })

    // Generate HTML
    const htmlContent = generateRequestPDFHTML(data)

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
      console.log('✅ Request PDF generation complete, iframe cleaned up')
    }, 1000)

  } catch (error) {
    console.error('❌ Request PDF generation error:', error)
    throw error
  }
}

/**
 * Transform request data to PDF format
 */
export const transformRequestToPDFData = (requestData: any, currentUser?: any): RequestSubmittedPDFData => {
  // Site name'i birden fazla kaynaktan kontrol et
  const siteName = requestData.sites?.name || 
                   requestData.site_name || 
                   (requestData.site_id ? 'Site Bilgisi Yükleniyor...' : 'Belirtilmemiş')
  
  console.log('🏢 Site Name Debug:', {
    fromSitesJoin: requestData.sites?.name,
    fromSiteNameField: requestData.site_name,
    siteId: requestData.site_id,
    finalSiteName: siteName
  })
  
  return {
    request: {
      id: requestData.id,
      title: requestData.title || 'Satın Alma Talebi',
      created_at: requestData.created_at,
      status: requestData.status || 'Beklemede',
      urgency_level: requestData.urgency_level || 'normal',
      material_class: requestData.material_class || 'Genel',
      description: requestData.specifications || requestData.description || '',
      site_name: siteName,
      requester_name: requestData.profiles?.full_name || '',
      requester_email: requestData.profiles?.email || ''
    },
    materials: (requestData.purchase_request_items || []).map((item: any) => ({
      id: item.id,
      item_name: item.item_name || item.material_item_name || 'Malzeme',
      quantity: item.quantity || 0,
      unit: item.unit || 'adet',
      brand: item.brand || '',
      specifications: item.specifications || '',
      purpose: item.purpose || '',
      delivery_date: item.delivery_date || '',
      material_class: item.material_class || '',
      material_group: item.material_group || ''
    })),
    generatedBy: {
      name: currentUser?.full_name || '',
      email: currentUser?.email || ''
    }
  }
}

/**
 * Main export function - Generate Request PDF from data
 */
export const generateRequestSubmittedPDF = async (requestData: any, currentUser?: any): Promise<void> => {
  const pdfData = transformRequestToPDFData(requestData, currentUser)
  await generateRequestPDF(pdfData)
}

