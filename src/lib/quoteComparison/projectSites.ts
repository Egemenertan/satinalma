import { createClient } from '@/lib/supabase/client'

/** Teklif karşılaştırmasında proje olarak seçilebilen siteler (normalize edilmiş anahtar). */
export const QUOTE_COMPARISON_SITE_KEYS = [
  'querencia',
  'la casalia',
  'la isla',
  'd point',
  'natulux',
  'courtyard platinum',
] as const

export type QuoteComparisonSiteKey = (typeof QUOTE_COMPARISON_SITE_KEYS)[number]

export const QUOTE_COMPARISON_SITE_LABELS: Record<QuoteComparisonSiteKey, string> = {
  querencia: 'Querencia',
  'la casalia': 'La Casalia',
  'la isla': 'La Isla',
  'd point': 'D-Point',
  natulux: 'Natulux',
  'courtyard platinum': 'Courtyard Platinum',
}

export const OTHER_PROJECT_KEY = 'other'
export const ALL_PROJECTS_KEY = 'all'

export interface QuoteComparisonSite {
  id: string
  key: QuoteComparisonSiteKey
  name: string
  imageUrl?: string | null
}

export function normalizeSiteName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function isQuoteComparisonSiteKey(value: string): value is QuoteComparisonSiteKey {
  return (QUOTE_COMPARISON_SITE_KEYS as readonly string[]).includes(value)
}

export function getQuoteComparisonSiteKey(name: string | null | undefined): QuoteComparisonSiteKey | null {
  if (!name?.trim()) return null
  const normalized = normalizeSiteName(name)
  return isQuoteComparisonSiteKey(normalized) ? normalized : null
}

export function getQuoteComparisonSiteLabel(name: string | null | undefined): string | null {
  if (!name?.trim()) return null
  const key = getQuoteComparisonSiteKey(name)
  if (key) return QUOTE_COMPARISON_SITE_LABELS[key]
  return name.trim()
}

export function getFallbackQuoteComparisonSites(): QuoteComparisonSite[] {
  return QUOTE_COMPARISON_SITE_KEYS.map((key) => ({
    id: key,
    key,
    name: QUOTE_COMPARISON_SITE_LABELS[key],
  }))
}

export async function fetchQuoteComparisonSites(): Promise<QuoteComparisonSite[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('sites').select('id, name, image_url').order('name')

  if (error) {
    console.error('Quote comparison sites fetch error:', error)
    throw error
  }

  const matched = new Map<QuoteComparisonSiteKey, QuoteComparisonSite>()

  for (const row of data || []) {
    const key = getQuoteComparisonSiteKey(row.name)
    if (!key || matched.has(key)) continue
    matched.set(key, {
      id: row.id,
      key,
      name: row.name.trim() || QUOTE_COMPARISON_SITE_LABELS[key],
      imageUrl: row.image_url?.trim() || null,
    })
  }

  return getFallbackQuoteComparisonSites().map((fallback) => matched.get(fallback.key) ?? fallback)
}
