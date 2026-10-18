/**
 * Çalışan bazlı depo zimmet envanter listesi — HTML → PDF indirme (logo + imza blokları).
 */

import { getPDFStyles } from './styles'

const LOGO_PATH = '/d-black.png'

export type ZimmetAssignmentListRow = {
  imageUrl?: string
  productName: string
  sku: string
  brand: string
  unit: string
  quantity: number
  /** Ürün kartındaki birim fiyat. Yoksa null. */
  unitPrice: number | null
  currency: string
  productType: string
  sourceWarehouse: string
  serialNumber: string
}

export type ZimmetAssignmentListPdfPayload = {
  docTitleSuffix: string
  titleMain: string
  titleSub: string
  assignedPersonName: string
  assignedPersonEmailLine: string
  exportedByDisplayName: string
  exportedByEmail?: string
  generatedAtLabel: string
  warehouseScopeLine: string
  rowCountNote: string
  rows: ZimmetAssignmentListRow[]
  heading?: string
  signLeftRole?: string
  signRightRole?: string
  signRightNote?: string
  footerNote?: string
  declaration?: string
}

function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const extraCss = `
<style>
  body { background: #fff; width: 794px; }
  .container {
    width: 794px;
    max-width: 794px;
    box-sizing: border-box;
    padding: 16px 14px 24px;
    background: #fff;
  }
  .zim-assignment-accent {
    border-bottom: 3px solid #00E676;
    margin-bottom: 16px;
    padding-bottom: 12px;
  }
  .zim-assignment-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .zim-logo {
    flex-shrink: 0;
    height: 48px;
    width: auto;
    max-width: 180px;
    object-fit: contain;
    display: block;
  }
  .zim-titles { text-align: right; flex: 1; min-width: 0; }
  .zim-main-title {
    font-size: 14pt;
    font-weight: 700;
    color: #000;
    letter-spacing: 0.02em;
  }
  .zim-sub-title {
    font-size: 9.5pt;
    color: #555;
    margin-top: 4px;
    line-height: 1.35;
  }
  .zim-meta-grid {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 6px 12px;
    font-size: 9.5pt;
    margin-bottom: 18px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    page-break-inside: avoid;
  }
  .zim-meta-k { font-weight: 600; color: #374151; }
  .zim-meta-v { color: #111827; word-break: break-word; }
  /* Global styles’taki .section { page-break-inside: avoid } tabloyu tek parça yapınca ilk sayfa boş kalıyordu */
  .zim-assign-doc-block {
    margin-bottom: 16px;
    page-break-inside: auto;
  }
  .zim-assign-heading {
    font-size: 11pt;
    font-weight: 600;
    margin-bottom: 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid #ddd;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #000;
    page-break-after: avoid;
  }
  .zim-table-wrap { margin-top: 4px; }
  table.zim-data {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5pt;
    line-height: 1.3;
    letter-spacing: 0;
    page-break-inside: auto;
  }
  table.zim-data th {
    background: #111;
    color: #fff;
    padding: 5px 3px;
    text-align: left;
    font-weight: 700;
    font-size: 6.5pt;
    line-height: 1.2;
    letter-spacing: 0;
    text-transform: none;
    border: 1px solid #000;
    vertical-align: middle;
    white-space: normal;
  }
  table.zim-data td {
    padding: 5px 3px;
    border: 1px solid #d1d5db;
    vertical-align: middle;
    text-align: left;
    color: #111827;
    line-height: 1.35;
    letter-spacing: 0;
    white-space: normal;
    word-break: normal;
    overflow-wrap: break-word;
  }
  table.zim-data tr:nth-child(even) td { background: #fafafa; }
  table.zim-data th.zim-money,
  table.zim-data td.zim-money {
    text-align: right;
    white-space: normal;
  }
  table.zim-data th.zim-center,
  table.zim-data td.zim-center {
    text-align: center;
    white-space: nowrap;
  }
  table.zim-data td.zim-name {
    font-size: 7.5pt;
    line-height: 1.25;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .zim-totals {
    margin-top: 10px;
    display: flex;
    justify-content: flex-end;
    page-break-inside: avoid;
  }
  .zim-totals-card {
    min-width: 220px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
    font-size: 9pt;
  }
  .zim-totals-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 6px 10px;
    border-top: 1px solid #e5e7eb;
  }
  .zim-totals-row:first-child { border-top: 0; }
  .zim-totals-k { color: #374151; font-weight: 600; }
  .zim-totals-v { color: #111827; font-weight: 700; font-variant-numeric: tabular-nums; }
  table.zim-data th.zim-th-img,
  table.zim-data td.zim-td-img {
    width: 44px;
    max-width: 44px;
    text-align: center;
    vertical-align: middle;
    padding: 4px;
    overflow: hidden;
  }
  .zim-img-box {
    width: 32px;
    height: 32px;
    margin: 0 auto;
    overflow: hidden;
    border-radius: 4px;
    background: #f3f4f6;
  }
  .zim-prod-img {
    width: 32px;
    height: 32px;
    max-width: 32px;
    max-height: 32px;
    object-fit: cover;
    display: block;
  }
  .zim-prod-img-empty {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    border: 1px dashed #d1d5db;
    background: #f9fafb;
    margin: 0 auto;
  }
  .zim-sign-wrap {
    margin-top: 28px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    page-break-inside: auto;
  }
  .zim-sign-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 14px;
    background: #fff;
    min-height: 138px;
  }
  .zim-sign-role {
    font-size: 8pt;
    font-weight: 700;
    color: #0A0A0A;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .zim-sign-person { font-size: 10pt; font-weight: 600; margin-bottom: 4px; }
  .zim-sign-contact { font-size: 9pt; color: #4b5563; margin-bottom: 20px; }
  .zim-sign-label {
    font-size: 8pt;
    color: #6b7280;
    margin-bottom: 4px;
  }
  .zim-sign-line {
    border-bottom: 2px solid #374151;
    min-height: 26px;
  }
  .zim-declaration {
    margin-top: 18px;
    padding: 14px 16px;
    border: 1px solid #e5e7eb;
    border-left: 3px solid #111;
    border-radius: 6px;
    background: #f9fafb;
    font-size: 10pt;
    line-height: 1.55;
    color: #111827;
    page-break-inside: avoid;
  }
  .zim-declaration-label {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #374151;
    margin-bottom: 6px;
  }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .zim-assign-doc-block {
      page-break-inside: auto !important;
    }
    table.zim-data thead {
      display: table-header-group;
    }
    table.zim-data tbody {
      display: table-row-group;
    }
    table.zim-data tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
</style>
`

function formatAmount(value: number): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatMoney(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${formatAmount(value)} ${currency || 'TRY'}`
}

/** Boş ve "belirtilmemiş" gibi yer tutucular raporda tire olur. */
function displayText(raw: string | null | undefined): string {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return '-'
  const key = text.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
  if (
    key === '-' ||
    key === '—' ||
    key === '–' ||
    key === 'yok' ||
    key === 'n/a' ||
    key === 'na' ||
    key === 'null' ||
    key === 'undefined' ||
    key === 'bilinmiyor' ||
    key === 'bilinmeyen' ||
    key.startsWith('belirtilmem') ||
    key.startsWith('belirtilmedi')
  ) {
    return '-'
  }
  return text
}

function cell(value: string): string {
  return esc(displayText(value))
}

function lineTotal(row: ZimmetAssignmentListRow): number | null {
  if (row.unitPrice == null || !Number.isFinite(row.unitPrice)) return null
  const qty = Number(row.quantity)
  if (!Number.isFinite(qty)) return null
  return qty * row.unitPrice
}

function buildTotalsHtml(rows: ZimmetAssignmentListRow[]): string {
  const byCurrency = new Map<string, number>()
  let pricedCount = 0
  for (const row of rows) {
    const total = lineTotal(row)
    if (total == null) continue
    pricedCount += 1
    const currency = row.currency || 'TRY'
    byCurrency.set(currency, (byCurrency.get(currency) || 0) + total)
  }
  if (pricedCount === 0) return ''

  const lines = [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'tr'))
    .map(
      ([currency, sum]) => `
      <div class="zim-totals-row">
        <span class="zim-totals-k">Toplam tutar (${esc(currency)})</span>
        <span class="zim-totals-v">${esc(formatMoney(sum, currency))}</span>
      </div>`
    )
    .join('')

  return `<div class="zim-totals"><div class="zim-totals-card">${lines}</div></div>`
}

function buildTableRows(rows: ZimmetAssignmentListRow[]): string {
  return rows
    .map((r) => {
      const imgCell = r.imageUrl
        ? `<div class="zim-img-box"><img src="${esc(r.imageUrl)}" alt="" width="32" height="32" class="zim-prod-img" /></div>`
        : `<div class="zim-prod-img-empty"></div>`
      const currency = r.currency || 'TRY'
      const price = formatMoney(r.unitPrice, currency)
      return `
    <tr>
      <td class="zim-td-img">${imgCell}</td>
      <td class="zim-name">${cell(r.productName)}</td>
      <td>${cell(r.sku)}</td>
      <td>${cell(r.brand)}</td>
      <td class="zim-center">${cell(r.unit)}</td>
      <td class="zim-money">${cell(String(r.quantity))}</td>
      <td class="zim-money">${esc(price)}</td>
      <td>${cell(r.productType)}</td>
      <td>${cell(r.sourceWarehouse)}</td>
      <td>${cell(r.serialNumber)}</td>
    </tr>`
    })
    .join('')
}

function buildHtml(payload: ZimmetAssignmentListPdfPayload, logoSrc: string): string {
  const exportedLine = `${payload.exportedByDisplayName}${
    payload.exportedByEmail ? ` · ${payload.exportedByEmail}` : ''
  }`
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="${esc(origin)}/" />
  <title>${esc(payload.docTitleSuffix)}</title>
  ${getPDFStyles()}
  ${extraCss}
</head>
<body>
  <div class="container">
    <div class="zim-assignment-accent">
      <div class="zim-assignment-header-row">
        <img src="${esc(logoSrc)}" alt="Dovec" class="zim-logo" />
        <div class="zim-titles">
          <div class="zim-main-title">${esc(payload.titleMain)}</div>
          <div class="zim-sub-title">${esc(payload.titleSub)}</div>
        </div>
      </div>
    </div>

    <div class="zim-meta-grid">
      <span class="zim-meta-k">Zimmetli personel</span><span class="zim-meta-v">${esc(
        `${payload.assignedPersonName}${payload.assignedPersonEmailLine ? ` · ${payload.assignedPersonEmailLine}` : ''}`
      )}</span>
      <span class="zim-meta-k">Kapsam</span><span class="zim-meta-v">${esc(payload.warehouseScopeLine)}</span>
      <span class="zim-meta-k">Rapor tarihi</span><span class="zim-meta-v">${esc(payload.generatedAtLabel)}</span>
      <span class="zim-meta-k">Kayıtlar</span><span class="zim-meta-v">${esc(payload.rowCountNote)}</span>
      <span class="zim-meta-k">Raporu oluşturan</span><span class="zim-meta-v">${esc(exportedLine)}</span>
    </div>

    <div class="zim-assign-doc-block">
      <div class="zim-assign-heading">${esc(payload.heading || 'Zimmet kalemleri')}</div>
      <div class="zim-table-wrap">
        <table class="zim-data">
          <colgroup>
            <col style="width:6%" />
            <col style="width:18%" />
            <col style="width:12%" />
            <col style="width:10%" />
            <col style="width:7%" />
            <col style="width:7%" />
            <col style="width:11%" />
            <col style="width:10%" />
            <col style="width:11%" />
            <col style="width:8%" />
          </colgroup>
          <thead>
            <tr>
              <th class="zim-th-img">Görsel</th>
              <th>Ürün adı</th>
              <th>SKU</th>
              <th>Marka</th>
              <th class="zim-center">Birim</th>
              <th class="zim-money">Miktar</th>
              <th class="zim-money">Birim fiyat</th>
              <th>Ürün tipi</th>
              <th>Kaynak depo</th>
              <th>Seri no</th>
            </tr>
          </thead>
          <tbody>${buildTableRows(payload.rows)}</tbody>
        </table>
        ${buildTotalsHtml(payload.rows)}
      </div>
    </div>

    ${
      payload.declaration
        ? `<div class="zim-declaration"><div class="zim-declaration-label">Beyan</div>${esc(payload.declaration)}</div>`
        : ''
    }

    <div class="zim-sign-wrap">
      <div class="zim-sign-card">
        <div class="zim-sign-role">${esc(payload.signLeftRole || 'Raporu çıkartan')}</div>
        <div class="zim-sign-person">${esc(payload.exportedByDisplayName)}</div>
        <div class="zim-sign-contact">${payload.exportedByEmail ? esc(payload.exportedByEmail) : '—'}</div>
        <div class="zim-sign-label">Ad soyad &amp; imza</div>
        <div class="zim-sign-line"></div>
      </div>
      <div class="zim-sign-card">
        <div class="zim-sign-role">${esc(payload.signRightRole || 'Zimmetli personel')}</div>
        <div class="zim-sign-person">${esc(payload.assignedPersonName)}</div>
        <div class="zim-sign-contact">${esc(
          payload.signRightNote || 'Liste üzerindeki kalemlerin kullanımından sorumludur.'
        )}</div>
        <div class="zim-sign-label">Ad soyad &amp; imza</div>
        <div class="zim-sign-line"></div>
      </div>
    </div>

    <p style="margin-top:24px;text-align:center;font-size:8pt;color:#9ca3af">${esc(
      payload.footerNote || 'Satın Alma / Envanter — Dovec'
    )}</p>
  </div>
</body>
</html>
  `.trim()
}

function sanitizePdfFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned || 'zimmet-raporu'}.pdf`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function loadLocalAssetAsDataUrl(path: string): Promise<string | null> {
  try {
    const url = new URL(path, window.location.origin).href
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    return await blobToDataUrl(await res.blob())
  } catch {
    return null
  }
}

async function inlineImages(root: ParentNode): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:')) return
      try {
        const absolute = new URL(src, window.location.origin).href
        const res = await fetch(absolute, { mode: 'cors', credentials: 'omit' })
        if (!res.ok) return
        img.src = await blobToDataUrl(await res.blob())
      } catch {
        // html2canvas orijinal src ile deneyecek
      }
    })
  )
}

/** html2canvas büyük görseli doğal boyutuyla basıyor; hücreye sığacak kareye indir. */
async function clampProductImages(root: ParentNode): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img.zim-prod-img'))
  await Promise.all(
    imgs.map(async (node) => {
      const img = node as HTMLImageElement
      if (!img.complete || img.naturalWidth === 0) return
      const size = 32
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight)
      const width = img.naturalWidth * scale
      const height = img.naturalHeight * scale
      ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height)
      img.src = canvas.toDataURL('image/jpeg', 0.86)
      img.width = size
      img.height = size
    })
  )
}

async function waitForImages(root: ParentNode, timeoutMs = 4000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          setTimeout(done, timeoutMs)
        })
    )
  )
}

function triggerPdfDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * Zimmet listesini tarayıcı yazdır diyaloğu açmadan doğrudan PDF olarak indirir.
 */
export async function printZimmetAssignmentListPdf(payload: ZimmetAssignmentListPdfPayload): Promise<void> {
  const logoSrc =
    (await loadLocalAssetAsDataUrl(LOGO_PATH)) || `${window.location.origin}${LOGO_PATH}`
  const htmlContent = buildHtml(payload, logoSrc)
  const filename = sanitizePdfFilename(payload.docTitleSuffix)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: '794px',
    height: '1123px',
    border: '0',
    pointerEvents: 'none',
  })
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    throw new Error('PDF belgesi oluşturulamadı')
  }

  doc.open()
  doc.write(htmlContent)
  doc.close()

  try {
    await Promise.race([
      new Promise<void>((resolve) => {
        iframe.onload = () => resolve()
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 400)),
    ])

    const root = doc.body
    await inlineImages(root)
    await waitForImages(root)
    await clampProductImages(root)
    await new Promise((r) => setTimeout(r, 80))

    const contentHeight = Math.max(root.scrollHeight, root.offsetHeight, 1123)
    iframe.style.height = `${contentHeight}px`

    const { jsPDF } = await import('jspdf')
    const html2canvas = (await import('html2canvas')).default

    const scale = contentHeight > 9000 ? 1 : 2
    const canvas = await html2canvas(root, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 8000,
      windowWidth: 794,
      width: 794,
      height: contentHeight,
      scrollX: 0,
      scrollY: 0,
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0.5) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    triggerPdfDownload(pdf.output('blob'), filename)
  } finally {
    iframe.remove()
  }
}

export const downloadZimmetAssignmentListPdf = printZimmetAssignmentListPdf
