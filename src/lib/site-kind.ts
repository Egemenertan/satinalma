export type SiteKind = 'site' | 'warehouse'

const CONSTRUCTION_SITE_MARKERS = [
  'la isla',
  'la ilsa',
  'la casalia',
  'natulux',
  'querencia',
  'courtyard platinum',
  'platinum',
  'd point',
  'dpoint',
]

export function normalizeLocationName(name: string | null | undefined): string {
  return (name || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function isConstructionSiteName(name: string | null | undefined): boolean {
  const normalized = normalizeLocationName(name)
  if (!normalized) return false
  if (normalized.includes('maintenance')) return false
  return CONSTRUCTION_SITE_MARKERS.some((marker) => normalized.includes(marker))
}

export function getSiteKind(name: string | null | undefined): SiteKind {
  return isConstructionSiteName(name) ? 'site' : 'warehouse'
}

export function filterBySiteKind<T>(
  items: T[],
  kind: SiteKind,
  getName: (item: T) => string | null | undefined
): T[] {
  return items.filter((item) => getSiteKind(getName(item)) === kind)
}
