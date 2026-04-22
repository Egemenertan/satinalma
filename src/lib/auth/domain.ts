/**
 * Auth & Profil Yardımcıları
 * 
 * Microsoft OAuth ile giriş yapan tüm kullanıcılar otomatik olarak
 * site_personnel rolü alır (Single Tenant - sadece şirket kullanıcıları giriş yapabilir).
 */

import type { UserRole } from '@/lib/types'

// ===== Sabitler =====

/**
 * Microsoft OAuth ile giriş yapan kullanıcılara atanacak varsayılan rol.
 * Single Tenant yapılandırması sayesinde sadece şirket çalışanları giriş yapabilir.
 */
export const DEFAULT_MICROSOFT_USER_ROLE: UserRole = 'site_personnel'

// ===== Yardımcı Fonksiyonlar =====

/**
 * Microsoft OAuth ile giriş yapan yeni kullanıcının başlangıç rolünü döndürür.
 * Single Tenant olduğu için tüm kullanıcılar şirket çalışanıdır → site_personnel
 */
export function getInitialRole(): UserRole {
  return DEFAULT_MICROSOFT_USER_ROLE
}

/**
 * Yeni kullanıcı için varsayılan şantiye atamalarını döndürür.
 * Admin, kullanıcıyı uygun şantiyelere manuel olarak atamalıdır.
 */
export function getInitialSiteIds(): string[] | null {
  return null
}

// ===== Yönlendirme Mantığı =====

/**
 * Kullanıcının rolüne göre login sonrası gideceği sayfayı belirler.
 */
export function getPostLoginRedirectPath(role: UserRole | null | undefined): string {
  if (!role) return '/dashboard/requests'

  switch (role) {
    case 'site_manager':
    case 'site_personnel':
    case 'santiye_depo':
    case 'santiye_depo_yonetici':
    case 'department_head':
      return '/dashboard/requests'
    case 'admin':
    case 'manager':
    case 'warehouse_manager':
    case 'purchasing_officer':
      return '/dashboard'
    default:
      return '/dashboard/requests'
  }
}

/**
 * Bu rol dashboard'a girebilir mi?
 * Microsoft OAuth Single Tenant olduğu için tüm kullanıcılar girebilir.
 */
export function canAccessDashboard(role: UserRole | null | undefined): boolean {
  if (!role) return false
  return true // Tüm roller dashboard'a erişebilir
}
