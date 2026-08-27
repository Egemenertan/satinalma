'use client'

import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { getCurrencySymbol } from '@/components/offers/types'
import { cn } from '@/lib/utils'
import { DlxAiLogo } from '@/components/quoteComparison/DlxAiLogo'
import type {
  QuoteComparisonOffer,
  QuoteComparisonRecommendation,
} from '@/types/quoteComparison'

interface RecommendationBannerProps {
  recommendation: QuoteComparisonRecommendation
  offers: QuoteComparisonOffer[]
  recommendedOfferId?: string | null
}

function offerDisplayName(offer: QuoteComparisonOffer): string {
  return offer.supplier_name?.trim() || offer.extracted_data?.supplier_name?.trim() || offer.file_name
}

function toReadableBlocks(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((part) => part.trim())
    .filter(Boolean)
}

function resolveRecommendedOffer(
  offers: QuoteComparisonOffer[],
  recommendation: QuoteComparisonRecommendation,
  fallbackId?: string | null
): QuoteComparisonOffer | undefined {
  const rec = recommendation as any
  const rawId = recommendation.recommendedOfferId || rec.recommended_offer_id || fallbackId || null
  if (rawId) {
    const byId = offers.find((o) => o.id === rawId)
    if (byId) return byId
    const needle = String(rawId).trim().toLocaleLowerCase('tr-TR')
    const byName = offers.find((o) => {
      const names = [offerDisplayName(o), o.file_name, o.supplier_name || '', o.extracted_data?.supplier_name || '']
      return names.some((n) => n.trim().toLocaleLowerCase('tr-TR') === needle)
    })
    if (byName) return byName
  }

  const haystack = `${recommendation.summary || rec.summary || ''} ${recommendation.reasoning || rec.reasoning || ''}`
    .toLocaleLowerCase('tr-TR')
  if (haystack.trim()) {
    const ranked = offers
      .map((o) => {
        const name = offerDisplayName(o).trim()
        if (name.length < 3) return { o, score: 0 }
        return { o, score: haystack.includes(name.toLocaleLowerCase('tr-TR')) ? name.length : 0 }
      })
      .sort((a, b) => b.score - a.score)
    if (ranked[0]?.score) return ranked[0].o
  }

  return undefined
}

function briefWhy(recommendation: QuoteComparisonRecommendation): string[] {
  const rec = recommendation as any
  const summary = toReadableBlocks(recommendation.summary || rec.summary)
  if (summary.length > 0) return summary.slice(0, 3)
  const reasoning = toReadableBlocks(recommendation.reasoning || rec.reasoning)
  if (reasoning.length > 0) return reasoning.slice(0, 2)
  return toReadableBlocks(recommendation.priorityConsideration || rec.priority_consideration).slice(0, 2)
}

export function RecommendationBanner({
  recommendation,
  offers,
  recommendedOfferId,
}: RecommendationBannerProps) {
  const safeOffers = offers || []
  const prosCons = recommendation.prosCons || (recommendation as any).pros_cons || []
  const recommendedOffer = resolveRecommendedOffer(safeOffers, recommendation, recommendedOfferId)
  const recommendedName = recommendedOffer ? offerDisplayName(recommendedOffer) : null
  const whyBlocks = briefWhy(recommendation)
  const executiveAnalysis =
    recommendation.executiveAnalysis || (recommendation as any).executive_analysis || []
  const prosConsByOffer = new Map(
    (Array.isArray(prosCons) ? prosCons : []).map((pc: any) => [pc.offerId || pc.offer_id, pc])
  )
  const usedPriorities =
    recommendation.priorityCriteria || (recommendation as any).priority_criteria || null

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 sm:px-6 py-5 sm:py-6">
        <DlxAiLogo className="h-7 mb-3" />
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 leading-snug">
          DLX AI'ın önerisi{recommendedName ? `: ${recommendedName}` : ''}
        </h2>
        {recommendedOffer?.total_price != null && (
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-neutral-700">
            {getCurrencySymbol(recommendedOffer.currency || 'TRY')}
            {recommendedOffer.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        )}
        {whyBlocks.length > 0 && (
          <div className="mt-4 space-y-2">
            {whyBlocks.map((block, i) => (
              <p key={i} className="text-[15px] text-neutral-700 leading-7">
                {block}
              </p>
            ))}
          </div>
        )}
      </div>

      {Array.isArray(executiveAnalysis) && executiveAnalysis.length > 0 && (
        <div className="px-5 sm:px-6 py-5 bg-neutral-50 border-t border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">
            Yönetici Değerlendirmesi
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {executiveAnalysis.map((section: any, i: number) => (
              <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
                <p className="text-sm font-bold text-neutral-900 mb-1.5">{section.title}</p>
                <p className="text-sm text-neutral-700 leading-6 whitespace-pre-wrap">{section.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {usedPriorities?.trim() && (
        <div className="px-5 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-1.5">Dikkate alınan öncelikler</p>
          <p className="text-sm text-neutral-800 leading-6 whitespace-pre-wrap">{usedPriorities.trim()}</p>
        </div>
      )}

      {Array.isArray(prosCons) && prosCons.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5 sm:p-6 bg-neutral-50 border-t border-neutral-200">
          {safeOffers.map((offer) => {
            const pc = prosConsByOffer.get(offer.id)
            if (!pc) return null
            const isRecommended = recommendedOffer?.id === offer.id
            const pros = pc.pros || []
            const cons = pc.cons || []
            return (
              <div
                key={offer.id}
                className={cn(
                  'rounded-xl border p-4 bg-white',
                  isRecommended ? 'border-2 border-[#00E676]' : 'border-neutral-200'
                )}
              >
                <p className="text-sm font-bold text-neutral-900 mb-2 truncate">{offerDisplayName(offer)}</p>
                {pros.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {pros.map((pro: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-emerald-700">
                        <ThumbsUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {cons.length > 0 && (
                  <ul className="space-y-1">
                    {cons.map((con: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-red-600">
                        <ThumbsDown className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-500" />
                        <span>{con}</span>
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
  )
}
