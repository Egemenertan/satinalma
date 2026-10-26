export type SiteKind = 'site' | 'warehouse'

/** Şantiye depo talebinin önce ana depoya (beklemede) düştüğü siteler. */
export const CONSTRUCTION_WAREHOUSE_QUEUE_SITE_IDS = [
  'e8e66dc0-108a-463e-b461-b6d5b08d3beb', // La Isla
  '05d5597a-8c36-4cf8-bf38-eabd3f2c081e', // La Casalia
  'f3ca5e01-2260-4a5b-b861-72ccf3fc2b15', // D-Point
  'c9c2a77e-369d-4299-baf2-c52c3d69fbd3', // Natulux
  '59485505-e1d7-4756-ad96-6e8e6a47155d', // Querencia
  '91263203-e4dc-4ef3-8e44-50562b6a87c7', // İskele Alt Geçit
  'b99e2366-82c5-43a4-9b0f-9e8b90a22f6c', // Courtyard Platinum
] as const

export const WAREHOUSE_QUEUE_STATUS = 'beklemede'

const CONSTRUCTION_WAREHOUSE_QUEUE_SITE_ID_SET = new Set<string>(CONSTRUCTION_WAREHOUSE_QUEUE_SITE_IDS)

export function isConstructionWarehouseQueueSite(
  siteId?: string | null,
  siteName?: string | null
): boolean {
  if (siteId && CONSTRUCTION_WAREHOUSE_QUEUE_SITE_ID_SET.has(siteId)) return true
  return isConstructionSiteName(siteName)
}

const CONSTRUCTION_SITE_MARKERS = [
  'la isla',
  'la ilsa',
  'la casalia',
  'natulux',
  'querencia',
  'iskele alt geçit',
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
