/** Web `src/lib/site-kind.ts` ve depo aksiyon kuralları ile aynı. */

export const CONSTRUCTION_WAREHOUSE_QUEUE_SITE_IDS = [
  'e8e66dc0-108a-463e-b461-b6d5b08d3beb',
  '05d5597a-8c36-4cf8-bf38-eabd3f2c081e',
  'f3ca5e01-2260-4a5b-b861-72ccf3fc2b15',
  'c9c2a77e-369d-4299-baf2-c52c3d69fbd3',
  '59485505-e1d7-4756-ad96-6e8e6a47155d',
  'b99e2366-82c5-43a4-9b0f-9e8b90a22f6c',
] as const

export const WAREHOUSE_QUEUE_STATUS = 'beklemede'

const QUEUE_SITE_IDS = new Set<string>(CONSTRUCTION_WAREHOUSE_QUEUE_SITE_IDS)

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

function normalizeLocationName(name: string | null | undefined): string {
  return (name || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function isConstructionWarehouseQueueSite(
  siteId?: string | null,
  siteName?: string | null
): boolean {
  if (siteId && QUEUE_SITE_IDS.has(siteId)) return true
  const normalized = normalizeLocationName(siteName)
  if (!normalized || normalized.includes('maintenance')) return false
  return CONSTRUCTION_SITE_MARKERS.some((marker) => normalized.includes(marker))
}

const SENT_TO_PURCHASING_STATUSES = new Set([
  'satın almaya gönderildi',
  'sipariş verildi',
  'teklif bekliyor',
  'eksik malzemeler talep edildi',
  'kısmen teslim alındı',
  'teslim alındı',
  'iade var',
  'iade nedeniyle sipariş',
  'ordered',
])

const WAREHOUSE_DEPOT_ACTION_STATUSES = new Set([
  'pending',
  'onay_bekliyor',
  'awaiting_offers',
  'kısmen gönderildi',
  'depoda mevcut değil',
  'ana depoda yok',
  'bekliyor',
  'beklemede',
])

export function isSentToPurchasingStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return SENT_TO_PURCHASING_STATUSES.has(status.toLowerCase())
}

export function isWarehouseDepotActionAllowed(status: string | null | undefined): boolean {
  if (!status) return false
  return WAREHOUSE_DEPOT_ACTION_STATUSES.has(status.toLowerCase())
}

/** Ana depo Gönder / Depoda yok butonları. Şantiye depo, kuyruk ve satın alma statusunda görmez. */
export function canShowDepotActionButtons(
  role: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (!status) return false
  if (isSentToPurchasingStatus(status) || status === 'gönderildi') return false
  if (status === WAREHOUSE_QUEUE_STATUS) return role === 'warehouse_manager'
  if (role === 'warehouse_manager') return isWarehouseDepotActionAllowed(status)
  return role === 'santiye_depo' || role === 'santiye_depo_yonetici' || role === 'santiye_depo_siparis'
}
