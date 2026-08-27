'use client'

import { cn } from '@/lib/utils'
import { OfferHeaderCell } from '@/components/quoteComparison/OfferHeaderCell'
import { featureCellClass, headerCellClass, recommendedColShadow, valueCellClass } from '@/components/quoteComparison/tableStyles'
import type { QuoteComparisonExtractedData, QuoteComparisonOffer } from '@/types/quoteComparison'

interface CommercialTermsTableProps {
  offers: QuoteComparisonOffer[]
  recommendedOfferId: string | null
}

interface TermRowDef {
  label: string
  getValue: (extracted: QuoteComparisonExtractedData | null) => string | null
}

const TERM_ROWS: TermRowDef[] = [
  { label: 'Teklif Tarihi', getValue: (e) => e?.quote_date || null },
  { label: 'Ödeme Planı', getValue: (e) => e?.payment_terms || null },
  { label: 'Nakliye', getValue: (e) => e?.shipping_responsibility || null },
  { label: 'Montaj', getValue: (e) => e?.installation_responsibility || null },
  { label: 'KDV', getValue: (e) => e?.vat_status || null },
  { label: 'Teslim Süresi', getValue: (e) => e?.delivery_time || null },
  { label: 'Garanti', getValue: (e) => e?.warranty || null },
]

function normalize(value: string | null): string {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
}

/**
 * Excel'deki "Teklif Değerlendirme Formu"na benzer şekilde ödeme, nakliye, montaj,
 * KDV, teslim süresi ve garanti gibi ticari şartları teknik özelliklerden ayrı,
 * kendi başlığı altında gösterir.
 */
export function CommercialTermsTable({ offers, recommendedOfferId }: CommercialTermsTableProps) {
  const safeOffers = offers || []
  const colMin = safeOffers.length <= 2 ? 'min-w-[220px]' : 'min-w-[180px]'

  const rows = TERM_ROWS.filter((row) => safeOffers.some((o) => row.getValue(o.extracted_data)?.trim()))
  if (rows.length === 0) return null

  const lastRowIndex = rows.length - 1

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50">
        <h2 className="text-[17px] font-bold tracking-tight text-neutral-950">Ticari Şartlar</h2>
        <p className="text-[13px] text-neutral-500 mt-0.5">Ödeme, teslimat ve sorumluluk koşulları</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[168px] min-w-[156px] bg-neutral-200 px-5 py-4 text-left align-bottom">
                <span className="text-[12px] font-bold text-neutral-800">Şart</span>
              </th>
              {safeOffers.map((offer, colIdx) => {
                const recommended = offer.id === recommendedOfferId
                return (
                  <th
                    key={offer.id}
                    style={recommended ? recommendedColShadow('head') : undefined}
                    className={headerCellClass(colIdx, recommended, colMin)}
                  >
                    <OfferHeaderCell offer={offer} recommended={recommended} showContact={false} />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const odd = idx % 2 === 0
              const values = safeOffers.map((o) => row.getValue(o.extracted_data))
              const filled = values.map(normalize).filter(Boolean)
              const distinct = new Set(filled).size > 1
              return (
                <tr key={row.label} className="border-t border-neutral-200/80">
                  <td className={featureCellClass(odd)}>
                    {row.label}
                    {distinct && <span className="ml-2 text-[11px] font-semibold text-neutral-500">Fark</span>}
                  </td>
                  {safeOffers.map((offer, colIdx) => {
                    const recommended = offer.id === recommendedOfferId
                    const value = row.getValue(offer.extracted_data)?.trim()
                    return (
                      <td
                        key={offer.id}
                        style={recommended ? recommendedColShadow(idx === lastRowIndex ? 'last' : 'mid') : undefined}
                        className={cn(
                          'px-4 py-[15px] text-[14px] leading-relaxed align-top whitespace-pre-wrap break-words',
                          value ? 'text-neutral-800' : 'text-neutral-400',
                          valueCellClass(odd, recommended, colIdx % 2 === 1)
                        )}
                      >
                        {value || '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
