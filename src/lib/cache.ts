import { mutate } from 'swr'

/**
 * Cache invalidation utility fonksiyonları
 * SWR cache'ini global olarak yönetmek için
 */

// Purchase requests ile ilgili tüm cache'leri temizle
export const invalidatePurchaseRequestsCache = () => {
  // Tablo cache'ini temizle
  mutate(key => typeof key === 'string' && key.startsWith('purchase_requests/'), undefined, { revalidate: true })
  
  // Stats cache'ini temizle
  mutate('purchase_requests_stats', undefined, { revalidate: true })
  
  // Bekleyen talep sayısı cache'ini temizle (Sidebar notification için)
  mutate('pending_requests_count', undefined, { revalidate: true })
  
  console.log('🔄 Purchase requests cache invalidated')
}

// Dashboard cache'leri
export const invalidateDashboardCache = () => {
  mutate('dashboard_stats', undefined, { revalidate: true })
  mutate('daily_request_data', undefined, { revalidate: true })
  mutate('recent_requests', undefined, { revalidate: true })
  console.log('🔄 Dashboard cache invalidated')
}

// Sites cache'leri
export const invalidateSitesCache = () => {
  mutate('sites_with_stats', undefined, { revalidate: true })
  mutate('sites_stats', undefined, { revalidate: true })
  console.log('🔄 Sites cache invalidated')
}

// Suppliers cache'leri
export const invalidateSuppliersCache = () => {
  mutate('suppliers_list', undefined, { revalidate: true })
  mutate('suppliers_stats', undefined, { revalidate: true })
  console.log('🔄 Suppliers cache invalidated')
}

// Sadece stats cache'ini temizle
export const invalidateStatsCache = () => {
  mutate('purchase_requests_stats', undefined, { revalidate: true })
  console.log('🔄 Stats cache invalidated')
}

// Sadece tablo cache'ini temizle
export const invalidateTableCache = () => {
  mutate(key => typeof key === 'string' && key.startsWith('purchase_requests/'), undefined, { revalidate: true })
  console.log('🔄 Table cache invalidated')
}

// Tüm cache'i temizle (kullanıcı logout olduğunda vs.)
export const clearAllCache = () => {
  mutate(() => true, undefined, { revalidate: false })
  console.log('🧹 All cache cleared')
}

// Belirli bir sayfa cache'ini temizle
export const invalidatePageCache = (page: number, pageSize: number = 20) => {
  mutate(`purchase_requests/${page}/${pageSize}`, undefined, { revalidate: true })
  console.log(`🔄 Page ${page} cache invalidated`)
}

// Manual refresh fonksiyonları - component'ların kullanabileceği
export const refreshPurchaseRequestsData = () => {
  invalidatePurchaseRequestsCache()
}

export const refreshStatsData = () => {
  invalidateStatsCache()
}

export const refreshDashboardData = () => {
  invalidateDashboardCache()
}

export const refreshSitesData = () => {
  invalidateSitesCache()
}

export const refreshSuppliersData = () => {
  invalidateSuppliersCache()
}

// Global cache invalidation - tüm sayfalardaki cache'leri temizle
export const invalidateAllPagesCache = () => {
  invalidatePurchaseRequestsCache()
  invalidateDashboardCache()
  invalidateSitesCache()
  invalidateSuppliersCache()
  console.log('🔄 All pages cache invalidated')
}
