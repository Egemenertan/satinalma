import { jsPDF } from 'jspdf'

/** Sol üst marka görseli (public altında PNG). */
export const SITE_REPORT_LOGO_PATH = '/outline.png'

export type SiteDetailPdfSupplierRow = {
  name: string
  orderCount: number
  invoicedLine: string
}

export type SiteDetailPdfMaterialRow = {
  label: string
  requestItems: number
  orders: number
  invoicedLine: string
  gbpApproxLine: string | null
}

export type SiteDetailPdfOrderRow = {
  supplier: string
  request: string
  orderAmount: string
  invoicedLine: string
  date: string
}

export type SiteDetailPdfPayload = {
  siteName: string
  generatedAtLabel: string
  invoiceFilterLabel: string
  financeFxLabel: string
  chartRangeLabel: string
  kpis: {
    totalRequests: number
    lineItems: number
    avgItemsPerRequestLabel: string
    inPipeline: number
    legacyApproved: number
    requestTrendLabel: string
    ordersCount: number
    ordersAmountTry: string
  }
  finance: {
    invoicedLine: string
    attributedInvoiceRows: number
    chartCurrenciesLabel: string
  }
  suppliers: SiteDetailPdfSupplierRow[]
  materialGroups: SiteDetailPdfMaterialRow[]
  orders: SiteDetailPdfOrderRow[]
}

const MARGIN = 14
const LINE_H = 5.2
const PAGE_BOTTOM = 280

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength)))
  }
  return btoa(binary)
}

async function tryEmbedUnicodeFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch('/fonts/Akkurat.ttf', { credentials: 'same-origin' })
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    const b64 = arrayBufferToBase64(buf)
    doc.addFileToVFS('Akkurat-Regular.ttf', b64)
    doc.addFont('Akkurat-Regular.ttf', 'Akkurat', 'normal')
    doc.setFont('Akkurat', 'normal')
    return true
  } catch {
    return false
  }
}

async function tryFetchImageDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path, { credentials: 'same-origin' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onloadend = () => resolve(typeof r.result === 'string' ? r.result : null)
      r.onerror = () => reject(new Error('read'))
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function ensureY(doc: jsPDF, y: number, delta: number, pageRef: { n: number }): number {
  if (y + delta > PAGE_BOTTOM) {
    doc.addPage()
    pageRef.n += 1
    return MARGIN + 18
  }
  return y
}

function writeParagraph(doc: jsPDF, text: string, x: number, y: number, maxW: number, pageRef: { n: number }): number {
  const lines = doc.splitTextToSize(text, maxW)
  let cy = y
  for (const line of lines) {
    cy = ensureY(doc, cy, LINE_H, pageRef)
    doc.text(line, x, cy)
    cy += LINE_H
  }
  return cy
}

export async function generateSiteDetailSummaryPdf(payload: SiteDetailPdfPayload, fileSlug: string): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageW = doc.internal.pageSize.getWidth()
  const maxTextW = pageW - MARGIN * 2
  let y = MARGIN + 10
  const pageRef = { n: 1 }

  const unicodeOk = await tryEmbedUnicodeFont(doc)
  if (!unicodeOk) {
    doc.setFont('helvetica', 'normal')
  }

  const logoDataUrl = await tryFetchImageDataUrl(SITE_REPORT_LOGO_PATH)

  let headerRightStart = pageW - MARGIN - 92
  let logoBottom = MARGIN + 14
  if (logoDataUrl) {
    try {
      const imgW = 38
      const imgH = 11
      const fmt = logoDataUrl.includes('png') ? 'PNG' : 'JPEG'
      doc.addImage(logoDataUrl, fmt as 'PNG', MARGIN, MARGIN - 2, imgW, imgH)
      headerRightStart = Math.max(headerRightStart, MARGIN + imgW + 10)
      logoBottom = MARGIN + imgH + 4
    } catch {
      /* logo yoksun say */
    }
  }

  doc.setFontSize(16)
  doc.setTextColor(20, 20, 22)
  const titleLines = doc.splitTextToSize(`Şantiye özeti · ${payload.siteName}`, Math.max(80, pageW - MARGIN - headerRightStart))
  let tx = headerRightStart
  let ty = MARGIN + 4
  for (const ln of titleLines) {
    doc.text(ln, tx, ty)
    ty += LINE_H + 1
  }

  doc.setFontSize(9)
  doc.setTextColor(90, 90, 95)
  y = Math.max(ty + LINE_H, logoBottom + 6)
  y = ensureY(doc, y, LINE_H, pageRef)
  doc.text(`Oluşturulma: ${payload.generatedAtLabel}`, MARGIN, y)
  y += LINE_H
  doc.text(`Fatura kalemi tarihi (özet): ${payload.invoiceFilterLabel}`, MARGIN, y)
  y += LINE_H
  doc.text(`Para görünümü: ${payload.financeFxLabel}`, MARGIN, y)
  y += LINE_H
  doc.text(`Grafik zaman penceresi: ${payload.chartRangeLabel}`, MARGIN, y)
  y += LINE_H + 4

  doc.setFontSize(11)
  doc.setTextColor(24, 24, 28)
  y = ensureY(doc, y, LINE_H, pageRef)
  doc.text('Genel KPI', MARGIN, y)
  y += LINE_H + 2

  doc.setFontSize(9)
  doc.setTextColor(50, 50, 56)
  const k = payload.kpis
  const twDays = payload.chartRangeLabel.match(/\d+/)?.[0] ?? '?'
  const kpiBullets = [
    `Toplam talep: ${k.totalRequests} · Talep kalemi: ${k.lineItems} (ortalama ${k.avgItemsPerRequestLabel} kalem / talep)`,
    `İş akışında: ${k.inPipeline} · Onaylı (klasik status): ${k.legacyApproved} · Son ${twDays} günlük talep adedi trendi: ${k.requestTrendLabel}`,
    `Sipariş adedi: ${k.ordersCount} · Sipariş tutarı (ham): ${k.ordersAmountTry}`,
  ]
  for (const b of kpiBullets) {
    y = writeParagraph(doc, `• ${b}`, MARGIN, y, maxTextW - 4, pageRef)
  }
  y += 3

  doc.setFontSize(11)
  doc.setTextColor(24, 24, 28)
  y = ensureY(doc, y, LINE_H, pageRef)
  doc.text('Faturalanan özet', MARGIN, y)
  y += LINE_H + 2
  doc.setFontSize(9)
  doc.setTextColor(50, 50, 56)
  y = writeParagraph(doc, `Döviz kırılımı (seçilen fatura tarih filtresine göre): ${payload.finance.invoicedLine}`, MARGIN, y, maxTextW, pageRef)
  y = writeParagraph(
    doc,
    `Toplama dahil fatura kalemi sayısı: ${payload.finance.attributedInvoiceRows}. Grafikte kullanılan para birimi kodları: ${payload.finance.chartCurrenciesLabel}`,
    MARGIN,
    y,
    maxTextW,
    pageRef
  )
  y += 4

  doc.setFontSize(11)
  doc.setTextColor(24, 24, 28)
  y = ensureY(doc, y, LINE_H, pageRef)
  doc.text('Tedarikçi özeti', MARGIN, y)
  y += LINE_H + 2
  doc.setFontSize(8.5)
  if (payload.suppliers.length === 0) {
    y = writeParagraph(doc, 'Kayıtlı tedarikçi kırılımı yok.', MARGIN, y, maxTextW, pageRef)
  } else {
    payload.suppliers.forEach((row, i) => {
      const header = `${i + 1}. ${row.name} · ${row.orderCount} sipariş`
      y = ensureY(doc, y, LINE_H * 2.5, pageRef)
      doc.setFont(unicodeOk ? 'Akkurat' : 'helvetica', 'normal')
      doc.setFontSize(9.3)
      doc.text(header, MARGIN, y)
      doc.setFontSize(8.5)
      y += LINE_H
      y = writeParagraph(doc, `Faturalanan: ${row.invoicedLine}`, MARGIN + 4, y, maxTextW - 4, pageRef)
      y += 2
    })
  }
  y += 4

  doc.setFontSize(11)
  doc.setTextColor(24, 24, 28)
  y = ensureY(doc, y, LINE_H, pageRef)
  doc.text('Malzeme grupları (GBP sıralı özet)', MARGIN, y)
  y += LINE_H + 2
  doc.setFontSize(8.5)
  doc.setFont(unicodeOk ? 'Akkurat' : 'helvetica', 'normal')
  if (payload.materialGroups.length === 0) {
    y = writeParagraph(doc, 'Malzeme grubu verisi yok.', MARGIN, y, maxTextW, pageRef)
  } else {
    payload.materialGroups.forEach((row, i) => {
      const line1 = `${i + 1}. ${row.label} · talep kalemi ${row.requestItems} · sipariş ${row.orders}`
      y = ensureY(doc, y, LINE_H * 3, pageRef)
      doc.setFont(unicodeOk ? 'Akkurat' : 'helvetica', 'normal')
      doc.setFontSize(9.3)
      y = writeParagraph(doc, line1, MARGIN, y, maxTextW, pageRef)
      doc.setFontSize(8.5)
      y = writeParagraph(doc, `Faturalanan: ${row.invoicedLine}`, MARGIN + 4, y, maxTextW - 4, pageRef)
      if (row.gbpApproxLine) {
        y = writeParagraph(doc, row.gbpApproxLine, MARGIN + 4, y, maxTextW - 4, pageRef)
      }
      y += 2
    })
  }
  y += 4

  doc.setFontSize(11)
  doc.setTextColor(24, 24, 28)
  y = ensureY(doc, y, LINE_H, pageRef)
  doc.text('Son siparişler (liste özeti)', MARGIN, y)
  y += LINE_H + 2
  doc.setFontSize(8.5)

  const orderRows = payload.orders.slice(0, 40)
  if (orderRows.length === 0) {
    y = writeParagraph(doc, 'Sipariş kaydı yok.', MARGIN, y, maxTextW, pageRef)
  } else {
    orderRows.forEach((o, i) => {
      const head = `${i + 1}. ${o.supplier} · ${o.date}`
      y = ensureY(doc, y, LINE_H * 4, pageRef)
      doc.setFont(unicodeOk ? 'Akkurat' : 'helvetica', 'normal')
      doc.setFontSize(9.3)
      y = writeParagraph(doc, head, MARGIN, y, maxTextW, pageRef)
      doc.setFontSize(8.5)
      y = writeParagraph(doc, `Talep: ${o.request}`, MARGIN + 4, y, maxTextW - 4, pageRef)
      y = writeParagraph(doc, `Sipariş tutarı: ${o.orderAmount} · Faturalanan: ${o.invoicedLine}`, MARGIN + 4, y, maxTextW - 4, pageRef)
      y += 2
    })
    if (payload.orders.length > orderRows.length) {
      y = writeParagraph(
        doc,
        `(+${payload.orders.length - orderRows.length} sipariş daha — tam liste uygulamada)`,
        MARGIN,
        y,
        maxTextW,
        pageRef
      )
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 128)
    doc.text(`Sayfa ${p} / ${pageCount}`, pageW / 2, 292, { align: 'center' })
  }

  const isoDay = new Date().toISOString().slice(0, 10)
  const asciiSlug = fileSlug.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'santiye-ozeti'
  doc.save(`${asciiSlug}-ozet-${isoDay}.pdf`)
}
