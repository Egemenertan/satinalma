import type { QuoteComparisonLineItemRow } from '@/types/quoteComparison'

export interface LineItemRowStats {
  /** Bu satırda fiyatı olan tekliflerden en düşük birim fiyatı verenin offerId'si (yoksa null). */
  bestOfferId: string | null
  bestUnitPrice: number | null
}

/** Bir satırdaki en düşük birim fiyatı ve hangi teklife ait olduğunu bulur. */
export function getLineItemRowStats(row: QuoteComparisonLineItemRow): LineItemRowStats {
  let bestOfferId: string | null = null
  let bestUnitPrice: number | null = null

  for (const value of row.values || []) {
    if (value.unitPrice == null) continue
    if (bestUnitPrice === null || value.unitPrice < bestUnitPrice) {
      bestUnitPrice = value.unitPrice
      bestOfferId = value.offerId
    }
  }

  return { bestOfferId, bestUnitPrice }
}

/** Her satırda o teklifin toplam tutarını, satırlar üzerinden toplayarak tedarikçi bazlı genel toplamı hesaplar. */
export function computeLineItemGrandTotal(rows: QuoteComparisonLineItemRow[], offerId: string): number | null {
  let sum = 0
  let hasAny = false
  for (const row of rows) {
    const value = (row.values || []).find((v) => v.offerId === offerId)
    if (value?.totalPrice != null) {
      sum += value.totalPrice
      hasAny = true
    }
  }
  return hasAny ? sum : null
}

/** Her kalemde en ucuz teklifi seçseydik ortaya çıkacak teorik en iyi toplamı hesaplar ("En düşük fiyat" kombinasyonu). */
export function computeBestCombinationTotal(rows: QuoteComparisonLineItemRow[]): number | null {
  let sum = 0
  let hasAny = false
  for (const row of rows) {
    const prices = (row.values || [])
      .map((v) => v.totalPrice)
      .filter((p): p is number => p != null)
    if (prices.length === 0) continue
    sum += Math.min(...prices)
    hasAny = true
  }
  return hasAny ? sum : null
}

/** Tekliflerin farklı para birimlerinde olup olmadığını kontrol eder; karışıksa fiyat kıyaslaması yanıltıcı olabilir. */
export function lineItemsHaveMixedCurrencies(offerCurrencies: (string | null)[]): boolean {
  const distinct = new Set(offerCurrencies.filter((c): c is string => !!c?.trim()).map((c) => c.trim().toUpperCase()))
  return distinct.size > 1
}
