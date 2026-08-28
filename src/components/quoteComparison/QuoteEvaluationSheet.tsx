'use client'

import { getCurrencySymbol } from '@/components/offers/types'
import { cn } from '@/lib/utils'
import { isNotesFeature, splitReadableItems } from '@/lib/quoteComparison/readableText'
import {
  computeLineItemGrandTotal,
  getLineItemRowStats,
  lineItemsHaveMixedCurrencies,
} from '@/lib/quoteComparison/lineItems'
import { getOfferVatStatus } from '@/lib/quoteComparison/vat'
import { OfferHeaderCell, offerDisplayName } from '@/components/quoteComparison/OfferHeaderCell'
import { featureCellClass, valueCellClass } from '@/components/quoteComparison/tableStyles'
import type {
  QuoteComparisonLineItemRow,
  QuoteComparisonOffer,
  QuoteComparisonRecommendation,
  QuoteComparisonTableRow,
} from '@/types/quoteComparison'

interface QuoteEvaluationSheetProps {
  title: string
  projectName: string | null
  materialName: string | null
  createdAt: string
  offers: QuoteComparisonOffer[]
  comparisonTable: QuoteComparisonTableRow[] | null
  lineItemComparison: QuoteComparisonLineItemRow[] | null
  recommendation: QuoteComparisonRecommendation | null
  recommendedOfferId: string | null
}

const TERM_ROWS: { label: string; get: (offer: QuoteComparisonOffer) => string | null }[] = [
  { label: 'Teklif Tarihi', get: (o) => o.extracted_data?.quote_date || null },
  { label: 'Ödeme Planı', get: (o) => o.extracted_data?.payment_terms || null },
  { label: 'Nakliye', get: (o) => o.extracted_data?.shipping_responsibility || null },
  { label: 'Montaj', get: (o) => o.extracted_data?.installation_responsibility || null },
  { label: 'Teslim Süresi', get: (o) => o.extracted_data?.delivery_time || null },
  { label: 'Garanti', get: (o) => o.extracted_data?.warranty || null },
]

function formatMoney(value: number | null | undefined, currency: string | null): string {
  if (value == null) return '—'
  return `${getCurrencySymbol(currency || 'TRY')}${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function SectionBand({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="bg-neutral-800 text-white text-[12px] font-bold uppercase tracking-wide text-center py-2.5"
      >
        {label}
      </td>
    </tr>
  )
}

/**
 * Sayfadaki "Teklif Değerlendirme Formu" görünümü — .xlsx export'u ile aynı
 * içeriği gösterir; sayfada DLX AI değerlendirmesi tablonun üstündedir.
 */
export function QuoteEvaluationSheet({
  title,
  projectName,
  materialName,
  createdAt,
  offers,
  comparisonTable,
  lineItemComparison,
  recommendation,
  recommendedOfferId,
}: QuoteEvaluationSheetProps) {
  const safeOffers = offers || []
  const n = safeOffers.length
  const colSpanAll = n + 1
  const colMin = n <= 2 ? 'min-w-[220px]' : 'min-w-[180px]'

  const lineItemRows = lineItemComparison || []
  const hasLineItems = lineItemRows.length > 0
  const mixedCurrencies = hasLineItems && lineItemsHaveMixedCurrencies(safeOffers.map((o) => o.currency))

  const termRows = TERM_ROWS.filter((row) => safeOffers.some((o) => row.get(o)?.trim()))
  const specRows = (comparisonTable || []).filter((row) =>
    (row.values || []).some((v) => v.value?.trim() && v.value !== 'Belirtilmemiş')
  )

  const recommendedOffer = safeOffers.find((o) => o.id === recommendedOfferId) || null
  const prosCons = recommendation?.prosCons || []
  const prosConsByOffer = new Map(prosCons.map((pc) => [pc.offerId, pc]))
  const executiveAnalysis = recommendation?.executiveAnalysis || []
  const hasRecommendationContent =
    !!recommendation &&
    (recommendation.summary?.trim() || recommendation.reasoning?.trim() || executiveAnalysis.length > 0)

  const projectLabel = projectName?.trim() || title

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      {/* Başlık şeridi */}
      <div className="bg-neutral-900 py-3.5 text-center">
        <h2 className="text-white text-[17px] sm:text-lg font-bold tracking-tight">TEKLİF DEĞERLENDİRME FORMU</h2>
      </div>
      <p className="text-center text-[11px] italic text-neutral-400 py-1.5 border-b border-neutral-100">
        Oluşturulma: {new Date(createdAt).toLocaleDateString('tr-TR')}
      </p>

      {/* Logolar + proje bilgisi */}
      <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 space-y-3">
        <div className="flex items-center gap-2.5">
          <img src="/d-black.png" alt="Dovec" className="h-5 w-auto object-contain" />
          <span className="text-neutral-300 font-bold text-base leading-none select-none">×</span>
          <img src="/DLX.png" alt="DLX AI" className="h-5 w-auto object-contain" />
        </div>
        <div className="text-[13px] space-y-0.5">
          <div>
            <span className="font-bold text-neutral-900">PROJE: </span>
            <span className="font-bold text-neutral-900">{projectLabel}</span>
          </div>
          {projectName?.trim() && (
            <div>
              <span className="font-bold text-neutral-600">TEKLİF: </span>
              <span className="text-neutral-600">{title}</span>
            </div>
          )}
          {materialName?.trim() && (
            <div>
              <span className="font-bold text-neutral-600">İŞ: </span>
              <span className="text-neutral-600">{materialName.trim()}</span>
            </div>
          )}
        </div>
      </div>

      {/* DLX AI Değerlendirmesi — sayfada en üstte (Excel'de sonda kalır) */}
      {hasRecommendationContent && (
        <div className="border-b border-neutral-200">
          <div className="bg-neutral-800 py-2.5 text-center">
            <span className="text-white text-[12px] font-bold uppercase tracking-wide">DLX AI Değerlendirmesi</span>
          </div>
          <div className="px-5 sm:px-6 py-5 space-y-4">
            {recommendedOffer && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[15px] font-bold text-emerald-800">
                  Önerilen Teklif: {offerDisplayName(recommendedOffer)}
                </span>
                {recommendedOffer.total_price != null && (
                  <span className="text-[15px] font-bold text-emerald-700 tabular-nums">
                    {formatMoney(recommendedOffer.total_price, recommendedOffer.currency)}
                  </span>
                )}
              </div>
            )}

            {recommendation?.summary?.trim() && (
              <p className="text-[15px] font-semibold text-neutral-900 leading-7">{recommendation.summary.trim()}</p>
            )}
            {recommendation?.reasoning?.trim() && (
              <p className="text-[14px] text-neutral-600 leading-6">{recommendation.reasoning.trim()}</p>
            )}
            {recommendation?.priorityConsideration?.trim() && (
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-1">
                  Dikkate alınan öncelikler
                </p>
                <p className="text-[13px] text-neutral-800 leading-6 whitespace-pre-wrap">
                  {recommendation.priorityConsideration.trim()}
                </p>
              </div>
            )}

            {executiveAnalysis.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {executiveAnalysis.map((section, i) => (
                  <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-[13px] font-bold text-neutral-900 mb-1">{section.title}</p>
                    <p className="text-[13px] text-neutral-600 leading-6">{section.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {prosCons.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {safeOffers.map((offer) => {
                  const pc = prosConsByOffer.get(offer.id)
                  if (!pc) return null
                  const isRecommended = recommendedOffer?.id === offer.id
                  return (
                    <div
                      key={offer.id}
                      className={cn(
                        'rounded-xl border p-4 bg-white',
                        isRecommended ? 'border-2 border-emerald-400' : 'border-neutral-200'
                      )}
                    >
                      <p className="text-[13px] font-bold text-slate-800 mb-2 truncate">{offerDisplayName(offer)}</p>
                      {(pc.pros || []).length > 0 && (
                        <ul className="space-y-1 mb-2">
                          {pc.pros.map((pro, i) => (
                            <li key={i} className="text-[12px] text-emerald-700 leading-5">
                              + {pro}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(pc.cons || []).length > 0 && (
                        <ul className="space-y-1">
                          {pc.cons.map((con, i) => (
                            <li key={i} className="text-[12px] text-red-600 leading-5">
                              − {con}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tek tablo: fiyat matrisi + ticari şartlar + teknik özellikler */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[168px] min-w-[156px] bg-neutral-200 px-5 py-4 text-left align-bottom">
                <span className="text-[12px] font-bold text-neutral-800">Kalem</span>
              </th>
              {safeOffers.map((offer, colIdx) => (
                <th
                  key={offer.id}
                  className={cn(
                    'px-4 py-4 text-left align-bottom',
                    colMin,
                    colIdx % 2 === 1 ? 'bg-amber-100/80' : 'bg-amber-100/60'
                  )}
                >
                  <OfferHeaderCell offer={offer} recommended={false} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t-2 border-neutral-300">
              <td className={cn(featureCellClass(false), 'text-[13px] !bg-emerald-50 text-emerald-800')}>TOPLAM</td>
              {safeOffers.map((offer) => {
                const total = hasLineItems ? computeLineItemGrandTotal(lineItemRows, offer.id) : offer.total_price
                return (
                  <td key={offer.id} className="px-4 py-4 bg-emerald-50/70">
                    <span className="text-[18px] font-bold tracking-tight text-emerald-800 tabular-nums">
                      {formatMoney(total, offer.currency)}
                    </span>
                  </td>
                )
              })}
            </tr>

            <tr className="border-t border-neutral-200/80">
              <td className={featureCellClass(true)}>KDV</td>
              {safeOffers.map((offer, colIdx) => {
                const vat = getOfferVatStatus(offer)
                return (
                  <td
                    key={offer.id}
                    className={cn(
                      'px-4 py-3 text-[13px] leading-relaxed align-top whitespace-pre-wrap break-words font-medium',
                      vat ? 'text-neutral-800' : 'text-neutral-400',
                      valueCellClass(true, false, colIdx % 2 === 1)
                    )}
                  >
                    {vat || '—'}
                  </td>
                )
              })}
            </tr>

            {hasLineItems &&
              lineItemRows.map((row, idx) => {
                const odd = idx % 2 === 0
                const { bestOfferId, bestUnitPrice } = getLineItemRowStats(row)
                const rowSub = [row.quantity, row.unit].filter(Boolean).join(' ')
                return (
                  <tr key={idx} className="border-t border-neutral-200/80">
                    <td className={featureCellClass(odd)}>
                      {row.itemLabel}
                      {rowSub && <div className="text-[11px] font-normal text-neutral-500 mt-0.5">{rowSub}</div>}
                    </td>
                    {safeOffers.map((offer, colIdx) => {
                      const cell = (row.values || []).find((v) => v.offerId === offer.id)
                      const isBest =
                        bestOfferId != null && cell?.offerId === bestOfferId && cell?.unitPrice === bestUnitPrice
                      return (
                        <td
                          key={offer.id}
                          className={cn(
                            'px-4 py-[15px] align-top',
                            isBest ? 'bg-emerald-50' : valueCellClass(odd, false, colIdx % 2 === 1)
                          )}
                        >
                          {cell?.model && <div className="text-[11px] text-neutral-500 mb-1 truncate">{cell.model}</div>}
                          <div
                            className={cn(
                              'text-[15px] font-bold tabular-nums',
                              isBest ? 'text-emerald-700' : 'text-neutral-900'
                            )}
                          >
                            {formatMoney(cell?.unitPrice, offer.currency)}
                          </div>
                          {cell?.totalPrice != null && cell.totalPrice !== cell.unitPrice && (
                            <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
                              Toplam: {formatMoney(cell.totalPrice, offer.currency)}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

            {mixedCurrencies && (
              <tr>
                <td colSpan={colSpanAll} className="px-5 py-2 text-[11px] font-medium text-amber-600 bg-amber-50">
                  Teklifler farklı para birimlerinde, doğrudan kıyaslama yanıltıcı olabilir
                </td>
              </tr>
            )}

            {termRows.length > 0 && (
              <>
                <SectionBand label="Ticari Şartlar" colSpan={colSpanAll} />
                {termRows.map((row, idx) => {
                  const odd = idx % 2 === 0
                  return (
                    <tr key={row.label} className="border-t border-neutral-200/80">
                      <td className={featureCellClass(odd)}>{row.label}</td>
                      {safeOffers.map((offer, colIdx) => {
                        const value = row.get(offer)?.trim()
                        const isMissing = !value
                        return (
                          <td
                            key={offer.id}
                            className={cn(
                              'px-4 py-[15px] text-[14px] leading-relaxed align-top whitespace-pre-wrap break-words',
                              isMissing
                                ? 'text-neutral-400 italic bg-red-50/70 ring-1 ring-inset ring-red-200'
                                : cn('text-neutral-800', valueCellClass(odd, false, colIdx % 2 === 1))
                            )}
                          >
                            {value || '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </>
            )}

            {specRows.length > 0 && (
              <>
                <SectionBand label="Teknik Özellikler" colSpan={colSpanAll} />
                {specRows.map((row, idx) => {
                  const odd = idx % 2 === 0
                  const notesRow = isNotesFeature(row.feature)
                  return (
                    <tr key={idx} className="border-t border-neutral-200/80">
                      <td className={featureCellClass(odd)}>{row.feature}</td>
                      {safeOffers.map((offer, colIdx) => {
                        const value = (row.values || []).find((v) => v.offerId === offer.id)?.value?.trim()
                        const shown = Boolean(value && value !== 'Belirtilmemiş')
                        return (
                          <td
                            key={offer.id}
                            className={cn(
                              'px-4 py-[15px] text-[14px] leading-relaxed align-top',
                              shown ? 'text-neutral-800' : 'text-neutral-400',
                              valueCellClass(odd, false, colIdx % 2 === 1)
                            )}
                          >
                            {shown ? <FeatureValue value={value as string} notes={notesRow} /> : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
