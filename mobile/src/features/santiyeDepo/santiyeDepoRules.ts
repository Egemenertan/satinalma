import type { PurchaseRequestItemRow, ShipmentInfo } from '../../lib/requestOfferBundle'

/** Web SantiyeDepoView / MaterialCard ile hizalı */
export const SPECIAL_GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'

export function shouldShowDepoTrackingSystem(status: string | null | undefined): boolean {
  if (!status) return false
  const s = status
  return (
    s === 'sipariş verildi' ||
    s === 'teslim alındı' ||
    s === 'kısmen teslim alındı' ||
    s === 'iade var'
  )
}

export function isReturnReorderRequestStatus(status: string | null | undefined): boolean {
  return status === 'iade nedeniyle sipariş'
}

export function canRemoveDepotMaterial(status: string | null | undefined): boolean {
  if (!status) return false
  const restricted = [
    'sipariş verildi',
    'teslim alındı',
    'kısmen teslim alındı',
    'gönderildi',
    'iade var',
  ]
  return !restricted.includes(status)
}

export function shouldHideDepotItemStructureButtons(
  shipmentData: Record<string, ShipmentInfo>,
  item: PurchaseRequestItemRow
): boolean {
  const itemShipments = shipmentData[item.id]
  const totalShipped = itemShipments?.total_shipped || 0
  const isDepotUnavailable = itemShipments?.shipments?.some((s) => {
    const q = (s as { shipped_quantity?: number }).shipped_quantity
    return q === 0
  })
  const isPartiallyShipped = totalShipped > 0 && item.quantity > 0
  const isFullyShipped = totalShipped > 0 && item.quantity <= 0
  return Boolean(isDepotUnavailable || isPartiallyShipped || isFullyShipped)
}

export function depotSectionTitle(status: string | null | undefined): string {
  if (isReturnReorderRequestStatus(status)) return 'İade nedeniyle yeniden sipariş'
  if (shouldShowDepoTrackingSystem(status)) return 'Malzeme takip sistemi'
  return 'Depo işlemleri'
}

export function depotSectionSubtitle(status: string | null | undefined): string {
  if (isReturnReorderRequestStatus(status)) {
    return 'Bu talep iade nedeniyle oluşturulmuştur. Gönderim işlemleri kapalı; salt okunur.'
  }
  if (shouldShowDepoTrackingSystem(status)) {
    return 'Talep, gönderim ve teslimat durumu. İade yeniden siparişleri web ile uyumlu şekilde izlenir.'
  }
  return 'Talep edilen malzemeleri kontrol edin, gönderim veya depoda yok işaretleyin.'
}

export function shouldShowDepoPdfExport(opts: {
  status: string | null | undefined
  siteId: string | null | undefined
  isGenelMerkezUser: boolean
}): boolean {
  const { status, siteId, isGenelMerkezUser } = opts
  if (!status) return false
  if (status === 'gönderildi') return true
  const isSpecialSite = siteId === SPECIAL_GMO_SITE_ID
  if (isSpecialSite) {
    return status === 'pending' || status === 'kısmen gönderildi' || status === 'sipariş verildi'
  }
  return isGenelMerkezUser && (status === 'pending' || status === 'kısmen gönderildi')
}

export function canDepoManagerApprove(opts: {
  role: string
  status: string | null | undefined
  siteId: string | null | undefined
}): boolean {
  const { role, status, siteId } = opts
  if (role !== 'santiye_depo_yonetici' && role !== 'site_manager') return false
  if (!status) return false
  const isSpecialSite = siteId === SPECIAL_GMO_SITE_ID
  if (isSpecialSite) {
    return (
      status === 'onay_bekliyor' ||
      status === 'kısmen gönderildi' ||
      status === 'depoda mevcut değil'
    )
  }
  return status === 'kısmen gönderildi' || status === 'depoda mevcut değil'
}
