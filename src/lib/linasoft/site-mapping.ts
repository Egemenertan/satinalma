/**
 * Satınalma şantiyesi → Linasoft firma/şube eşleşmesi.
 * ID'ler Linasoft yetkililerinden/Swagger'dan netleşince env'e yazılır.
 */

export const COURTYARD_PLATINUM_SITE_ID = 'b99e2366-82c5-43a4-9b0f-9e8b90a22f6c'

export interface LinasoftSiteMapping {
  firmaId: number
  subeId?: number
}

export function getLinasoftSiteMapping(siteId: string): LinasoftSiteMapping | null {
  if (siteId !== COURTYARD_PLATINUM_SITE_ID) return null
  const firmaId = Number(process.env.LINASOFT_COURTYARD_FIRMA_ID)
  if (!Number.isFinite(firmaId) || firmaId <= 0) return null
  const subeId = Number(process.env.LINASOFT_COURTYARD_SUBE_ID)
  return { firmaId, subeId: Number.isFinite(subeId) && subeId > 0 ? subeId : undefined }
}
