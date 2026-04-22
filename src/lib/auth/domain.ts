/**
 * Auth Yardımcıları
 * 
 * Microsoft OAuth Single Tenant - Sadece şirket çalışanları giriş yapabilir.
 * Tüm kullanıcılar otomatik olarak site_personnel rolü alır.
 */

import type { UserRole } from '@/lib/types'

/**
 * Yeni kullanıcılar için varsayılan rol
 */
export const DEFAULT_ROLE: UserRole = 'site_personnel'

/**
 * Kullanıcının rolüne göre login sonrası gideceği sayfayı belirler
 */
export function getRedirectPath(role: UserRole | null | undefined): string {
  if (!role) return '/dashboard/requests'

  switch (role) {
    case 'admin':
    case 'manager':
    case 'warehouse_manager':
    case 'purchasing_officer':
      return '/dashboard'
    default:
      return '/dashboard/requests'
  }
}
