import { buildSiteFinanceChartPrintInnerSvg, type SiteFinanceChartPrintInput } from './site-finance-chart-print'
import { getPDFStyles } from './styles'

export type { SiteFinanceChartPrintInput }

/** Sipariş PDF raporu ile aynı logo (components.ts buildHeader). */
export const SITE_REPORT_LOGO_PATH = '/d.png'

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

/** Rapor başı: para birimi bazında faturalanan satırlar */
export type SiteDetailPdfInvoicedCurrencyRow = {
  code: string
  amountLabel: string
}

/** GBP sıralaması üzerinden “en çok faturalanan” tedarikçiler */
export type SiteDetailPdfTopSupplierRow = {
  name: string
  orderCount: number
  invoicedLine: string
  /** Kur varsa ≈ GBP; yoksa null */
  totalGbpLabel: string | null
}

export type SiteDetailPdfPayload = {
  siteName: string
  generatedAtLabel: string
  invoiceFilterLabel: string
  financeFxLabel: string
  chartRangeLabel: string
  invoicedOpening: {
    currencyRows: SiteDetailPdfInvoicedCurrencyRow[]
    /** Seçilen kurlarla konsolide toplam (£…); kur yoksa null */
    totalGbpFormatted: string | null
    /** GBP satırında gösterilecek isteğe bağlı uyarı */
    totalGbpFootnote: string | null
    attributedInvoiceRows: number
    chartCurrenciesLabel: string
  }
  /** En çok faturalanan 3 tedarikçi (GBP yaklaşık tutara göre; kur yoksa TRY toplamları) */
  topInvoicedSuppliers: SiteDetailPdfTopSupplierRow[]
  /** En çok harcama (faturalanan) yapılan 3 malzeme grubu — malzeme tablosundaki sıra ile uyumlu */
  topSpendingMaterialGroups: SiteDetailPdfMaterialRow[]
  kpis: {
    totalRequests: number
    lineItems: number
    avgItemsPerRequestLabel: string
    inPipeline: number
    legacyApproved: number
    requestTrendLabel: string
    ordersCount: number
  }
  suppliers: SiteDetailPdfSupplierRow[]
  materialGroups: SiteDetailPdfMaterialRow[]
  orders: SiteDetailPdfOrderRow[]
  /** Günlük fatura/satır + sipariş eğrisi (şantiye detay grafikleri ile aynı seri); yoksa atlanır */
  dailyFinanceChart: SiteFinanceChartPrintInput | null
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const siteReportExtraStyles = `
<style>
  .site-report-accent {
    border-bottom: 3px solid #00E676;
    margin-bottom: 18px;
    padding-bottom: 12px;
  }
  .site-report-title {
    font-size: 13pt;
    font-weight: 700;
    color: #000;
    margin-top: 8px;
  }
  .site-report-sub {
    font-size: 9pt;
    color: #555;
    margin-top: 4px;
    line-height: 1.35;
  }
  .meta-lines {
    margin: 12px 0 16px;
    padding: 10px 12px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 9pt;
    color: #333;
    line-height: 1.5;
  }
  .kpi-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 9pt;
  }
  .kpi-table th {
    background: #111;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-size: 8pt;
  }
  .kpi-table td {
    padding: 8px 10px;
    border: 1px solid #ddd;
    vertical-align: top;
  }
  .kpi-table tr:nth-child(even) td {
    background: #fafafa;
  }
  .kpi-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .finance-highlight {
    margin: 14px 0 18px;
    padding: 12px 14px;
    border: 2px solid #000;
    border-radius: 4px;
    background: #fafafa;
    page-break-inside: avoid;
  }
  .finance-highlight .label {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #444;
    margin-bottom: 6px;
  }
  .finance-highlight .value {
    font-size: 11pt;
    font-weight: 700;
    color: #000;
    font-family: ui-monospace, monospace;
  }
  .finance-highlight .meta {
    margin-top: 8px;
    font-size: 9pt;
    color: #555;
    line-height: 1.45;
  }
  .invoiced-intro {
    margin: 18px 0 20px;
    page-break-inside: avoid;
  }
  .invoiced-intro .lead {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.45px;
    color: #444;
    margin-bottom: 8px;
  }
  .invoiced-total-gbp-row td {
    background: #eefcf3 !important;
    border-top: 2px solid #00E676 !important;
    font-weight: 700;
    font-family: ui-monospace, monospace;
    font-size: 10pt;
  }
  .spotlight-card {
    margin: 14px 0;
    padding: 12px 14px;
    border: 1px solid #ddd;
    border-left: 4px solid #00E676;
    border-radius: 4px;
    background: #fafafa;
    page-break-inside: avoid;
  }
  .spotlight-card h4 {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #444;
    margin-bottom: 8px;
  }
  .subsection-title {
    font-size: 9pt;
    font-weight: 700;
    color: #333;
    margin: 10px 0 6px;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 9pt;
  }
  .data-table thead th {
    background: #111;
    color: #fff;
    padding: 8px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.35px;
  }
  .data-table td {
    padding: 8px;
    border: 1px solid #ddd;
    vertical-align: top;
  }
  .data-table tbody tr:nth-child(even) {
    background: #fafafa;
  }
  .data-table .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .data-table .narrow {
    width: 36px;
    text-align: center;
  }
  .muted {
    font-size: 8.5pt;
    color: #666;
  }
  .pdf-finance-chart-wrap {
    margin: 0 0 18px;
    padding: 14px 16px 18px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 72%);
    page-break-inside: avoid;
  }
  .pdf-finance-chart-wrap .pdf-finance-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 18px;
    margin: 10px 0 6px;
    font-size: 9pt;
    color: #404040;
  }
  .pdf-finance-chart-wrap .pdf-finance-legend .lg-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .pdf-finance-chart-wrap .pdf-finance-legend .dot {
    width: 26px;
    height: 6px;
    border-radius: 99px;
    flex-shrink: 0;
  }
  .pdf-finance-svg-box {
    margin-top: 4px;
    border-radius: 8px;
    overflow: hidden;
    background: linear-gradient(to bottom, rgba(249,250,251,0.95), transparent);
  }
  .report-footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 8pt;
    color: #888;
    text-align: center;
  }
  @media print {
    .site-report-accent, .finance-highlight, .section, .spotlight-card, .invoiced-intro {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .pdf-finance-chart-wrap {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
</style>
`

function buildDailyFinanceChartBlock(chart: SiteFinanceChartPrintInput | null, chartRangeLabel: string): string {
  if (!chart || chart.labels.length === 0) return ''
  const inner = buildSiteFinanceChartPrintInnerSvg(chart, 'pdfFinanceOrdFill')
  if (!inner.trim()) return ''
  const legendInv = chart.invoiceSeries
    .map(
      (s) =>
        `<span class="lg-item"><span class="dot" style="background:${escapeHtml(s.stroke)}"></span><span>${escapeHtml(s.code)}</span></span>`
    )
    .join('')
  const legendOrder = `<span class="lg-item"><span class="dot" style="background:#6366f1"></span><span>Sipariş (gün)</span></span>`
  return `
    <div class="pdf-finance-chart-wrap">
      <div class="section-title" style="margin-bottom:6px;font-size:11pt;padding-bottom:0;border-bottom:none">Günlük fatura (döviz) · sipariş</div>
      <p class="subsection-title" style="margin-top:0">${escapeHtml(chartRangeLabel)} — şantiye detayı ile aynı zaman penceresi ve veri.</p>
      <div class="pdf-finance-legend">${legendInv}${legendOrder}</div>
      <div class="pdf-finance-svg-box">${inner}</div>
      <p class="muted" style="margin-top:10px;line-height:1.45;font-size:8pt">
        Fatura çizgileri: kök fatura kalemlerinin tarih/gün bazında tutarı (grand_total önceliği). Mor alan/çizgi: o gün oluşturulan sipariş tutarları.
      </p>
    </div>`
}

function buildInvoicedOpeningBlock(o: SiteDetailPdfPayload['invoicedOpening']): string {
  const meta = `
      <div class="meta" style="margin-top:12px;font-size:9pt;color:#555;line-height:1.45">
        Özete dahil fatura kalemi: <strong>${o.attributedInvoiceRows}</strong><br/>
        Grafik para birimleri: <strong>${escapeHtml(o.chartCurrenciesLabel)}</strong>
      </div>`
  if (o.currencyRows.length === 0) {
    return `
    <div class="invoiced-intro finance-highlight">
      <div class="label">Faturalanan toplamlar</div>
      <div class="value">—</div>
      ${meta}
    </div>`
  }
  const bodyRows = o.currencyRows
    .map(
      (r) => `
          <tr>
            <td><strong>${escapeHtml(r.code)}</strong></td>
            <td class="num">${escapeHtml(r.amountLabel)}</td>
          </tr>`
    )
    .join('')

  const gbpRow =
    o.totalGbpFormatted !== null
      ? `
          <tr class="invoiced-total-gbp-row">
            <td>Yaklaşık toplam (GBP)</td>
            <td class="num">${escapeHtml(o.totalGbpFormatted)}</td>
          </tr>${
            o.totalGbpFootnote
              ? `<tr><td colspan="2" class="muted" style="padding-top:6px;border:none">${escapeHtml(o.totalGbpFootnote)}</td></tr>`
              : ''
          }`
      : `
          <tr>
            <td colspan="2" class="muted" style="font-style:italic">GBP konsolidasyon için kurlar gerekli; şu an gösterilmiyor.</td>
          </tr>`

  return `
    <div class="invoiced-intro">
      <div class="finance-highlight">
        <div class="label">Faturalanan toplamlar (para birimi kırılımı)</div>
        <table class="data-table" style="margin-top:10px">
          <thead>
            <tr><th>Para birimi</th><th class="num">Faturalanan tutar</th></tr>
          </thead>
          <tbody>${bodyRows}${gbpRow}</tbody>
        </table>
        ${meta}
      </div>
    </div>`
}

function buildTopSuppliersSpotlight(rows: SiteDetailPdfTopSupplierRow[]): string {
  if (rows.length === 0) {
    return ''
  }
  const inner = rows
    .map(
      (r, idx) => `
      <div class="spotlight-card">
        <h4>#${idx + 1} — ${escapeHtml(r.name)} · ${r.orderCount} sipariş</h4>
        <p class="muted" style="margin-bottom:6px"><strong>Faturalanan:</strong> ${escapeHtml(r.invoicedLine)}</p>
        ${
          r.totalGbpLabel
            ? `<p style="margin:0;font-weight:700;font-family:ui-monospace,monospace">${escapeHtml(r.totalGbpLabel)}</p>`
            : ''
        }
      </div>`
    )
    .join('')
  return `
    <div class="section">
      <div class="section-title">En çok faturalanan tedarikçiler (ilk 3)</div>
      <p class="subsection-title">Faturalanan tutarların GBP karşılığına göre sıralanır; kur verisi yoksa sıralama öncelikle TRY ile yapılır.</p>
      ${inner}
    </div>`
}

function buildTopMaterialsSpotlight(rows: SiteDetailPdfMaterialRow[]): string {
  if (rows.length === 0) {
    return ''
  }
  const inner = rows
    .map(
      (r, idx) => `
      <div class="spotlight-card">
        <h4>#${idx + 1} — ${escapeHtml(r.label)}</h4>
        <p class="muted" style="margin:4px 0">Talep kalemi: <strong>${r.requestItems}</strong> · Verilen sipariş: <strong>${r.orders}</strong></p>
        <p class="muted" style="margin:4px 0"><strong>Toplam harcama (faturalanan):</strong> ${escapeHtml(r.invoicedLine)}</p>
        ${r.gbpApproxLine ? `<p class="muted" style="margin-top:8px">${escapeHtml(r.gbpApproxLine)}</p>` : ''}
      </div>`
    )
    .join('')
  return `
    <div class="section">
      <div class="section-title">En yüksek harcamalı malzeme setleri (ilk 3)</div>
      <p class="subsection-title">Şantiye detayındaki malzeme grupları verisi ile aynı kaynak; sıra GBP’ye göredir.</p>
      ${inner}
    </div>`
}

function buildKpiTable(k: SiteDetailPdfPayload['kpis'], chartRangeLabel: string): string {
  const tw = escapeHtml(chartRangeLabel)
  return `
    <table class="kpi-table">
      <thead>
        <tr><th colspan="2">Genel özet (KPI)</th></tr>
      </thead>
      <tbody>
        <tr><td>Toplam talep</td><td class="num">${k.totalRequests}</td></tr>
        <tr><td>Talep kalemi (satır)</td><td class="num">${k.lineItems}</td></tr>
        <tr><td>Ortalama kalem / talep</td><td class="num">${escapeHtml(k.avgItemsPerRequestLabel)}</td></tr>
        <tr><td>İş akışında</td><td class="num">${k.inPipeline}</td></tr>
        <tr><td>Onaylı (klasik durum)</td><td class="num">${k.legacyApproved}</td></tr>
        <tr><td>Talep trendi (${tw})</td><td class="num">${escapeHtml(k.requestTrendLabel)}</td></tr>
        <tr><td>Sipariş adedi</td><td class="num">${k.ordersCount}</td></tr>
      </tbody>
    </table>`
}

function buildSuppliersTable(rows: SiteDetailPdfSupplierRow[]): string {
  if (rows.length === 0) {
    return '<div class="no-data">Tedarikçi kırılımı kaydı yok.</div>'
  }
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th class="narrow">#</th>
          <th>Tedarikçi</th>
          <th class="num">Sipariş</th>
          <th>Faturalanan (özet)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td class="narrow">${i + 1}</td>
            <td>${escapeHtml(r.name)}</td>
            <td class="num">${r.orderCount}</td>
            <td class="muted">${escapeHtml(r.invoicedLine)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`
}

function buildMaterialGroupsTable(rows: SiteDetailPdfMaterialRow[]): string {
  if (rows.length === 0) {
    return '<div class="no-data">Malzeme grubu / set verisi yok.</div>'
  }
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th class="narrow">#</th>
          <th>Malzeme seti / grup</th>
          <th class="num">Talep kalemi</th>
          <th class="num">Sipariş</th>
          <th>Toplam harcama (faturalanan)</th>
          <th>GBP (yaklaşık)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td class="narrow">${i + 1}</td>
            <td>${escapeHtml(r.label)}</td>
            <td class="num">${r.requestItems}</td>
            <td class="num">${r.orders}</td>
            <td class="muted">${escapeHtml(r.invoicedLine)}</td>
            <td class="muted">${r.gbpApproxLine ? escapeHtml(r.gbpApproxLine) : '—'}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`
}

function buildOrdersTable(rows: SiteDetailPdfOrderRow[], totalCount: number): string {
  const maxRows = 45
  const slice = rows.slice(0, maxRows)
  if (slice.length === 0) {
    return '<div class="no-data">Sipariş kaydı yok.</div>'
  }
  const note =
    totalCount > maxRows
      ? `<p class="muted" style="margin-top:8px">Tabloda ilk ${maxRows} sipariş gösteriliyor (toplam ${totalCount}). Tam liste için uygulamayı kullanın.</p>`
      : ''
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th class="narrow">#</th>
          <th>Tedarikçi</th>
          <th>Talep</th>
          <th class="num">Sipariş tutarı</th>
          <th>Faturalanan</th>
          <th class="num">Tarih</th>
        </tr>
      </thead>
      <tbody>
        ${slice
          .map(
            (o, i) => `
          <tr>
            <td class="narrow">${i + 1}</td>
            <td>${escapeHtml(o.supplier)}</td>
            <td>${escapeHtml(o.request)}</td>
            <td class="num">${escapeHtml(o.orderAmount)}</td>
            <td class="muted">${escapeHtml(o.invoicedLine)}</td>
            <td class="num muted">${escapeHtml(o.date)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>${note}`
}

function buildSiteDetailReportHTML(payload: SiteDetailPdfPayload, fileSlug: string): string {
  const k = payload.kpis

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(payload.siteName)} — Şantiye özeti</title>
  ${getPDFStyles()}
  ${siteReportExtraStyles}
</head>
<body>
  <div class="container">
    <div class="site-report-accent">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
        <img src="${SITE_REPORT_LOGO_PATH}" alt="Logo" style="height: 40px; width: auto; filter: brightness(0);" />
        <div style="text-align: right;">
          <div class="site-report-title">Şantiye finans özeti</div>
          <div class="site-report-sub">${escapeHtml(payload.siteName)}</div>
        </div>
      </div>
    </div>

    <div class="meta-lines">
      <div><strong>Oluşturulma:</strong> ${escapeHtml(payload.generatedAtLabel)}</div>
      <div><strong>Fatura kalemi tarihi (özet):</strong> ${escapeHtml(payload.invoiceFilterLabel)}</div>
      <div><strong>Para görünümü:</strong> ${escapeHtml(payload.financeFxLabel)}</div>
      <div><strong>Grafik zaman penceresi:</strong> ${escapeHtml(payload.chartRangeLabel)}</div>
    </div>

    ${buildDailyFinanceChartBlock(payload.dailyFinanceChart, payload.chartRangeLabel)}

    ${buildInvoicedOpeningBlock(payload.invoicedOpening)}
    ${buildTopSuppliersSpotlight(payload.topInvoicedSuppliers)}
    ${buildTopMaterialsSpotlight(payload.topSpendingMaterialGroups)}

    <div class="section">
      <div class="section-title">Genel KPI</div>
      ${buildKpiTable(k, payload.chartRangeLabel)}
    </div>

    <div class="section">
      <div class="section-title">Tüm tedarikçiler</div>
      ${buildSuppliersTable(payload.suppliers)}
    </div>

    <div class="section">
      <div class="section-title">Tüm malzeme setleri — harcama kırılımı</div>
      ${buildMaterialGroupsTable(payload.materialGroups)}
    </div>

    <div class="section">
      <div class="section-title">Siparişler</div>
      ${buildOrdersTable(payload.orders, payload.orders.length)}
    </div>

    <div class="report-footer">
      Satın Alma — Şantiye raporu · ${escapeHtml(payload.generatedAtLabel)} · ${escapeHtml(fileSlug)}
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Sipariş sayfası PDF’i ile aynı yöntem: HTML + tarayıcı yazdır (marka ve tablolar tutarlı).
 */
export async function generateSiteDetailSummaryPdf(payload: SiteDetailPdfPayload, fileSlug: string): Promise<void> {
  const htmlContent = buildSiteDetailReportHTML(payload, fileSlug)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-99999px'
  iframe.style.left = '-99999px'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.style.border = 'none'

  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    throw new Error('Iframe document not accessible')
  }

  iframeDoc.open()
  iframeDoc.write(htmlContent)
  iframeDoc.close()

  await new Promise<void>((resolve) => {
    if (iframe.contentWindow) {
      iframe.contentWindow.onload = () => setTimeout(() => resolve(), 150)
    } else {
      setTimeout(() => resolve(), 150)
    }
  })

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()

  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
}
