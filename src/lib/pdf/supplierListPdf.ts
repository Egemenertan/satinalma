/**
 * Tedarikçi listesi PDF'i. Görsele çevirmek yerine gerçek tablo üretir:
 * metin seçilebilir, satırlar sayfa ortasında bölünmez, başlık her sayfada tekrarlanır.
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  formatReportDateTime,
  formatReportRateDate,
  type SupplierReport,
  type SupplierReportLogo,
} from '@/lib/supplier-report'

// Akkurat'ta ş, ğ, İ yok; Liberation Sans tüm Türkçe harfleri içerir.
const FONT_FAMILY = 'LiberationSans'
const PAGE_MARGIN = 12
const HEADER_BOTTOM = 25
const FOOTER_SPACE = 12
const LOGO_HEIGHT = 9

const INK: [number, number, number] = [17, 24, 39]
const MUTED: [number, number, number] = [107, 114, 128]
const LINE: [number, number, number] = [229, 231, 235]
const ACCENT: [number, number, number] = [0, 230, 118]
const HEAD_FILL: [number, number, number] = [17, 17, 17]
const STRIPE: [number, number, number] = [249, 250, 251]

async function fetchFontBase64(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) throw new Error('PDF yazı tipi yüklenemedi')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

async function registerFonts(pdf: jsPDF) {
  const [regular, bold] = await Promise.all([
    fetchFontBase64('/fonts/LiberationSans-Regular.ttf'),
    fetchFontBase64('/fonts/LiberationSans-Bold.ttf'),
  ])
  pdf.addFileToVFS('LiberationSans-Regular.ttf', regular)
  pdf.addFont('LiberationSans-Regular.ttf', FONT_FAMILY, 'normal')
  pdf.addFileToVFS('LiberationSans-Bold.ttf', bold)
  pdf.addFont('LiberationSans-Bold.ttf', FONT_FAMILY, 'bold')
  pdf.setFont(FONT_FAMILY, 'normal')
}

function drawSummary(pdf: jsPDF, report: SupplierReport, top: number): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const gap = 4
  const width = (pageWidth - PAGE_MARGIN * 2 - gap) / 2
  const height = 16

  const cards = [
    { label: `Toplam ${report.kindLabel.toLocaleLowerCase('tr-TR')}`, value: String(report.rows.length) },
    { label: 'Faturası olan', value: String(report.partiesWithSpend) },
  ]
  cards.forEach((card, index) => {
    const left = PAGE_MARGIN + index * (width + gap)
    pdf.setDrawColor(...LINE)
    pdf.setLineWidth(0.25)
    pdf.roundedRect(left, top, width, height, 1.5, 1.5, 'S')
    pdf.setFont(FONT_FAMILY, 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...MUTED)
    pdf.text(card.label, left + 3.5, top + 5.5)
    pdf.setFont(FONT_FAMILY, 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(...INK)
    pdf.text(card.value, left + 3.5, top + 12.2)
  })

  let next = top + height + 3.5
  pdf.setFont(FONT_FAMILY, 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor(...MUTED)
  const notes = [
    report.rateDate &&
      `Sıralamada farklı para birimleri ${report.baseCurrency} karşılığına çevrilmiştir (ECB kuru, ${formatReportRateDate(report.rateDate)}).`,
    report.hasIncomplete && 'Kuru bulunamayan para birimleri sıralamaya dahil edilmemiştir.',
  ].filter(Boolean) as string[]
  for (const note of notes) {
    pdf.text(note, PAGE_MARGIN, next)
    next += 3.8
  }
  return next + 0.5
}

function drawPageChrome(pdf: jsPDF, report: SupplierReport, logo: SupplierReportLogo | null) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const pageCount = pdf.getNumberOfPages()

  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)

    if (logo) {
      const width = (logo.width / logo.height) * LOGO_HEIGHT
      pdf.addImage(logo.dataUrl, 'PNG', PAGE_MARGIN, 10, width, LOGO_HEIGHT, 'report-logo', 'FAST')
    }

    pdf.setFont(FONT_FAMILY, 'bold')
    pdf.setFontSize(15)
    pdf.setTextColor(...INK)
    pdf.text(report.title, pageWidth - PAGE_MARGIN, 14, { align: 'right' })
    pdf.setFont(FONT_FAMILY, 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    pdf.text('En çok harcama yapılandan en aza doğru', pageWidth - PAGE_MARGIN, 18.6, { align: 'right' })

    pdf.setDrawColor(...ACCENT)
    pdf.setLineWidth(0.7)
    pdf.line(PAGE_MARGIN, 22, pageWidth - PAGE_MARGIN, 22)

    pdf.setDrawColor(...LINE)
    pdf.setLineWidth(0.2)
    pdf.line(PAGE_MARGIN, pageHeight - 9.5, pageWidth - PAGE_MARGIN, pageHeight - 9.5)
    pdf.setFontSize(7.5)
    pdf.setTextColor(...MUTED)
    pdf.text(`Rapor tarihi: ${formatReportDateTime(report.generatedAt)}`, PAGE_MARGIN, pageHeight - 6)
    pdf.text('Satın Alma — Dövec', pageWidth / 2, pageHeight - 6, { align: 'center' })
    pdf.text(`Sayfa ${page} / ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 6, { align: 'right' })
  }
}

export async function buildSupplierListPdf(
  report: SupplierReport,
  logo: SupplierReportLogo | null
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  await registerFonts(pdf)
  pdf.setProperties({ title: report.title, subject: `${report.title} — harcamaya göre sıralı` })

  const tableTop = drawSummary(pdf, report, HEADER_BOTTOM)

  autoTable(pdf, {
    startY: tableTop,
    margin: { top: HEADER_BOTTOM, right: PAGE_MARGIN, bottom: FOOTER_SPACE, left: PAGE_MARGIN },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    head: [['#', report.kindLabel, 'Yetkili', 'Telefon', 'E-posta', 'Adres', 'Vergi No']],
    body: report.rows.map((row) => [
      String(row.rank),
      row.code ? `${row.name}\n${row.code}` : row.name,
      row.contactPerson || '—',
      row.phone || '—',
      row.email || '—',
      row.address || '—',
      row.taxNumber || '—',
    ]),
    styles: {
      font: FONT_FAMILY,
      fontSize: 7,
      textColor: INK,
      cellPadding: { top: 1.8, right: 1.6, bottom: 1.8, left: 1.6 },
      lineColor: LINE,
      lineWidth: { bottom: 0.15 },
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: { fillColor: HEAD_FILL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: STRIPE },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center', textColor: MUTED },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 21 },
      3: { cellWidth: 27 },
      4: { cellWidth: 36 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 17 },
    },
  })

  drawPageChrome(pdf, report, logo)
  return pdf.output('blob')
}
