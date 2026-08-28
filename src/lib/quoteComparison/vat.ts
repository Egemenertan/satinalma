import { splitReadableItems } from '@/lib/quoteComparison/readableText'
import type { QuoteComparisonOffer } from '@/types/quoteComparison'

const VAT_HINT = /kdv|katma\s*değer/i

function vatLinesFromText(text: string | null | undefined): string | null {
  const raw = text?.trim()
  if (!raw) return null
  const items = splitReadableItems(raw, true).filter((item) => VAT_HINT.test(item))
  if (items.length === 0) return VAT_HINT.test(raw) ? raw : null
  return items.join('\n')
}

/** Teklifin KDV durumunu döner: yapılandırılmış alan, yoksa notlardaki KDV cümleleri. */
export function getOfferVatStatus(offer: QuoteComparisonOffer): string | null {
  const fromField = offer.extracted_data?.vat_status?.trim()
  if (fromField) return fromField
  return vatLinesFromText(offer.extracted_data?.notes)
}
