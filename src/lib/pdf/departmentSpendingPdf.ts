/**
 * Departman harcama raporu — HTML yazdır/PDF (zimmet listesi ile aynı görsel dil).
 */

import { getPDFStyles } from './styles'
import {
  formatDepartmentPdfLabel,
  type CurrencyAmount,
  type DepartmentSpendingInsights,
  type DepartmentSpendingLine,
} from '@/lib/reports/departmentSpending'

const LOGO_PATH = '/d.png'

export type DepartmentSpendingPdfPayload = {
  docTitle: string
  titleMain: string
  titleSub: string
  departmentLabel: string
  /** "Ad Soyad · email" veya birden fazla kişi */
  departmentManagerLabel: string
  dateRangeLabel: string
  generatedAtLabel: string
  requestCount: number
  materialLineCount: number
  materialQuantitySum: number
  invoiceCount: number
  totalsByCurrency: CurrencyAmount[]
  totalUsd: number | null
  fxDate: string | null
  fxIncomplete?: boolean
  insights: DepartmentSpendingInsights
  lines: DepartmentSpendingLine[]
}

function esc(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function formatTotals(rows: CurrencyAmount[]): string {
  if (!rows.length) return '—'
  return rows.map((r) => formatMoney(r.amount, r.currency)).join(' · ')
}

const extraCss = `
<style>
  @page {
    size: A4 landscape;
    margin: 8mm 10mm;
  }
  .dep-accent {
    border-bottom: 2px solid #00E676;
    margin-bottom: 8px;
    padding-bottom: 6px;
  }
  .dep-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .dep-logo {
    flex-shrink: 0;
    height: 32px;
    width: auto;
    filter: brightness(0);
  }
  .dep-titles { text-align: right; flex: 1; min-width: 0; }
  .dep-main-title {
    font-size: 11.5pt;
    font-weight: 700;
    color: #000;
    letter-spacing: 0.02em;
  }
  .dep-sub-title {
    font-size: 8pt;
    color: #555;
    margin-top: 2px;
    line-height: 1.3;
  }
  .dep-meta-grid {
    display: grid;
    grid-template-columns: 118px 1fr 118px 1fr;
    gap: 3px 12px;
    font-size: 8pt;
    margin-bottom: 8px;
    padding: 7px 10px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .dep-meta-k { font-weight: 600; color: #374151; }
  .dep-meta-v { color: #111827; word-break: break-word; }
  .dep-doc-block {
    margin-top: 8px;
    margin-bottom: 10px;
    page-break-inside: auto;
  }
  .dep-heading {
    font-size: 9pt;
    font-weight: 600;
    margin-bottom: 5px;
    padding-bottom: 3px;
    border-bottom: 1px solid #ddd;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #000;
    page-break-after: avoid;
  }
  table.dep-data {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 7.5pt;
    page-break-inside: auto;
  }
  table.dep-data col.c-talep { width: 14%; }
  table.dep-data col.c-item { width: 48%; }
  table.dep-data col.c-qty { width: 12%; }
  table.dep-data col.c-inv { width: 6%; }
  table.dep-data col.c-amt { width: 20%; }
  table.dep-data th {
    background: #111;
    color: #fff;
    padding: 5px 4px;
    text-align: left;
    font-weight: 600;
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 0.25px;
    border: 1px solid #000;
  }
  table.dep-data th.dep-num,
  table.dep-data td.dep-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  table.dep-data td {
    padding: 4px;
    border: 1px solid #d1d5db;
    vertical-align: top;
    color: #1f2937;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  table.dep-data tr:nth-child(even) td { background: #fafafa; }
  table.dep-data td.dep-amt {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7pt;
    line-height: 1.3;
    white-space: normal;
  }
  table.dep-data td.dep-amt .amt-line { display: block; }
  .dep-total-box {
    margin-top: 10px;
    padding: 10px 12px;
    border: 2px solid #111;
    border-radius: 8px;
    background: #f9fafb;
    page-break-inside: avoid;
  }
  .dep-total-label {
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #059669;
    margin-bottom: 4px;
  }
  .dep-total-amount {
    font-size: 12pt;
    font-weight: 700;
    color: #000;
    word-break: break-word;
  }
  .dep-total-meta {
    margin-top: 6px;
    font-size: 8pt;
    color: #4b5563;
    line-height: 1.4;
  }
  .dep-insight {
    margin-bottom: 6px;
  }
  .dep-insight-grid {
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 8px;
    align-items: start;
  }
  .dep-insight-box {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fafafa;
    padding: 7px 8px;
  }
  .dep-insight-box.dep-large {
    border-color: #f59e0b;
    background: #fffbeb;
  }
  .dep-insight-title {
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #111;
    margin-bottom: 5px;
  }
  .dep-notes {
    margin: 0 0 6px;
    padding-left: 14px;
    font-size: 7.5pt;
    color: #374151;
    line-height: 1.35;
  }
  .dep-notes li { margin-bottom: 1px; }
  table.dep-sum {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 7pt;
  }
  table.dep-sum th {
    background: #111;
    color: #fff;
    padding: 4px 3px;
    text-align: left;
    font-size: 6.5pt;
    text-transform: uppercase;
    border: 1px solid #000;
  }
  table.dep-sum td {
    padding: 4px 3px;
    border: 1px solid #d1d5db;
    vertical-align: top;
  }
  table.dep-sum .dep-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7pt;
  }
  .dep-desc {
    display: block;
    color: #6b7280;
    font-size: 6.5pt;
    margin-top: 1px;
    line-height: 1.25;
  }
  .dep-rank {
    display: inline-block;
    min-width: 14px;
    font-weight: 700;
    color: #059669;
  }
  .dep-more {
    margin: 4px 0 0;
    font-size: 7pt;
    color: #6b7280;
  }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    table.dep-data thead,
    table.dep-sum thead { display: table-header-group; }
    table.dep-data tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
</style>
`

function formatTotalsHtml(rows: CurrencyAmount[]): string {
  if (!rows.length) return '—'
  return rows
    .map((r) => `<span class="amt-line">${esc(formatMoney(r.amount, r.currency))}</span>`)
    .join('')
}

function buildTableRows(lines: DepartmentSpendingLine[]): string {
  return lines
    .map((l) => {
      const date = l.requestCreatedAt
        ? new Date(l.requestCreatedAt).toLocaleDateString('tr-TR')
        : '—'
      const qty = `${l.quantity.toLocaleString('tr-TR')}${l.unit ? ` ${l.unit}` : ''}`
      const details =
        l.itemDetails && l.itemDetails.length
          ? `<br/>${l.itemDetails
              .slice(0, 2)
              .map(
                (d) =>
                  `<span style="display:block;color:#6b7280;font-size:6.5pt;margin-top:1px;line-height:1.25">${esc(truncateText(d, 110))}</span>`
              )
              .join('')}${
              l.itemDetails.length > 2
                ? `<span style="display:block;color:#9ca3af;font-size:6.5pt">+${l.itemDetails.length - 2} detay</span>`
                : ''
            }`
          : ''
      return `
    <tr>
      <td>${esc(l.requestNumber)}<br/><span style="color:#6b7280;font-size:7pt">${esc(date)}</span></td>
      <td><strong>${esc(l.itemName)}</strong>${details}</td>
      <td class="dep-num">${esc(qty)}</td>
      <td class="dep-num">${esc(String(l.invoiceCount))}</td>
      <td class="dep-num dep-amt">${formatTotalsHtml(l.invoiceTotalsByCurrency)}</td>
    </tr>`
    })
    .join('')
}

function truncateText(raw: string, max = 90): string {
  const t = raw.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function buildInsightsHtml(insights: DepartmentSpendingInsights): string {
  const notesList = insights.purposeNotes.slice(0, 2)
  const notes =
    notesList.length > 0
      ? `<ul class="dep-notes">${notesList.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
      : ''

  const purposeRows =
    insights.topPurposes.length === 0
      ? `<tr><td colspan="3" style="text-align:center;color:#6b7280">Amaç dağılımı yok.</td></tr>`
      : insights.topPurposes
          .map((p, i) => {
            const usd =
              p.totalUsd != null
                ? `${p.totalUsd.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USD`
                : '—'
            const share = p.sharePct != null ? ` · %${p.sharePct.toLocaleString('tr-TR')}` : ''
            const descs = p.descriptions
              .slice(0, 2)
              .map((d) => `<span class="dep-desc">${esc(truncateText(d, 100))}</span>`)
              .join('')
            return `<tr>
              <td><span class="dep-rank">${i + 1}.</span> <strong>${esc(p.purpose)}</strong>${descs || ''}</td>
              <td class="dep-num">${formatTotalsHtml(p.totalsByCurrency)}</td>
              <td class="dep-num"><strong>${esc(usd)}</strong>${esc(share)}</td>
            </tr>`
          })
          .join('')

  const largeLimit = 6
  const largeShown = insights.largeSpends.slice(0, largeLimit)
  const largeBox =
    insights.largeSpends.length === 0
      ? `<div class="dep-insight-box dep-large"><div class="dep-insight-title">Büyük harcamalar (≥ ${insights.largeSpendThresholdUsd.toLocaleString('tr-TR')} USD)</div><p class="dep-more">Bu eşiği aşan kalem yok.</p></div>`
      : `<div class="dep-insight-box dep-large">
          <div class="dep-insight-title">Büyük harcamalar (≥ ${insights.largeSpendThresholdUsd.toLocaleString('tr-TR')} USD) — ${insights.largeSpends.length}</div>
          <table class="dep-sum">
            <colgroup>
              <col style="width:16%" />
              <col style="width:40%" />
              <col style="width:16%" />
              <col style="width:28%" />
            </colgroup>
            <thead>
              <tr>
                <th>Talep</th>
                <th>Malzeme</th>
                <th>Amaç</th>
                <th class="dep-num">USD</th>
              </tr>
            </thead>
            <tbody>
              ${largeShown
                .map((s) => {
                  const desc = s.description
                    ? `<span class="dep-desc">${esc(truncateText(s.description, 80))}</span>`
                    : ''
                  const usd = `${s.totalUsd.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USD`
                  return `<tr>
                    <td>${esc(s.requestNumber)}</td>
                    <td><strong>${esc(truncateText(s.itemName, 48))}</strong>${desc}</td>
                    <td>${esc(s.purpose || '—')}</td>
                    <td class="dep-num"><strong>${esc(usd)}</strong></td>
                  </tr>`
                })
                .join('')}
            </tbody>
          </table>
          ${
            insights.largeSpends.length > largeLimit
              ? `<p class="dep-more">+${insights.largeSpends.length - largeLimit} kalem daha (detay tabloda)</p>`
              : ''
          }
        </div>`

  return `
    <div class="dep-insight">
      <div class="dep-heading">Özet — amaç dağılımı ve büyük harcamalar</div>
      ${notes}
      <div class="dep-insight-grid">
        <div class="dep-insight-box">
          <div class="dep-insight-title">En fazla harcama — 3 amaç</div>
          <table class="dep-sum">
            <colgroup>
              <col style="width:46%" />
              <col style="width:28%" />
              <col style="width:26%" />
            </colgroup>
            <thead>
              <tr>
                <th>Amaç / açıklama</th>
                <th class="dep-num">Fatura</th>
                <th class="dep-num">USD</th>
              </tr>
            </thead>
            <tbody>${purposeRows}</tbody>
          </table>
        </div>
        ${largeBox}
      </div>
    </div>`
}

function buildHtml(payload: DepartmentSpendingPdfPayload): string {
  const deptLabel = formatDepartmentPdfLabel(payload.departmentLabel)
  const totalLine = formatTotals(payload.totalsByCurrency)
  const usdLine =
    payload.totalUsd != null
      ? `${payload.totalUsd.toLocaleString('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} USD`
      : null
  const insightsHtml = buildInsightsHtml(payload.insights)

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(payload.docTitle)}</title>
  ${getPDFStyles()}
  ${extraCss}
</head>
<body>
  <div class="container">
    <div class="dep-accent">
      <div class="dep-header-row">
        <img src="${LOGO_PATH}" alt="Dovec" class="dep-logo" />
        <div class="dep-titles">
          <div class="dep-main-title">${esc(payload.titleMain)}</div>
          <div class="dep-sub-title">${esc(payload.titleSub)}</div>
        </div>
      </div>
    </div>

    <div class="dep-meta-grid">
      <span class="dep-meta-k">Departman</span><span class="dep-meta-v">${esc(deptLabel)}</span>
      <span class="dep-meta-k">Departman yöneticisi</span><span class="dep-meta-v">${esc(
        payload.departmentManagerLabel || '—'
      )}</span>
      <span class="dep-meta-k">Tarih aralığı</span><span class="dep-meta-v">${esc(payload.dateRangeLabel)}</span>
      <span class="dep-meta-k">Rapor tarihi</span><span class="dep-meta-v">${esc(payload.generatedAtLabel)}</span>
      <span class="dep-meta-k">Talep / kalem</span><span class="dep-meta-v">${esc(
        `${payload.requestCount} talep · ${payload.materialLineCount} kalem · miktar ${payload.materialQuantitySum.toLocaleString('tr-TR')}`
      )}</span>
      <span class="dep-meta-k">Fatura adedi</span><span class="dep-meta-v">${esc(String(payload.invoiceCount))}</span>
    </div>

    ${insightsHtml}

    <div class="dep-doc-block">
      <div class="dep-heading">Malzeme kalemleri ve faturalar</div>
      <table class="dep-data">
        <colgroup>
          <col class="c-talep" />
          <col class="c-item" />
          <col class="c-qty" />
          <col class="c-inv" />
          <col class="c-amt" />
        </colgroup>
        <thead>
          <tr>
            <th>Talep</th>
            <th>Malzeme</th>
            <th class="dep-num">Miktar</th>
            <th class="dep-num">Fat.</th>
            <th class="dep-num">Tutar</th>
          </tr>
        </thead>
        <tbody>${
          payload.lines.length
            ? buildTableRows(payload.lines)
            : `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:16px">Bu aralıkta kalem yok.</td></tr>`
        }</tbody>
      </table>
    </div>

    <div class="dep-total-box">
      <div class="dep-total-label">Toplam tutar (para birimi bazlı)</div>
      <div class="dep-total-amount">${esc(totalLine)}</div>
      ${
        usdLine
          ? `<div class="dep-total-label" style="margin-top:12px">Toplam USD (güncel kur)</div>
      <div class="dep-total-amount">${esc(usdLine)}</div>
      <div class="dep-total-meta">Kur kaynağı: ECB / Frankfurter${
        payload.fxDate ? ` · kur tarihi: ${esc(payload.fxDate)}` : ''
      }${
        payload.fxIncomplete
          ? ' · bazı para birimleri çevrilemedi'
          : ''
      }</div>`
          : `<div class="dep-total-meta" style="margin-top:8px">USD karşılığı hesaplanamadı (kur alınamadı).</div>`
      }
      <div class="dep-total-meta">
        Tarih aralığı: <strong>${esc(payload.dateRangeLabel)}</strong><br/>
        Departman: <strong>${esc(deptLabel)}</strong> ·
        ${esc(String(payload.invoiceCount))} fatura ·
        ${esc(String(payload.materialLineCount))} malzeme kalemi
      </div>
    </div>

    <p style="margin-top:24px;text-align:center;font-size:8pt;color:#9ca3af">Satın Alma / Raporlar — Dovec</p>
  </div>
</body>
</html>
  `.trim()
}

export async function printDepartmentSpendingPdf(
  payload: DepartmentSpendingPdfPayload
): Promise<void> {
  const htmlContent = buildHtml(payload)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-99999px'
  iframe.style.left = '-99999px'
  iframe.style.width = '297mm'
  iframe.style.height = '210mm'
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
          if (img.complete && img.naturalWidth > 0) res()
          else {
            img.onload = () => res()
            img.onerror = () => res()
            setTimeout(() => res(), 2500)
          }
        })
    )
  )
  await new Promise((r) => setTimeout(r, 80))

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  setTimeout(() => document.body.removeChild(iframe), 1000)
}
