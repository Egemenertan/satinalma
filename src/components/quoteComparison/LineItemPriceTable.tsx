'use client'

import { getCurrencySymbol } from '@/components/offers/types'
import { cn } from '@/lib/utils'
import { OfferHeaderCell } from '@/components/quoteComparison/OfferHeaderCell'
import { featureCellClass, headerCellClass, recommendedColShadow, valueCellClass } from '@/components/quoteComparison/tableStyles'
import {
  computeBestCombinationTotal,
  computeLineItemGrandTotal,
  getLineItemRowStats,
  lineItemsHaveMixedCurrencies,
} from '@/lib/quoteComparison/lineItems'
import type { QuoteComparisonLineItemRow, QuoteComparisonOffer } from '@/types/quoteComparison'

interface LineItemPriceTableProps {
  offers: QuoteComparisonOffer[]
  rows: QuoteComparisonLineItemRow[]
  recommendedOfferId: string | null
}

function formatMoney(value: number | null, currency: string | null): string {
  if (value == null) return '—'
  return `${getCurrencySymbol(currency || 'TRY')}${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Bir teklifin tek bir toplam yerine birden fazla farklı fiyatlı kalem/ünite içerdiği
 * durumlarda (örn. aynı projede birden fazla asansör), kalem bazlı fiyat karşılaştırması.
 * Her satırda en düşük birim fiyat yeşille vurgulanır; en sağda, her kalemde en ucuz
 * teklifin seçilmesi halinde ortaya çıkacak teorik en iyi toplam gösterilir.
 */
export function LineItemPriceTable({ offers, rows, recommendedOfferId }: LineItemPriceTableProps) {
  const safeOffers = offers || []
  const safeRows = rows || []
  if (safeRows.length === 0) return null

  const currency = safeOffers.find((o) => o.currency)?.currency || 'TRY'
  const mixedCurrencies = lineItemsHaveMixedCurrencies(safeOffers.map((o) => o.currency))
  const colMin = safeOffers.length <= 2 ? 'min-w-[200px]' : 'min-w-[168px]'
  const lastRowIndex = safeRows.length - 1
  const bestCombinationTotal = computeBestCombinationTotal(safeRows)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50">
        <h2 className="text-[17px] font-bold tracking-tight text-neutral-950">Kalem Bazlı Fiyat Karşılaştırması</h2>
        <p className="text-[13px] text-neutral-500 mt-0.5">
          Her kalem için en düşük birim fiyat <span className="font-semibold text-emerald-700">yeşille</span> vurgulanır
          {mixedCurrencies && <span className="text-amber-600 font-medium"> · Teklifler farklı para birimlerinde, doğrudan kıyaslama yanıltıcı olabilir</span>}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[168px] min-w-[156px] bg-neutral-200 px-5 py-4 text-left align-bottom">
                <span className="text-[12px] font-bold text-neutral-800">Kalem</span>
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
              <th className="px-4 py-4 text-left align-bottom min-w-[168px] bg-emerald-50">
                <div className="text-[13px] font-bold text-emerald-800 leading-snug">En Uygun Kombinasyon</div>
                <div className="text-[11px] text-emerald-600 mt-0.5">Her kalemde en ucuz teklif</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row, idx) => {
              const odd = idx % 2 === 0
              const { bestOfferId, bestUnitPrice } = getLineItemRowStats(row)
              const rowValueLabel = [row.quantity, row.unit].filter(Boolean).join(' ')
              return (
                <tr key={idx} className="border-t border-neutral-200/80">
                  <td className={featureCellClass(odd)}>
                    {row.itemLabel}
                    {rowValueLabel && <div className="text-[11px] font-normal text-neutral-500 mt-0.5">{rowValueLabel}</div>}
                  </td>
                  {safeOffers.map((offer, colIdx) => {
                    const recommended = offer.id === recommendedOfferId
                    const cell = (row.values || []).find((v) => v.offerId === offer.id)
                    const isBest = bestOfferId != null && cell?.offerId === bestOfferId && cell?.unitPrice === bestUnitPrice
                    return (
                      <td
                        key={offer.id}
                        style={recommended ? recommendedColShadow(idx === lastRowIndex ? 'last' : 'mid') : undefined}
                        className={cn(
                          'px-4 py-[15px] align-top',
                          isBest ? 'bg-emerald-50' : valueCellClass(odd, recommended, colIdx % 2 === 1)
                        )}
                      >
                        {cell?.model && <div className="text-[11px] text-neutral-500 mb-1 truncate">{cell.model}</div>}
                        <div
                          className={cn(
                            'text-[15px] font-bold tabular-nums',
                            isBest ? 'text-emerald-700' : 'text-neutral-900'
                          )}
                        >
                          {formatMoney(cell?.unitPrice ?? null, offer.currency)}
                        </div>
                        {cell?.totalPrice != null && cell.totalPrice !== cell.unitPrice && (
                          <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
                            Toplam: {formatMoney(cell.totalPrice, offer.currency)}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-[15px] align-top bg-emerald-50/60">
                    <div className="text-[15px] font-bold tabular-nums text-emerald-700">
                      {formatMoney(bestUnitPrice, currency)}
                    </div>
                  </td>
                </tr>
              )
            })}

            <tr className="border-t-2 border-neutral-300">
              <td className={cn(featureCellClass(false), 'text-[14px]')}>TOPLAM</td>
              {safeOffers.map((offer, colIdx) => {
                const recommended = offer.id === recommendedOfferId
                const grandTotal = computeLineItemGrandTotal(safeRows, offer.id)
                return (
                  <td
                    key={offer.id}
                    style={recommended ? recommendedColShadow('last') : undefined}
                    className={cn('px-4 py-4', valueCellClass(false, recommended, colIdx % 2 === 1))}
                  >
                    <span className="text-[18px] font-bold tracking-tight text-neutral-950 tabular-nums">
                      {formatMoney(grandTotal, offer.currency)}
                    </span>
                  </td>
                )
              })}
              <td className="px-4 py-4 bg-emerald-100">
                <span className="text-[18px] font-bold tracking-tight text-emerald-800 tabular-nums">
                  {formatMoney(bestCombinationTotal, currency)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
