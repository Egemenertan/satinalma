/**
 * Şantiye / sipariş ekranında fatura tutarlarını toplamak.
 * Siparişler sayfasıyla uyumlu: grand_total varsa o, yoksa amount.
 * parent_invoice_id dolu satırlar (ana faturaya bağlı kırılımlar) toplama dahil edilmez — çift sayım önlenir.
 */

export interface InvoiceAmountRow {
  order_id: string
  amount: number | string | null
  grand_total?: number | string | null
  currency?: string | null
  created_at?: string | null
  parent_invoice_id?: string | null
  is_master?: boolean | null
}

export type CurrencyTotals = Map<string, number>

/** Siparişler sayfası `DateFilter` ile aynı şekilde; kök fatura kalemleri `created_at` ile süzülür. */
export type InvoiceTotalsDateRange = { from: Date | undefined; to?: Date | undefined }

/**
 * `from`/`to` yokken tüm kayıtlar; aksi halde sipariş listesi (`buildDateQuery`) ile uyumlu gün sınırları (yerel 00:00–23:59:59).
 * Aralıkta iken `created_at` eksik/geçersiz olan satırlar elenir.
 */
export function filterInvoiceRowsByCreatedAtRange(
  rows: InvoiceAmountRow[],
  range: InvoiceTotalsDateRange
): InvoiceAmountRow[] {
  if (!range.from && !range.to) return rows

  let startMs: number | null = null
  let endMs: number | null = null

  if (range.from && range.to) {
    const start = new Date(range.from)
    const end = new Date(range.to)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    startMs = start.getTime()
    endMs = end.getTime()
  } else if (range.from) {
    const start = new Date(range.from)
    start.setHours(0, 0, 0, 0)
    startMs = start.getTime()
  } else if (range.to) {
    const end = new Date(range.to)
    end.setHours(23, 59, 59, 999)
    endMs = end.getTime()
  }

  return rows.filter((row) => {
    const raw = row.created_at
    if (raw == null || raw === '') return false
    const t = new Date(raw).getTime()
    if (!Number.isFinite(t)) return false
    if (startMs !== null && t < startMs) return false
    if (endMs !== null && t > endMs) return false
    return true
  })
}

export function effectiveInvoiceAmount(inv: Pick<InvoiceAmountRow, 'amount' | 'grand_total'>): number {
  const g = inv.grand_total
  if (g != null && g !== '') {
    const gn = typeof g === 'string' ? parseFloat(g) : Number(g)
    if (Number.isFinite(gn)) return gn
  }
  const a = inv.amount
  const an = typeof a === 'string' ? parseFloat(a) : Number(a ?? 0)
  return Number.isFinite(an) ? an : 0
}

function invoiceCurrencyCode(row: InvoiceAmountRow): string {
  const c = row.currency
  return (c && String(c).trim()) || 'TRY'
}

/** Toplama dahil: şantiye siparişlerine ait ve üst faturaya bağlı olmayan satırlar */
export function invoiceRowsForSiteOrders(orderIds: string[], invoices: InvoiceAmountRow[]): InvoiceAmountRow[] {
  if (orderIds.length === 0) return []
  const allow = new Set(orderIds)
  return invoices.filter((i) => allow.has(i.order_id) && !i.parent_invoice_id)
}

/** Sipariş id → malzeme grubu etiketi; eşleşme yoksa `unattributedLabel` (varsayılan: satır seçilmemiş sipariş) grubuna yazılır. */
export function invoicedCurrencyTotalsByOrderGroup(
  invoices: InvoiceAmountRow[],
  orderIdToGroupLabel: Map<string, string>,
  allowedOrderIds: Iterable<string>,
  options?: { unattributedLabel?: string }
): Map<string, CurrencyTotals> {
  const allow = new Set(allowedOrderIds)
  const fallbackLabel = options?.unattributedLabel ?? 'Satır seçilmemiş sipariş'
  const out = new Map<string, CurrencyTotals>()
  const mergeInto = (g: string, cur: string, amt: number) => {
    let m = out.get(g)
    if (!m) {
      m = new Map()
      out.set(g, m)
    }
    m.set(cur, (m.get(cur) ?? 0) + amt)
  }
  for (const row of invoices) {
    if (!row.order_id || row.parent_invoice_id) continue
    if (!allow.has(row.order_id)) continue
    const g = orderIdToGroupLabel.get(row.order_id) ?? fallbackLabel
    mergeInto(g, invoiceCurrencyCode(row), effectiveInvoiceAmount(row))
  }
  return out
}

export function normalizedMaterialGroupLabel(raw: string | null | undefined): string {
  const s = raw?.trim()
  return s && s.length > 0 ? s : 'Malzeme grubu belirsiz'
}

/** Şantiye siparişlerine ait faturalar — para birimine göre toplam (fatura satırındaki currency) */
export function aggregateInvoicesByCurrency(orderIds: string[], invoices: InvoiceAmountRow[]): CurrencyTotals {
  const m: CurrencyTotals = new Map()
  for (const row of invoiceRowsForSiteOrders(orderIds, invoices)) {
    const cur = invoiceCurrencyCode(row)
    const amt = effectiveInvoiceAmount(row)
    m.set(cur, (m.get(cur) ?? 0) + amt)
  }
  return m
}

export function totalInvoicedForOrderIds(orderIds: string[], invoices: InvoiceAmountRow[]): number {
  return invoiceRowsForSiteOrders(orderIds, invoices).reduce((s, i) => s + effectiveInvoiceAmount(i), 0)
}

export function countAttributedInvoiceRows(orderIds: string[], invoices: InvoiceAmountRow[]): number {
  return invoiceRowsForSiteOrders(orderIds, invoices).length
}

/** Günlük fatura tutarı (fatura created_at gününe göre) — para birimi ayrımı yok */
export function dailyInvoiceAmountsByDayKey(
  orderIds: string[],
  invoices: InvoiceAmountRow[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of invoiceRowsForSiteOrders(orderIds, invoices)) {
    if (!row.created_at) continue
    const dayKey = new Date(row.created_at).toISOString().slice(0, 10)
    const amt = effectiveInvoiceAmount(row)
    map.set(dayKey, (map.get(dayKey) ?? 0) + amt)
  }
  return map
}

/** ISO gün anahtarı (yyyy-mm-dd) → günlük fatura kalemleri, para birimine göre (kök satırlar) */
export function dailyInvoiceTotalsPerCurrencyByDayKey(
  orderIds: string[],
  invoices: InvoiceAmountRow[]
): Map<string, CurrencyTotals> {
  const out = new Map<string, CurrencyTotals>()
  for (const row of invoiceRowsForSiteOrders(orderIds, invoices)) {
    if (!row.created_at) continue
    const dayKey = new Date(row.created_at).toISOString().slice(0, 10)
    const cur = invoiceCurrencyCode(row)
    const amt = effectiveInvoiceAmount(row)
    let byCur = out.get(dayKey)
    if (!byCur) {
      byCur = new Map()
      out.set(dayKey, byCur)
    }
    byCur.set(cur, (byCur.get(cur) ?? 0) + amt)
  }
  return out
}

export function compareInvoiceCurrencyCodes(ca: string, cb: string): number {
  if (ca === 'TRY') return -1
  if (cb === 'TRY') return 1
  return ca.localeCompare(cb)
}

/** Seçilen gün sırasında en az bir fatura tutarı olan para birimi kodları (TRY önde). */
export function currenciesWithInvoiceActivityInDays(
  dayKeysInOrder: string[],
  byDayCurrency: Map<string, CurrencyTotals>
): string[] {
  const seen = new Set<string>()
  for (const dk of dayKeysInOrder) {
    const row = byDayCurrency.get(dk)
    if (!row) continue
    for (const [c, v] of row) {
      if (Math.abs(v) > 1e-12) seen.add(c)
    }
  }
  return [...seen].sort(compareInvoiceCurrencyCodes)
}

/** Sipariş id → faturalanan toplamlar kök faturalardan, para birimi bazında */
export function invoicedByOrderIdPerCurrency(
  orderIds: string[],
  invoices: InvoiceAmountRow[]
): Map<string, CurrencyTotals> {
  const allow = new Set(orderIds.filter(Boolean))
  const out = new Map<string, CurrencyTotals>()
  for (const id of allow) out.set(id, new Map())
  for (const row of invoices) {
    if (!allow.has(row.order_id) || row.parent_invoice_id) continue
    const id = row.order_id
    const cur = invoiceCurrencyCode(row)
    const m = out.get(id)!
    const amt = effectiveInvoiceAmount(row)
    m.set(cur, (m.get(cur) ?? 0) + amt)
  }
  return out
}

/** Sipariş id → faturalanan toplam (kök satırlar); farklı para birimleri aynı sayıya eklenir — sadece grafik/trend için */
export function invoicedTotalsByOrderId(orderIds: string[], invoices: InvoiceAmountRow[]): Map<string, number> {
  const allow = new Set(orderIds.filter(Boolean))
  const out = new Map<string, number>()
  for (const id of allow) out.set(id, 0)
  for (const row of invoices) {
    if (!allow.has(row.order_id) || row.parent_invoice_id) continue
    const id = row.order_id
    out.set(id, (out.get(id) ?? 0) + effectiveInvoiceAmount(row))
  }
  return out
}

export function mergeCurrencyTotals(a: CurrencyTotals, b: CurrencyTotals): CurrencyTotals {
  const r = new Map(a)
  for (const [k, v] of b) {
    r.set(k, (r.get(k) ?? 0) + v)
  }
  return r
}

export function sumAllCurrenciesTotals(m: CurrencyTotals): number {
  let s = 0
  for (const v of m.values()) s += v
  return s
}

function sortCurrencyTotalEntries(entries: [string, number][]): [string, number][] {
  return [...entries].sort(([ca], [cb]) => {
    if (ca === 'TRY') return -1
    if (cb === 'TRY') return 1
    return ca.localeCompare(cb)
  })
}

/** Sıfırdan büyük tutarları TRY önce, sonra kod sırasıyla döner (UI blok listesi için). */
export function currencyTotalsSortedEntries(totals: CurrencyTotals): [string, number][] {
  return sortCurrencyTotalEntries([...totals.entries()].filter(([, v]) => Math.abs(v) > 1e-12))
}

/**
 * TRY önce sıralı, birden fazla para birimi "1.234,56 TRY · 400,00 USD" biçiminde.
 */
export function formatCurrencyTotalsLine(
  totals: CurrencyTotals,
  formatCurrency: (value: number, currency: string) => string
): string {
  const entries = currencyTotalsSortedEntries(totals)
  if (entries.length === 0) return '—'
  return entries.map(([c, v]) => formatCurrency(v, c)).join(' · ')
}
