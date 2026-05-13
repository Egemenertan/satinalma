/**
 * Şantiye detay FinanceInvoiceOrderChart ile aynı veri matematiği;
 * yazdır/PDF için statik SVG (hover yok).
 */

export type SiteFinanceChartPrintSeries = {
  code: string
  stroke: string
  daily: number[]
}

export type SiteFinanceChartPrintInput = {
  labels: string[]
  invoiceSeries: SiteFinanceChartPrintSeries[]
  orderDaily: number[]
}

function formatCompactTry(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 0)}K`
  return Math.round(value).toLocaleString('tr-TR')
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type Pt = readonly [number, number]

function buildSvgPaths(input: SiteFinanceChartPrintInput, gradientId: string): string {
  const { labels, invoiceSeries, orderDaily } = input
  const n = Math.max(labels.length, 2)
  const pad = (series: number[]) =>
    series.length < n ? [...series, ...Array(n - series.length).fill(0)] : series
  const ordPad = pad(orderDaily)
  const invoicedSeries = invoiceSeries.map((s) => ({
    code: s.code,
    stroke: s.stroke,
    padded: pad(s.daily),
  }))
  const labPad = labels.length < n ? [...labels, ...Array(n - labels.length).fill('')] : labels

  const flatInv = invoicedSeries.flatMap((s) => s.padded)
  const maxY = Math.max(1, ...ordPad, ...flatInv)

  const W = 1000
  const H = 260
  const pl = 78
  const pr = 28
  const pt = 32
  const pb = 48
  const iw = W - pl - pr
  const ih = H - pt - pb

  const pts = (_series: number[]): Pt[] =>
    labPad.map((_, i) => {
      const x = n <= 1 ? pl + iw / 2 : pl + (i / (n - 1)) * iw
      const v = _series[i] ?? 0
      const y = pt + ih - (v / maxY) * ih
      return [x, y] as const
    })

  const anchorDaily = invoicedSeries[0]?.padded ?? ordPad
  const anchorPts = pts(anchorDaily)
  const ordPts = pts(ordPad)
  const invPtsSeries: Pt[][] = invoicedSeries.map((s) => pts(s.padded))

  const smoothPath = (series: Pt[]): string => {
    if (series.length === 0) return ''
    if (series.length === 1) return `M ${series[0][0]},${series[0][1]}`
    let d = `M ${series[0][0]},${series[0][1]}`
    for (let i = 0; i < series.length - 1; i++) {
      const [x0, y0] = series[i]
      const [x1, y1] = series[i + 1]
      const mx = (x0 + x1) / 2
      d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`
    }
    return d
  }

  const areaPath = (series: Pt[]): string => {
    const line = smoothPath(series)
    if (!line) return ''
    const firstX = series[0][0]
    const lastX = series[series.length - 1][0]
    const base = pt + ih
    return `${line} L ${lastX},${base} L ${firstX},${base} Z`
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = pt + ih - t * ih
    return { y, label: formatCompactTry(t * maxY) }
  })

  const safeGradId = gradientId.replace(/[^a-zA-Z0-9_-]/g, '')

  const gridSvg = gridLines
    .map(
      ({ y, label }, gi) => `
    <g>
      <line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="url(#finance-grid-pdf)" stroke-width="${
        gi === gridLines.length - 1 ? 1.25 : 0.85
      }" opacity="${gi === gridLines.length - 1 ? 0.85 : 0.45}" vector-effect="non-scaling-stroke" />
      <text x="${pl - 12}" y="${y + 4}" text-anchor="end" fill="#9ca3af" font-size="11" font-family="ui-monospace, monospace">${escapeXmlText(label)}</text>
    </g>`
    )
    .join('')

  const orderArea = `<path d="${areaPath(ordPts)}" fill="url(#${safeGradId})" />`

  const invLines = invoicedSeries
    .map((s, si) => {
      const sw = si === 0 ? 2.6 : 2.35
      return `<path d="${smoothPath(invPtsSeries[si]!)}" fill="none" stroke="${escapeXmlText(s.stroke)}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`
    })
    .join('')

  const orderLine = `<path d="${smoothPath(ordPts)}" fill="none" stroke="#6366f1" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round" />`

  const xLabels = labPad
    .map((lbl, i) => {
      if (n > 14 && i % 2 !== 0 && i !== n - 1 && i !== 0) return ''
      const x = anchorPts[i]![0]
      return `<text x="${x}" y="${H - 10}" text-anchor="middle" fill="#737373" font-size="10" font-weight="500" font-family="system-ui, sans-serif">${escapeXmlText(String(lbl))}</text>`
    })
    .join('')

  return `
<svg viewBox="0 0 ${W} ${H}" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="${safeGradId}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="finance-grid-pdf" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#e5e7eb" stop-opacity="0"/>
      <stop offset="8%" stop-color="#e5e7eb" stop-opacity="0.45"/>
      <stop offset="92%" stop-color="#e5e7eb" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#e5e7eb" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${gridSvg}
  ${orderArea}
  ${invLines}
  ${orderLine}
  ${xLabels}
</svg>`
}

export function buildSiteFinanceChartPrintInnerSvg(input: SiteFinanceChartPrintInput, gradientId: string): string {
  return buildSvgPaths(input, gradientId)
}
