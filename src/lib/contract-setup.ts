import type { ContractCategory, ContractPartyKind } from '@/lib/contracts'
import {
  QUOTE_COMPARISON_SITE_LABELS,
  type QuoteComparisonSiteKey,
  getQuoteComparisonSiteKey,
} from '@/lib/quoteComparison/projectSites'

/** Sözleşmenin kapsayabileceği projeler, kullanıcının istediği sırayla. */
export const CONTRACT_PROJECT_KEYS: QuoteComparisonSiteKey[] = [
  'courtyard platinum',
  'querencia',
  'natulux',
  'la isla',
  'la casalia',
  'd point',
]

export const CONTRACT_CATEGORIES: Array<{
  id: ContractCategory
  title: string
  description: string
}> = [
  {
    id: 'goods_and_services',
    title: 'Mal ve hizmet alımı',
    description: 'Hem malzeme hem hizmet kalemlerini kapsar',
  },
  {
    id: 'goods',
    title: 'Mal alımı',
    description: 'Yalnızca malzeme ve ürün alımı',
  },
  {
    id: 'services',
    title: 'Hizmet alımı',
    description: 'Yalnızca hizmet ve işçilik',
  },
]

export function contractProjectLabel(_siteId: string, fallbackName?: string | null): string {
  const key = getQuoteComparisonSiteKey(fallbackName)
  if (key) return contractProjectKeyLabel(key)
  return fallbackName?.trim() || 'Proje'
}

export function contractProjectKeyLabel(key: QuoteComparisonSiteKey): string {
  if (key === 'd point') return 'D Point'
  return QUOTE_COMPARISON_SITE_LABELS[key]
}

export function contractCategoryLabel(category: ContractCategory | null | undefined): string | null {
  if (!category) return null
  return CONTRACT_CATEGORIES.find((item) => item.id === category)?.title ?? null
}

export function contractPartyLabel(kind: ContractPartyKind | null | undefined): string {
  return kind === 'subcontractor' ? 'Taşeron' : 'Tedarikçi'
}
