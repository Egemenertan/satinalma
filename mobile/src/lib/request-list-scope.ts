import { SPECIAL_SITE_ID } from './constants'

const SKIP_GENERIC_DEPARTMENT_ROLES = new Set([
  'department_head',
  'purchasing_officer',
  'site_manager',
  'santiye_depo',
  'santiye_depo_siparis',
  'santiye_depo_yonetici',
  'site_personnel',
])

export function shouldApplyProfileDepartmentFilter(
  role: string | null | undefined,
  options?: { isItWarehouseManager?: boolean; isElevated?: boolean }
): boolean {
  if (options?.isElevated || options?.isItWarehouseManager) return false
  const r = (role || '').trim()
  if (!r) return true
  return !SKIP_GENERIC_DEPARTMENT_ROLES.has(r)
}

/**
 * Şantiye yöneticisi listesi:
 * - Kendi oluşturduğu talepler (site_id boş olsa bile)
 * - Atandığı şantiye sitelerindeki tüm talepler (departman fark etmeksizin)
 * - GMO varsa, GMO'da yalnızca kendi departmanı
 */
export function siteManagerRequestOrFilter(
  userId: string,
  siteIds: string[],
  department?: string | null
): string {
  const uniqueSiteIds = [...new Set(siteIds.filter(Boolean))]
  const constructionIds = uniqueSiteIds.filter((id) => id !== SPECIAL_SITE_ID)
  const hasGmo = uniqueSiteIds.includes(SPECIAL_SITE_ID)
  const dept = (department || '').trim()
  const parts: string[] = [`requested_by.eq.${userId}`]

  if (constructionIds.length === 1) {
    parts.push(`site_id.eq.${constructionIds[0]}`)
  } else if (constructionIds.length > 1) {
    parts.push(`site_id.in.(${constructionIds.join(',')})`)
  }

  if (hasGmo) {
    if (dept) {
      parts.push(`and(site_id.eq.${SPECIAL_SITE_ID},department.eq.${dept})`)
    } else {
      parts.push(`site_id.eq.${SPECIAL_SITE_ID}`)
    }
  }

  return parts.join(',')
}
