'use client'

import { getCurrencySymbol } from '@/components/offers/types'
import { cn } from '@/lib/utils'
import { pricesHaveDistinctValues, rowHasDistinctValues } from '@/lib/quoteComparison/differences'
import { isNotesFeature, splitReadableItems } from '@/lib/quoteComparison/readableText'
import { OfferHeaderCell } from '@/components/quoteComparison/OfferHeaderCell'
import { featureCellClass, headerCellClass, recommendedColShadow, valueCellClass } from '@/components/quoteComparison/tableStyles'
import type { QuoteComparisonOffer, QuoteComparisonTableRow } from '@/types/quoteComparison'

interface ComparisonTableProps {
  offers: QuoteComparisonOffer[]
  comparisonTable: QuoteComparisonTableRow[] | null
  recommendedOfferId: string | null
  /** Fiyat özeti satırı ayrı bir kalem bazlı tabloda gösteriliyorsa burada tekrar edilmez. */
  showPriceRow?: boolean
  title?: string
  subtitle?: string
}

function formatPrice(offer: QuoteComparisonOffer): string {
  if (offer.total_price === null || offer.total_price === undefined) return '—'
  return `${getCurrencySymbol(offer.currency || 'TRY')}${offer.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
}

function FeatureValue({ value, notes }: { value: string; notes: boolean }) {
  const items = splitReadableItems(value, notes)
  if (items.length <= 1) {
    return <span className="whitespace-pre-wrap break-words">{items[0] || value}</span>
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[13px] leading-5 font-normal">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-neutral-400 shrink-0" />
          <span className="break-words">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function ComparisonTable({
  offers,
  comparisonTable,
  recommendedOfferId,
  showPriceRow = true,
  title = 'Teknik Özellikler',
  subtitle = 'Teklifler özellik bazında yan yana',
}: ComparisonTableProps) {
  const safeOffers = offers || []
  const rows = comparisonTable || []
  const offerIds = safeOffers.map((o) => o.id)
  const priceDistinct = pricesHaveDistinctValues(safeOffers)
  const colMin = safeOffers.length <= 2 ? 'min-w-[220px]' : 'min-w-[180px]'
  const lastRowIndex = rows.length - 1

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50">
        <h2 className="text-[17px] font-bold tracking-tight text-neutral-950">{title}</h2>
        <p className="text-[13px] text-neutral-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[168px] min-w-[156px] bg-neutral-200 px-5 py-4 text-left align-bottom">
                <span className="text-[12px] font-bold text-neutral-800">Özellik</span>
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
            {showPriceRow && (
              <tr className="border-t border-neutral-200">
                <td className={featureCellClass(false)}>
                  Toplam fiyat
                  {priceDistinct && <span className="ml-2 text-[11px] font-semibold text-neutral-500">Fark</span>}
                </td>
                {safeOffers.map((offer, colIdx) => {
                  const recommended = offer.id === recommendedOfferId
                  const isLastBodyRow = lastRowIndex < 0
                  return (
                    <td
                      key={offer.id}
                      style={recommended ? recommendedColShadow(isLastBodyRow ? 'last' : 'mid') : undefined}
                      className={cn('px-4 py-4', valueCellClass(false, recommended, colIdx % 2 === 1))}
                    >
                      <span className="text-[20px] font-bold tracking-tight text-neutral-950 tabular-nums">
                        {formatPrice(offer)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            )}

            {rows.map((row, idx) => {
              const odd = idx % 2 === 0
              const distinct = rowHasDistinctValues(row, offerIds)
              const notesRow = isNotesFeature(row.feature)
              return (
                <tr key={idx} className="border-t border-neutral-200/80">
                  <td className={featureCellClass(odd)}>
                    {row.feature}
                    {distinct && <span className="ml-2 text-[11px] font-semibold text-neutral-500">Fark</span>}
                  </td>
                  {safeOffers.map((offer, colIdx) => {
                    const recommended = offer.id === recommendedOfferId
                    const found = (row.values || []).find((v) => v.offerId === offer.id)
                    const value = found?.value?.trim()
                    return (
                      <td
                        key={offer.id}
                        style={recommended ? recommendedColShadow(idx === lastRowIndex ? 'last' : 'mid') : undefined}
                        className={cn(
                          'px-4 py-[15px] text-[14px] leading-relaxed align-top',
                          value ? 'text-neutral-800' : 'text-neutral-400',
                          distinct && value && !notesRow ? 'font-medium' : '',
                          valueCellClass(odd, recommended, colIdx % 2 === 1)
                        )}
                      >
                        {value ? <FeatureValue value={value} notes={notesRow} /> : '—'}
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
