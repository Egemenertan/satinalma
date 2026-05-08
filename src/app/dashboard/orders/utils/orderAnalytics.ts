/**
 * Sipariş dashboard grafikleri — saf fonksiyonlar
 */

import { format, parseISO, startOfDay, subDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { OrderMinimalAnalyticsRow, OrderAnalyticsSnapshot } from '../types'

function classifyOrder(o: OrderMinimalAnalyticsRow): 'delivered' | 'partial' | 'returned' | 'pending' {
  if (o.status === 'iade edildi') return 'returned'
  if (o.status === 'delivered' || o.is_delivered) return 'delivered'
  if (o.status === 'partially_delivered' || o.status === 'kısmen teslim alındı') return 'partial'
  return 'pending'
}

function breakdownExclusive(rows: OrderMinimalAnalyticsRow[]) {
  let delivered = 0
  let partiallyDelivered = 0
  let returned = 0
  let pending = 0
  for (const o of rows) {
    const k = classifyOrder(o)
    if (k === 'delivered') delivered++
    else if (k === 'partial') partiallyDelivered++
    else if (k === 'returned') returned++
    else pending++
  }
  return { delivered, partiallyDelivered, returned, pending }
}

function scaleBreakdownToTotal(
  d: number,
  p: number,
  r: number,
  pend: number,
  totalCount: number
) {
  const sum = d + p + r + pend
  if (sum === 0) {
    return {
      delivered: 0,
      partiallyDelivered: 0,
      returned: 0,
      pending: totalCount,
    }
  }
  const dd = Math.round((d / sum) * totalCount)
  const pp = Math.round((p / sum) * totalCount)
  const rr = Math.round((r / sum) * totalCount)
  let pendOut = totalCount - dd - pp - rr
  if (pendOut < 0) pendOut = 0
  return {
    delivered: dd,
    partiallyDelivered: pp,
    returned: rr,
    pending: pendOut,
  }
}

function buildLastNDaysKeysEndAt(endDay: Date, n: number): string[] {
  const end = startOfDay(endDay)
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    keys.push(format(subDays(end, i), 'yyyy-MM-dd'))
  }
  return keys
}

/**
 * ISO zaman damgasından takvim günü — timezone kaymasından kaçınmak için önce T öncesi tarih kısmını kullanır.
 */
function dayKeyFromCreated(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso.trim())
  if (m) return m[1]
  try {
    return format(parseISO(iso), 'yyyy-MM-dd')
  } catch {
    return format(new Date(iso), 'yyyy-MM-dd')
  }
}

/**
 * Grafik ekseni: varsayılan son N gün (bugün); satırlar bu aralıkta değilse en yeni oluşturma gününe göre kaydırılır
 * (eski oluşturma / güncel teslim filtresi kombinasyonunda çubukların sıfır görünmesini önler).
 */
function buildAdaptiveDayKeysWithMeta(
  days: number,
  rows: OrderMinimalAnalyticsRow[]
): { keys: string[]; anchoredToNewestRow: boolean } {
  const today = startOfDay(new Date())
  const rollingKeys = buildLastNDaysKeysEndAt(today, days)

  if (!rows.length) {
    return { keys: rollingKeys, anchoredToNewestRow: false }
  }

  const rowDayKeys = new Set<string>()
  for (const r of rows) {
    rowDayKeys.add(dayKeyFromCreated(r.created_at))
  }
  const touchesRolling = rollingKeys.some(k => rowDayKeys.has(k))
  if (touchesRolling) {
    return { keys: rollingKeys, anchoredToNewestRow: false }
  }

  const ts = rows
    .map(r => new Date(r.created_at).getTime())
    .filter(t => !Number.isNaN(t))
  if (!ts.length) {
    return { keys: rollingKeys, anchoredToNewestRow: false }
  }

  const newest = Math.max(...ts)
  const anchor = startOfDay(new Date(newest))
  return {
    keys: buildLastNDaysKeysEndAt(anchor, days),
    anchoredToNewestRow: true,
  }
}

function buildDailyBuckets(
  rows: OrderMinimalAnalyticsRow[],
  days: number
): {
  series: { dayKey: string; label: string; count: number; amount: number }[]
  anchoredToNewestRow: boolean
} {
  const { keys, anchoredToNewestRow } = buildAdaptiveDayKeysWithMeta(days, rows)
  const mapCount = new Map<string, number>()
  const mapTry = new Map<string, number>()
  for (const k of keys) {
    mapCount.set(k, 0)
    mapTry.set(k, 0)
  }
  for (const r of rows) {
    const dk = dayKeyFromCreated(r.created_at)
    if (!mapCount.has(dk)) continue
    mapCount.set(dk, (mapCount.get(dk) ?? 0) + 1)
    if ((r.currency || '').toUpperCase() === 'TRY') {
      mapTry.set(dk, (mapTry.get(dk) ?? 0) + (Number(r.amount) || 0))
    }
  }
  return {
    series: keys.map(dayKey => ({
      dayKey,
      label: format(parseISO(`${dayKey}T12:00:00`), 'd MMM', { locale: tr }),
      count: mapCount.get(dayKey) ?? 0,
      amount: mapTry.get(dayKey) ?? 0,
    })),
    anchoredToNewestRow,
  }
}

/** Grafik ve KPI için özet üret */
export function buildOrderAnalyticsSnapshot(
  rows: OrderMinimalAnalyticsRow[],
  totalCount: number
): OrderAnalyticsSnapshot {
  const { series: daily, anchoredToNewestRow } = buildDailyBuckets(rows, 30)
  const dailyOrderCounts = daily.map(d => ({ dayKey: d.dayKey, label: d.label, count: d.count }))
  const dailyTryAmounts = daily.map(d => ({ dayKey: d.dayKey, label: d.label, amount: d.amount }))

  if (totalCount === 0) {
    return {
      totalCount: 0,
      delivered: 0,
      partiallyDelivered: 0,
      returned: 0,
      pending: 0,
      dailyOrderCounts,
      dailyTryAmounts,
      isSampled: false,
      performanceChartAnchoredToNewestCreation: anchoredToNewestRow,
    }
  }

  const isSampled = rows.length < totalCount && totalCount > 0
  const raw = breakdownExclusive(rows)

  let delivered = raw.delivered
  let partiallyDelivered = raw.partiallyDelivered
  let returned = raw.returned
  let pending = raw.pending

  if (isSampled) {
    const scaled = scaleBreakdownToTotal(raw.delivered, raw.partiallyDelivered, raw.returned, raw.pending, totalCount)
    delivered = scaled.delivered
    partiallyDelivered = scaled.partiallyDelivered
    returned = scaled.returned
    pending = scaled.pending
  } else if (totalCount > 0) {
    pending = Math.max(0, totalCount - delivered - partiallyDelivered - returned)
  }

  return {
    totalCount,
    delivered,
    partiallyDelivered,
    returned,
    pending,
    dailyOrderCounts,
    dailyTryAmounts,
    isSampled,
    performanceChartAnchoredToNewestCreation: anchoredToNewestRow,
  }
}

/** Mini grafik çubuk yükseklikleri % olarak */
export function sparkHeightsFromCounts(counts: number[]): number[] {
  if (!counts.length) return counts
  const max = Math.max(...counts, 1)
  return counts.map(c => Math.round((c / max) * 100))
}
