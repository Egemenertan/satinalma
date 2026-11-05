/**
 * Tedarikçi listesi Excel'i: harcamaya göre sıralı, filtrelenebilir iletişim listesi.
 */

import ExcelJS from 'exceljs'
import {
  formatReportDateTime,
  formatReportRateDate,
  type SupplierReport,
  type SupplierReportLogo,
} from '@/lib/supplier-report'

const INK = 'FF111827'
const MUTED = 'FF6B7280'
const LINE = 'FFE5E7EB'
const ACCENT = 'FF00E676'
const HEAD_FILL = 'FF111111'
const STRIPE = 'FFF9FAFB'
const LOGO_HEIGHT_PX = 34
const FONT_NAME = 'Calibri'

export async function buildSupplierListXlsx(
  report: SupplierReport,
  logo: SupplierReportLogo | null
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.created = report.generatedAt
  const sheet = workbook.addWorksheet(`${report.kindLabel} Listesi`, {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  })

  const columns: { header: string; width: number }[] = [
    { header: 'Sıra', width: 6 },
    { header: report.kindLabel, width: 36 },
    { header: 'Kod', width: 12 },
    { header: 'Yetkili', width: 22 },
    { header: 'Telefon', width: 18 },
    { header: 'E-posta', width: 30 },
    { header: 'Adres', width: 40 },
    { header: 'Vergi No', width: 14 },
  ]
  columns.forEach(({ width }, index) => {
    sheet.getColumn(index + 1).width = width
  })
  const lastColumn = columns.length

  sheet.getRow(1).height = 34
  if (logo) {
    const imageId = workbook.addImage({ base64: logo.dataUrl, extension: 'png' })
    sheet.addImage(imageId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: (logo.width / logo.height) * LOGO_HEIGHT_PX, height: LOGO_HEIGHT_PX },
    })
  }
  sheet.mergeCells(1, 4, 1, lastColumn)
  const titleCell = sheet.getCell(1, 4)
  titleCell.value = report.title
  titleCell.font = { name: FONT_NAME, bold: true, size: 18, color: { argb: INK } }
  titleCell.alignment = { horizontal: 'right', vertical: 'middle' }

  sheet.mergeCells(2, 1, 2, lastColumn)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = `En çok harcama yapılandan en aza doğru  ·  Rapor tarihi: ${formatReportDateTime(report.generatedAt)}`
  subtitleCell.font = { name: FONT_NAME, size: 9, color: { argb: MUTED } }
  subtitleCell.alignment = { horizontal: 'right' }
  subtitleCell.border = { bottom: { style: 'medium', color: { argb: ACCENT } } }
  sheet.getRow(2).height = 18

  const notes = [
    `${report.rows.length} ${report.kindLabel.toLocaleLowerCase('tr-TR')}, ${report.partiesWithSpend} tanesinin faturası var.`,
    report.rateDate &&
      `Sıralamada farklı para birimleri ${report.baseCurrency} karşılığına çevrilmiştir (ECB kuru, ${formatReportRateDate(report.rateDate)}).`,
    report.hasIncomplete && 'Kuru bulunamayan para birimleri sıralamaya dahil edilmemiştir.',
  ].filter(Boolean) as string[]

  let rowNumber = 3
  for (const note of notes) {
    sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn)
    const cell = sheet.getCell(rowNumber, 1)
    cell.value = note
    cell.font = { name: FONT_NAME, size: 9, color: { argb: MUTED } }
    rowNumber += 1
  }
  rowNumber += 1

  const headerRowNumber = rowNumber
  const headerRow = sheet.getRow(headerRowNumber)
  headerRow.height = 24
  columns.forEach(({ header }, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } }
    cell.alignment = {
      vertical: 'middle',
      wrapText: true,
      horizontal: index === 0 ? 'center' : 'left',
    }
  })

  report.rows.forEach((item, index) => {
    const row = sheet.getRow(headerRowNumber + 1 + index)
    const values: (string | number | null)[] = [
      item.rank,
      item.name,
      item.code || null,
      item.contactPerson || null,
      item.phone || null,
      item.email || null,
      item.address || null,
      item.taxNumber || null,
    ]

    values.forEach((value, valueIndex) => {
      const cell = row.getCell(valueIndex + 1)
      cell.value = value
      cell.font = { name: FONT_NAME, size: 10, color: { argb: INK }, bold: valueIndex === 1 }
      cell.alignment = { vertical: 'middle', wrapText: valueIndex === 1 || valueIndex === 6 }
      cell.border = { bottom: { style: 'hair', color: { argb: LINE } } }
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }
      }
    })

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    if (item.email && /^[^\s@]+@[^\s@]+$/.test(item.email)) {
      const cell = row.getCell(6)
      cell.value = { text: item.email, hyperlink: `mailto:${item.email}` }
      cell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF2563EB' }, underline: true }
    }
  })

  const lastDataRow = headerRowNumber + report.rows.length

  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: lastDataRow, column: lastColumn },
  }
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: headerRowNumber, showGridLines: false }]
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
