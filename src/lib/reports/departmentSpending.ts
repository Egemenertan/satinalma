/**
 * Departman bazlı talep + fatura harcama raporu yardımcıları
 */

import { effectiveInvoiceAmount } from '@/lib/site-invoice-aggregation'
import { isPazarlamaDepartment } from '@/lib/it-workflow'
import { aggregateCurrencyTotalsViaEurCross } from '@/lib/fx/convertViaEurRates'

/** Her kelimenin baş harfi büyük (TR) */
export function titleCaseDepartmentName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.toLocaleLowerCase('tr-TR') === 'it') return 'IT'
      const lower = word.toLocaleLowerCase('tr-TR')
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1)
    })
    .join(' ')
}

/** PDF header’daki departman adı — Pazarlama → IT - Pazarlama */
export function formatDepartmentPdfLabel(department: string): string {
  const raw = (department || '').trim()
  if (!raw) return '—'
  if (raw === 'Tüm departmanlar') return raw
  if (isPazarlamaDepartment(raw)) return 'IT - Pazarlama'
  return titleCaseDepartmentName(raw)
}

export type DepartmentSpendingFilters = {
  department?: string | null
  /** YYYY-MM (aylık) */
  month?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

export type CurrencyAmount = {
  currency: string
  amount: number
}

export type DepartmentSpendingSummary = {
  department: string
  requestCount: number
  materialLineCount: number
  materialQuantitySum: number
  invoiceCount: number
  totalsByCurrency: CurrencyAmount[]
  /** Güncel ECB/Frankfurter kuru ile USD karşılığı */
  totalUsd: number | null
  fxDate: string | null
  fxIncomplete: boolean
}

export type DepartmentManagerInfo = {
  fullName: string
  email: string | null
  department: string
}

export type DepartmentSpendingLine = {
  requestId: string
  requestNumber: string
  requestCreatedAt: string
  department: string
  siteName: string | null
  itemId: string
  itemName: string
  purpose: string | null
  description: string | null
  /** Malzeme adının altında gösterilecek detay satırları (marka, spesifikasyon, link vb.) */
  itemDetails: string[]
  quantity: number
  unit: string | null
  invoiceCount: number
  invoiceTotalsByCurrency: CurrencyAmount[]
  /** Satır faturalarının güncel kurla USD karşılığı */
  totalUsd: number | null
}

export type PurposeSpendingBucket = {
  purpose: string
  lineCount: number
  invoiceCount: number
  totalsByCurrency: CurrencyAmount[]
  totalUsd: number | null
  /** Amaç payı (toplam USD üzerinden, yoksa null) */
  sharePct: number | null
  /** Örnek açıklamalar */
  descriptions: string[]
}

export type LargeSpendHighlight = {
  requestNumber: string
  itemName: string
  purpose: string | null
  description: string | null
  totalsByCurrency: CurrencyAmount[]
  totalUsd: number
}

export type DepartmentSpendingInsights = {
  /** En çok harcanan 3 amaç */
  topPurposes: PurposeSpendingBucket[]
  /** Kısa özet cümle(ler) */
  purposeNotes: string[]
  /** ≥ 1000 USD satırlar (büyükten küçüğe) */
  largeSpends: LargeSpendHighlight[]
  largeSpendThresholdUsd: number
}

export type DepartmentSpendingReport = {
  filters: {
    department: string | null
    dateFrom: string
    dateTo: string
  }
  summary: DepartmentSpendingSummary
  departmentBreakdown: DepartmentSpendingSummary[]
  /** Seçili departmanın site_manager kayıtları (Departman yöneticisi) */
  departmentManagers: DepartmentManagerInfo[]
  insights: DepartmentSpendingInsights
  lines: DepartmentSpendingLine[]
}

export function resolveReportDateRange(filters: DepartmentSpendingFilters): {
  dateFrom: string
  dateTo: string
} {
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    const [y, m] = filters.month.split('-').map(Number)
    const from = new Date(y, m - 1, 1, 0, 0, 0, 0)
    const to = new Date(y, m, 0, 23, 59, 59, 999)
    return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
  }

  const fromRaw = filters.dateFrom?.trim()
  const toRaw = filters.dateTo?.trim()
  if (fromRaw && toRaw) {
    const from = new Date(fromRaw)
    from.setHours(0, 0, 0, 0)
    const to = new Date(toRaw)
    to.setHours(23, 59, 59, 999)
    return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
  }

  // Varsayılan: içinde bulunulan ay
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
}

export function mergeCurrencyAmounts(
  rows: Array<{ currency?: string | null; amount: number }>
): CurrencyAmount[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const cur = (row.currency || 'TRY').trim().toUpperCase() || 'TRY'
    map.set(cur, (map.get(cur) || 0) + (Number.isFinite(row.amount) ? row.amount : 0))
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function emptySummary(department: string): DepartmentSpendingSummary {
  return {
    department,
    requestCount: 0,
    materialLineCount: 0,
    materialQuantitySum: 0,
    invoiceCount: 0,
    totalsByCurrency: [],
    totalUsd: null,
    fxDate: null,
    fxIncomplete: false,
  }
}

/** Marka / spesifikasyon / açıklama / amaç — isimle aynıysa atlanır */
export function buildItemDetailLines(item: {
  item_name?: string | null
  brand?: string | null
  description?: string | null
  specifications?: string | null
  purpose?: string | null
}): string[] {
  const name = (item.item_name || '').trim().toLowerCase()
  const out: string[] = []
  const push = (label: string, raw: string | null | undefined) => {
    const v = (raw || '').trim()
    if (!v) return
    if (v.toLowerCase() === name) return
    out.push(`${label}: ${v}`)
  }
  push('Marka', item.brand)
  push('Açıklama', item.description)
  push('Spesifikasyon / link', item.specifications)
  push('Amaç', item.purpose)
  return out
}

export const LARGE_SPEND_USD_THRESHOLD = 1000

export function normalizePurposeLabel(raw: string | null | undefined): string {
  const v = (raw || '').trim()
  if (!v) return 'Belirtilmemiş'
  if (v.toLocaleLowerCase('tr-TR') === 'it') return 'IT'
  return titleCaseDepartmentName(v)
}

export function emptyInsights(): DepartmentSpendingInsights {
  return {
    topPurposes: [],
    purposeNotes: [],
    largeSpends: [],
    largeSpendThresholdUsd: LARGE_SPEND_USD_THRESHOLD,
  }
}

type FxLike = { rates: Record<string, number> } | null

function totalsToUsd(
  totals: CurrencyAmount[],
  fx: FxLike
): number | null {
  if (!fx || totals.length === 0) return null
  const map = new Map(totals.map((t) => [t.currency, t.amount]))
  const { value, incomplete } = aggregateCurrencyTotalsViaEurCross(map, 'USD', fx.rates)
  if (incomplete && value === 0) return null
  return value
}

/** Amaç dağılımı (top 3) + ≥1000 USD büyük harcamalar */
export function buildSpendingInsights(
  lines: DepartmentSpendingLine[],
  fx: FxLike,
  reportTotalUsd: number | null
): DepartmentSpendingInsights {
  const byPurpose = new Map<
    string,
    {
      lineCount: number
      invoiceCount: number
      currencyRows: Array<{ currency: string; amount: number }>
      descriptions: string[]
      descSeen: Set<string>
    }
  >()

  for (const line of lines) {
    const key = normalizePurposeLabel(line.purpose)
    let bucket = byPurpose.get(key)
    if (!bucket) {
      bucket = {
        lineCount: 0,
        invoiceCount: 0,
        currencyRows: [],
        descriptions: [],
        descSeen: new Set(),
      }
      byPurpose.set(key, bucket)
    }
    bucket.lineCount += 1
    bucket.invoiceCount += line.invoiceCount
    for (const t of line.invoiceTotalsByCurrency) {
      bucket.currencyRows.push({ currency: t.currency, amount: t.amount })
    }
    const desc = (line.description || '').trim()
    if (desc && !bucket.descSeen.has(desc.toLowerCase()) && bucket.descriptions.length < 4) {
      bucket.descSeen.add(desc.toLowerCase())
      bucket.descriptions.push(desc)
    }
  }

  const allPurposes: PurposeSpendingBucket[] = [...byPurpose.entries()].map(([purpose, b]) => {
    const totalsByCurrency = mergeCurrencyAmounts(b.currencyRows)
    const totalUsd = totalsToUsd(totalsByCurrency, fx)
    return {
      purpose,
      lineCount: b.lineCount,
      invoiceCount: b.invoiceCount,
      totalsByCurrency,
      totalUsd,
      sharePct: null,
      descriptions: b.descriptions,
    }
  })

  allPurposes.sort((a, b) => {
    const au = a.totalUsd ?? a.totalsByCurrency.reduce((s, c) => s + c.amount, 0)
    const bu = b.totalUsd ?? b.totalsByCurrency.reduce((s, c) => s + c.amount, 0)
    return bu - au
  })

  const topPurposes = allPurposes.slice(0, 3).map((p) => ({
    ...p,
    sharePct:
      reportTotalUsd != null && reportTotalUsd > 0 && p.totalUsd != null
        ? Math.round((p.totalUsd / reportTotalUsd) * 1000) / 10
        : null,
  }))

  const purposeNotes: string[] = []
  if (topPurposes.length > 0) {
    const top = topPurposes[0]
    const share =
      top.sharePct != null ? ` (toplamın %${top.sharePct.toLocaleString('tr-TR')}'i)` : ''
    const usd =
      top.totalUsd != null
        ? ` ≈ ${top.totalUsd.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} USD`
        : ''
    purposeNotes.push(
      `En yüksek harcama «${top.purpose}» amacında${share}${usd}.`
    )
    if (top.sharePct != null && top.sharePct >= 40) {
      purposeNotes.push(
        `«${top.purpose}» amacı dönem harcamasının büyük kısmını oluşturuyor; incelemeyi buraya yoğunlaştırmak faydalı olabilir.`
      )
    }
    for (let i = 1; i < topPurposes.length; i++) {
      const p = topPurposes[i]
      const amt =
        p.totalUsd != null
          ? `${p.totalUsd.toLocaleString('tr-TR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} USD`
          : formatTotalsPlain(p.totalsByCurrency)
      purposeNotes.push(`${i + 1}. sıra: «${p.purpose}» — ${amt}.`)
    }
  } else {
    purposeNotes.push('Bu dönemde amaç bazlı fatura harcaması bulunamadı.')
  }

  const largeSpends: LargeSpendHighlight[] = lines
    .filter((l) => l.totalUsd != null && l.totalUsd >= LARGE_SPEND_USD_THRESHOLD)
    .map((l) => ({
      requestNumber: l.requestNumber,
      itemName: l.itemName,
      purpose: l.purpose ? normalizePurposeLabel(l.purpose) : null,
      description: (l.description || '').trim() || null,
      totalsByCurrency: l.invoiceTotalsByCurrency,
      totalUsd: l.totalUsd as number,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd)

  if (largeSpends.length > 0) {
    purposeNotes.push(
      `${largeSpends.length} kalemde ${LARGE_SPEND_USD_THRESHOLD.toLocaleString('tr-TR')} USD ve üzeri harcama var.`
    )
  }

  return {
    topPurposes,
    purposeNotes,
    largeSpends,
    largeSpendThresholdUsd: LARGE_SPEND_USD_THRESHOLD,
  }
}

function formatTotalsPlain(rows: CurrencyAmount[]): string {
  if (!rows.length) return '—'
  return rows
    .map(
      (r) =>
        `${r.amount.toLocaleString('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${r.currency}`
    )
    .join(' · ')
}

export { effectiveInvoiceAmount }
