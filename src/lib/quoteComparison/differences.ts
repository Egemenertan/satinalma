import { getCurrencySymbol } from '@/components/offers/types'
import type {
  QuoteComparisonNotableDifference,
  QuoteComparisonOffer,
  QuoteComparisonTableRow,
} from '@/types/quoteComparison'

export interface NotableTableRow {
  feature: string
  values: { offerId: string; value: string }[]
}

function featureKey(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR')
}

function formatOfferPrice(offer: QuoteComparisonOffer): string {
  if (offer.total_price == null) return '—'
  return `${getCurrencySymbol(offer.currency || 'TRY')}${offer.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
}

export function buildNotableDifferenceRows(
  offers: QuoteComparisonOffer[],
  comparisonTable: QuoteComparisonTableRow[] | null | undefined,
  notableFromAi?: QuoteComparisonNotableDifference[] | null
): NotableTableRow[] {
  const safeOffers = offers || []
  const offerIds = safeOffers.map((o) => o.id)
  const rows: NotableTableRow[] = []

  if (pricesHaveDistinctValues(safeOffers)) {
    rows.push({
      feature: 'Toplam fiyat',
      values: safeOffers.map((o) => ({ offerId: o.id, value: formatOfferPrice(o) })),
    })
  }

  const distinctRows = (comparisonTable || []).filter((row) => rowHasDistinctValues(row, offerIds))
  const aiKeys = (notableFromAi || [])
    .map((d) => featureKey(d.feature || ''))
    .filter(Boolean)

  const sorted = [...distinctRows].sort((a, b) => {
    const ai = aiKeys.indexOf(featureKey(a.feature))
    const bi = aiKeys.indexOf(featureKey(b.feature))
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  for (const row of sorted) {
    rows.push({
      feature: row.feature,
      values: safeOffers.map((o) => ({
        offerId: o.id,
        value: (row.values || []).find((v) => v.offerId === o.id)?.value?.trim() || '—',
      })),
    })
  }

  if (rows.length > 0) return rows.slice(0, 12)

  return (notableFromAi || [])
    .filter((d) => d.feature?.trim() && d.detail?.trim())
    .slice(0, 12)
    .map((d) => ({
      feature: d.feature,
      values: [{ offerId: '_note', value: d.detail }],
    }))
}

const EMPTY = new Set(['', '—', '-', 'belirtilmemiş', 'belirtilmedi', 'yok', 'n/a', 'na'])

export function normalizeCompareValue(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
}

export function rowHasDistinctValues(row: QuoteComparisonTableRow, offerIds: string[]): boolean {
  if (row.isDistinct === true) return true

  const values = offerIds
    .map((id) => normalizeCompareValue((row.values || []).find((v) => v.offerId === id)?.value))
    .filter((v) => v && !EMPTY.has(v))

  return new Set(values).size > 1
}

export function pricesHaveDistinctValues(offers: QuoteComparisonOffer[]): boolean {
  const prices = (offers || [])
    .map((o) => o.total_price)
    .filter((p): p is number => p !== null && p !== undefined)
  if (prices.length < 2) return false
  return new Set(prices.map((p) => Math.round(p * 100))).size > 1
}
