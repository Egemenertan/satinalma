/**
 * Çalışan bazlı depo zimmet envanter listesi — HTML yazdır/PDF (logo + imza blokları).
 */

import { getPDFStyles } from './styles'

const LOGO_PATH = '/d.png'

export type ZimmetAssignmentListRow = {
  ownerEmail: string
  productName: string
  sku: string
  brand: string
  unit: string
  quantity: number
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
  filterNoteTechnical?: string
  rows: ZimmetAssignmentListRow[]
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
  .zim-assignment-accent {
    border-bottom: 3px solid #00E676;
    margin-bottom: 16px;
    padding-bottom: 12px;
  }
  .zim-assignment-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .zim-logo {
    flex-shrink: 0;
    height: 44px;
    width: auto;
    filter: brightness(0);
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
    font-size: 9pt;
    page-break-inside: auto;
  }
  table.zim-data th {
    background: #111;
    color: #fff;
    padding: 8px 6px;
    text-align: left;
    font-weight: 600;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.35px;
    border: 1px solid #000;
  }
  table.zim-data td {
    padding: 7px 6px;
    border: 1px solid #d1d5db;
    vertical-align: top;
    color: #1f2937;
  }
  table.zim-data tr:nth-child(even) td { background: #fafafa; }
  .zim-num { text-align: right; font-variant-numeric: tabular-nums; }
  .zim-footnote {
    margin-top: 14px;
    font-size: 8pt;
    color: #6b7280;
    font-style: italic;
    line-height: 1.45;
    page-break-inside: avoid;
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
    color: #059669;
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

function buildTableRows(rows: ZimmetAssignmentListRow[]): string {
  return rows
    .map(
      (r) => `
    <tr>
      <td>${esc(r.ownerEmail)}</td>
      <td>${esc(r.productName)}</td>
      <td>${esc(r.sku)}</td>
      <td>${esc(r.brand)}</td>
      <td>${esc(r.unit)}</td>
      <td class="zim-num">${esc(String(r.quantity))}</td>
      <td>${esc(r.productType)}</td>
      <td>${esc(r.sourceWarehouse)}</td>
      <td>${esc(r.serialNumber)}</td>
    </tr>`
    )
    .join('')
}

function buildHtml(payload: ZimmetAssignmentListPdfPayload): string {
  const exportedLine = `${payload.exportedByDisplayName}${
    payload.exportedByEmail ? ` · ${payload.exportedByEmail}` : ''
  }`
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(payload.docTitleSuffix)}</title>
  ${getPDFStyles()}
  ${extraCss}
</head>
<body>
  <div class="container">
    <div class="zim-assignment-accent">
      <div class="zim-assignment-header-row">
        <img src="${LOGO_PATH}" alt="Dovec" class="zim-logo" />
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
      <div class="zim-assign-heading">Zimmet kalemleri</div>
      <div class="zim-table-wrap">
        <table class="zim-data">
          <thead>
            <tr>
              <th>Sahip e-posta</th>
              <th>Ürün adı</th>
              <th>SKU</th>
              <th>Marka</th>
              <th>Birim</th>
              <th>Miktar</th>
              <th>Ürün tipi</th>
              <th>Kaynak depo</th>
              <th>Seri no</th>
            </tr>
          </thead>
          <tbody>${buildTableRows(payload.rows)}</tbody>
        </table>
      </div>
    </div>

    ${
      payload.filterNoteTechnical
        ? `<div class="zim-footnote">Teknik not: ${esc(payload.filterNoteTechnical.slice(0, 3500))}</div>`
        : ''
    }

    <div class="zim-sign-wrap">
      <div class="zim-sign-card">
        <div class="zim-sign-role">Raporu çıkartan</div>
        <div class="zim-sign-person">${esc(payload.exportedByDisplayName)}</div>
        <div class="zim-sign-contact">${payload.exportedByEmail ? esc(payload.exportedByEmail) : '—'}</div>
        <div class="zim-sign-label">Ad soyad &amp; imza</div>
        <div class="zim-sign-line"></div>
      </div>
      <div class="zim-sign-card">
        <div class="zim-sign-role">Zimmetli personel</div>
        <div class="zim-sign-person">${esc(payload.assignedPersonName)}</div>
        <div class="zim-sign-contact">Liste üzerindeki kalemlerin kullanımından sorumludur.</div>
        <div class="zim-sign-label">Ad soyad &amp; imza</div>
        <div class="zim-sign-line"></div>
      </div>
    </div>

    <p style="margin-top:24px;text-align:center;font-size:8pt;color:#9ca3af">Satın Alma / Envanter — Dovec</p>
  </div>
</body>
</html>
  `.trim()
}

export async function printZimmetAssignmentListPdf(payload: ZimmetAssignmentListPdfPayload): Promise<void> {
  const htmlContent = buildHtml(payload)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-99999px'
  iframe.style.left = '-99999px'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Iframe document erişilemedi')
  }
  doc.open()
  doc.write(htmlContent)
  doc.close()

  await Promise.race([
    new Promise<void>((resolve) => {
      if (iframe.contentWindow) iframe.contentWindow.onload = () => resolve()
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 350)),
  ])

  const imgs = iframe.contentDocument?.querySelectorAll('img') ?? []
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete) res()
          else {
            img.onload = () => res()
            img.onerror = () => res()
          }
        })
    )
  )
  await new Promise((r) => setTimeout(r, 80))

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  setTimeout(() => document.body.removeChild(iframe), 1000)
}
