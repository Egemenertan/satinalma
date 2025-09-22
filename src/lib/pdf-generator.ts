// Dynamic imports will be used instead

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

export const generatePurchaseRequestReport = async (data: ReportData): Promise<void> => {
  // Dynamic import to avoid SSR issues
  const jsPDF = (await import('jspdf')).default
  await import('jspdf-autotable')
  
  const doc = new jsPDF()
  
  // Türkçe karakter desteği için font ayarları
  // jsPDF'de Times ve Helvetica fontları Türkçe karakterleri destekler
  doc.setFont('times', 'normal')
  
  let yPosition = 30
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 25
  const contentWidth = pageWidth - 2 * margin
  
  // Colors
  const primaryColor = [41, 128, 185] // Blue
  const secondaryColor = [52, 73, 94] // Dark blue
  const textColor = [44, 62, 80] // Dark gray
  const lightGray = [236, 240, 241]

  // Header background
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, pageWidth, 50, 'F')
  
  // Logo placeholder (white rectangle)
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, 15, 30, 20, 'F')
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.setFontSize(12)
  doc.text('LOGO', margin + 8, 27)
  
  // Main title
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text('SATIN ALMA TALEBİ RAPORU', margin + 40, 25)
  
  // Company info
  doc.setFontSize(10)
  doc.text('İnşaat Malzeme Yönetim Sistemi', margin + 40, 35)
  
  // Report date - right aligned
  const reportDate = `Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`
  const dateWidth = doc.getTextWidth(reportDate)
  doc.text(reportDate, pageWidth - margin - dateWidth, 35)
  
  yPosition = 70

  // Section title with background
  const drawSectionTitle = (title: string, y: number) => {
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2])
    doc.rect(margin, y - 5, contentWidth, 15, 'F')
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setLineWidth(0.5)
    doc.rect(margin, y - 5, contentWidth, 15, 'S')
    
    doc.setFontSize(14)
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.text(title, margin + 5, y + 5)
    return y + 20
  }

  yPosition = drawSectionTitle('TALEP BİLGİLERİ', yPosition)

  // Request details in professional table format
  const drawDetailRow = (label: string, value: string, y: number, isOdd: boolean = false) => {
    // Background for alternating rows
    if (isOdd) {
      doc.setFillColor(250, 250, 250)
      doc.rect(margin, y - 3, contentWidth, 12, 'F')
    }
    
    // Border
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.rect(margin, y - 3, contentWidth, 12, 'S')
    
    // Label (bold)
    doc.setFontSize(10)
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text(label, margin + 5, y + 4)
    
    // Value
    doc.setTextColor(60, 60, 60)
    const labelWidth = 60
    const maxValueWidth = contentWidth - labelWidth - 10
    const lines = doc.splitTextToSize(value, maxValueWidth)
    doc.text(lines, margin + labelWidth, y + 4)
    
    return y + Math.max(12, lines.length * 5 + 2)
  }

  let isOdd = false
  yPosition = drawDetailRow('Talep No:', `REQ-${data.request.id.slice(0, 8)}`, yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Başlık:', data.request.title, yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Durum:', data.request.status.toUpperCase(), yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Aciliyet:', data.request.urgency_level, yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Malzeme Sınıfı:', data.request.material_class, yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Şantiye:', data.request.sites?.name || data.request.site_name || 'Belirtilmemiş', yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Talep Eden:', data.request.profiles?.full_name || data.request.profiles?.email || 'Bilinmeyen', yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Rol:', data.request.profiles?.role || 'Belirtilmemiş', yPosition, isOdd = !isOdd)
  yPosition = drawDetailRow('Oluşturulma:', new Date(data.request.created_at).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }), yPosition, isOdd = !isOdd)

  yPosition += 15

  // Page break check function
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage()
      yPosition = 30
    }
  }

  // Talep Açıklaması
  if (data.request.description) {
    checkPageBreak(40)
    yPosition = drawSectionTitle('TALEP AÇIKLAMASI', yPosition)
    
    doc.setFillColor(249, 249, 249)
    const descLines = doc.splitTextToSize(data.request.description, contentWidth - 10)
    const descHeight = descLines.length * 5 + 10
    doc.rect(margin, yPosition - 5, contentWidth, descHeight, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.rect(margin, yPosition - 5, contentWidth, descHeight, 'S')
    
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.text(descLines, margin + 5, yPosition + 5)
    yPosition += descHeight + 10
  }

  // Talep Edilen Malzemeler
  if (data.request.purchase_request_items && data.request.purchase_request_items.length > 0) {
    checkPageBreak(60)
    yPosition = drawSectionTitle('TALEP EDİLEN MALZEMELER', yPosition)
    
    data.request.purchase_request_items.forEach((item, index) => {
      const isItemOdd = index % 2 === 1
      
      // Item background
      if (isItemOdd) {
        doc.setFillColor(250, 250, 250)
      } else {
        doc.setFillColor(255, 255, 255)
      }
      doc.rect(margin, yPosition - 3, contentWidth, 20, 'F')
      
      // Item border
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.2)
      doc.rect(margin, yPosition - 3, contentWidth, 20, 'S')
      
      // Item number circle
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.circle(margin + 8, yPosition + 5, 4, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.text((index + 1).toString(), margin + 6, yPosition + 7)
      
      // Item details
      doc.setFontSize(11)
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      doc.text(item.item_name, margin + 20, yPosition + 5)
      
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Miktar: ${item.quantity} ${item.unit}`, margin + 20, yPosition + 12)
      
      if (item.description) {
        const itemDescWidth = contentWidth - 25
        const itemDescLines = doc.splitTextToSize(`Açıklama: ${item.description}`, itemDescWidth)
        doc.text(itemDescLines[0], margin + 20, yPosition + 17)
      }
      
      yPosition += 25
    })

    yPosition += 10
  }

  // İstatistikler
  checkPageBreak(80)
  yPosition = drawSectionTitle('İSTATİSTİKLER', yPosition)
  
  // Statistics cards
  const statItems = [
    { label: 'Toplam İşlem Süresi', value: `${data.statistics.totalDays} gün`, icon: '📅' },
    { label: 'Alınan Teklif Sayısı', value: data.statistics.totalOffers.toString(), icon: '📄' },
    { label: 'Toplam Tutar', value: `${data.statistics.totalAmount.toLocaleString('tr-TR')} ${data.statistics.currency}`, icon: '💰' }
  ]
  
  const cardWidth = (contentWidth - 20) / 3
  statItems.forEach((item, index) => {
    const cardX = margin + index * (cardWidth + 10)
    
    // Card background
    doc.setFillColor(248, 249, 250)
    doc.roundedRect(cardX, yPosition - 5, cardWidth, 35, 3, 3, 'F')
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setLineWidth(0.5)
    doc.roundedRect(cardX, yPosition - 5, cardWidth, 35, 3, 3, 'S')
    
    // Icon area
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.circle(cardX + 12, yPosition + 8, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.text(item.icon, cardX + 9, yPosition + 11)
    
    // Value
    doc.setFontSize(14)
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text(item.value, cardX + 25, yPosition + 8)
    
    // Label
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    const labelLines = doc.splitTextToSize(item.label, cardWidth - 30)
    doc.text(labelLines, cardX + 25, yPosition + 18)
  })
  
  yPosition += 50

  // Timeline
  checkPageBreak(60)
  yPosition = drawSectionTitle('TALEBİN ZAMAN ÇİZELGESİ', yPosition)
  
  data.timeline.forEach((item, index) => {
    checkPageBreak(35)
    
    const date = new Date(item.date).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    // Timeline item background
    const itemBg = index % 2 === 0 ? [255, 255, 255] : [248, 249, 250]
    doc.setFillColor(itemBg[0], itemBg[1], itemBg[2])
    doc.rect(margin, yPosition - 3, contentWidth, 30, 'F')
    
    // Left border indicator
    const typeColors: any = {
      'creation': [46, 204, 113],
      'shipment': [52, 152, 219],
      'offer': [155, 89, 182],
      'approval': [241, 196, 15],
      'order': [230, 126, 34],
      'delivery': [26, 188, 156]
    }
    const borderColor = typeColors[item.type] || primaryColor
    doc.setFillColor(borderColor[0], borderColor[1], borderColor[2])
    doc.rect(margin, yPosition - 3, 4, 30, 'F')
    
    // Timeline content
    doc.setFontSize(11)
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text(`${index + 1}. ${item.action}`, margin + 10, yPosition + 5)
    
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`📅 ${date}`, margin + 10, yPosition + 12)
    doc.text(`👤 ${item.actor}`, margin + 10, yPosition + 18)
    
    // Details with text wrapping
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    const detailLines = doc.splitTextToSize(`💬 ${item.details}`, contentWidth - 15)
    doc.text(detailLines[0], margin + 10, yPosition + 24)
    
    yPosition += 35
  })

  // Professional footer
  const addFooter = () => {
    const footerY = doc.internal.pageSize.getHeight() - 20
    
    // Footer line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
    doc.setLineWidth(1)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
    
    // Footer text
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Bu rapor sistem tarafından otomatik olarak oluşturulmuştur.', margin, footerY)
    
    const pageInfo = `Sayfa ${doc.getCurrentPageInfo().pageNumber}/${doc.getNumberOfPages()}`
    const pageInfoWidth = doc.getTextWidth(pageInfo)
    doc.text(pageInfo, pageWidth - margin - pageInfoWidth, footerY)
    
    // Company info
    doc.text('İnşaat Malzeme Yönetim Sistemi - DOVEC', (pageWidth - doc.getTextWidth('İnşaat Malzeme Yönetim Sistemi - DOVEC')) / 2, footerY)
  }
  
  // Add footer to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter()
  }

  // PDF'i indir
  const fileName = `Talep_Raporu_${data.request.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}
