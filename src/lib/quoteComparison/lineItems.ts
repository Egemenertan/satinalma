import type { QuoteComparisonLineItemRow } from '@/types/quoteComparison'

export interface LineItemRowStats {
  /** Bu satırda fiyatı olan tekliflerden en düşük birim fiyatı verenin offerId'si (yoksa null). */
  bestOfferId: string | null
  bestUnitPrice: number | null
}

/**
 * Bir satırdaki en düşük birim fiyatı ve hangi teklife ait olduğunu bulur.
 * Eğer bu satırda tekliflerin fiyatları FARKLI para birimlerindeyse (örn. biri USD,
 * biri TRY), dönüştürme yapılmadan ham sayıları karşılaştırmak yanıltıcı olur —
 * bu durumda "en iyi fiyat" belirlenmez (highlight edilmez) ki yanlış bir teklif
 * ucuzmuş gibi öne çıkmasın.
 */
export function getLineItemRowStats(row: QuoteComparisonLineItemRow): LineItemRowStats {
  const priced = (row.values || []).filter((v) => v.unitPrice != null)
  if (priced.length === 0) return { bestOfferId: null, bestUnitPrice: null }

  const currencies = new Set(priced.map((v) => v.currency?.toUpperCase()).filter((c): c is string => !!c))
  if (currencies.size > 1) return { bestOfferId: null, bestUnitPrice: null }

  let bestOfferId: string | null = null
  let bestUnitPrice: number | null = null
  for (const value of priced) {
    if (bestUnitPrice === null || value.unitPrice! < bestUnitPrice) {
      bestUnitPrice = value.unitPrice
      bestOfferId = value.offerId
    }
  }
  return { bestOfferId, bestUnitPrice }
}

/** Bir teklifin kalem bazlı genel toplamı; kalemler farklı para biriminde olabileceği için para birimine göre gruplanır. */
export interface LineItemGrandTotal {
  /** Para birimi koduna göre gruplanmış toplamlar, örn. { USD: 15000, TRY: 460000 }. */
  totalsByCurrency: Record<string, number>
  /** Bu tekliftin kalemleri birden fazla farklı para biriminde fiyatlandırılmışsa true. */
  isMixedCurrency: boolean
}

/**
 * Her satırda o teklifin toplam tutarını, PARA BİRİMİNE GÖRE GRUPLAYARAK toplar.
 * Aynı teklifte bazı kalemler USD, bazıları TRY olabilir; bunları dönüştürmeden
 * tek bir sayıya toplamak matematiksel olarak hatalı olur — bu yüzden her para
 * birimi için ayrı bir alt toplam döndürülür. Tek para birimi varsa (yaygın durum)
 * `totalsByCurrency` tek elemanlı olur ve `isMixedCurrency` false döner.
 */
export function computeLineItemGrandTotal(
  rows: QuoteComparisonLineItemRow[],
  offerId: string,
  fallbackCurrency: string
): LineItemGrandTotal | null {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const value = (row.values || []).find((v) => v.offerId === offerId)
    if (value?.totalPrice == null) continue
    const currency = (value.currency || fallbackCurrency || 'TRY').toUpperCase()
    totals.set(currency, (totals.get(currency) || 0) + value.totalPrice)
  }
  if (totals.size === 0) return null
  return { totalsByCurrency: Object.fromEntries(totals), isMixedCurrency: totals.size > 1 }
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

/**
 * Bir teklifin nihai "TOPLAM" tutarını belirler. PDF'in kendi üzerinde bastığı genel
 * toplam (offer.total_price, AI'ın tüm dokümandan çıkardığı tek bir tutar) varsa bu
 * HER ZAMAN önceliklidir: kalem bazlı tablodan toplayarak hesaplanan tutar, satır
 * çıkarımı eksik kaldığında (örn. çok sayfalı/çok kalemli PDF'lerde bazı satırlar
 * atlanmışsa) PDF'nin kendi bastığı toplamdan SAPAR ve arayüzde "üstte X yazıyor,
 * PDF'de Y yazıyor" tutarsızlığı yaratır. offer.total_price yoksa (PDF'de genel bir
 * toplam satırı yoksa) kalemler toplanarak hesaplanır.
 */
export function resolveOfferGrandTotal(
  rows: QuoteComparisonLineItemRow[],
  offerId: string,
  offerTotalPrice: number | null,
  offerCurrency: string
): LineItemGrandTotal | null {
  if (offerTotalPrice != null) {
    return { totalsByCurrency: { [(offerCurrency || 'TRY').toUpperCase()]: offerTotalPrice }, isMixedCurrency: false }
  }
  return computeLineItemGrandTotal(rows, offerId, offerCurrency)
}

/** Tekliflerin farklı para birimlerinde olup olmadığını kontrol eder; karışıksa fiyat kıyaslaması yanıltıcı olabilir. */
export function lineItemsHaveMixedCurrencies(offerCurrencies: (string | null)[]): boolean {
  const distinct = new Set(offerCurrencies.filter((c): c is string => !!c?.trim()).map((c) => c.trim().toUpperCase()))
  return distinct.size > 1
}

/** Tüm tekliflerde aynı ürün adı varsa onu döner; poz aynı olup adlar farklıysa null. */
export function getLineItemSharedName(row: QuoteComparisonLineItemRow): string | null {
  const names = [
    ...new Set((row.values || []).map((v) => v.itemName?.trim()).filter((name): name is string => !!name)),
  ]
  return names.length === 1 ? names[0] : null
}

/** Satırın sol sütununda gösterilecek kalem adı: ortak ad, yoksa poz dışında etiket. */
export function getLineItemKalemLabel(row: QuoteComparisonLineItemRow): string {
  const shared = getLineItemSharedName(row)
  if (shared) return shared
  if (row.pozNo) return ''
  return row.itemLabel
}

/** Tedarikçi sütununda ürün adı + model. Ortak ad zaten soldaysa tekrarlanmaz. */
export function getLineItemVendorDescription(
  cell: QuoteComparisonLineItemRow['values'][number] | undefined,
  sharedName: string | null
): string {
  if (!cell) return ''
  const parts: string[] = []
  const itemName = cell.itemName?.trim()
  if (itemName && itemName !== sharedName) parts.push(itemName)
  const model = cell.model?.trim()
  if (model && model !== itemName) parts.push(model)
  return parts.join('\n')
}
