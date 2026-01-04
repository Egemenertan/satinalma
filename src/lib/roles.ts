import { UserRole } from './types'

// Rol etiketleri ve açıklamaları
export const roleLabels: Record<UserRole, string> = {
  user: 'Kullanıcı',
  manager: 'Yönetici', 
  admin: 'Admin',
  site_personnel: 'Şantiye Personeli',
  site_manager: 'Şantiye Yöneticisi',
  warehouse_manager: 'Depo Yöneticisi',
  purchasing_officer: 'Satın Alma Sorumlusu',
  santiye_depo: 'Şantiye Depo'
}

export const roleDescriptions: Record<UserRole, string> = {
  user: 'Temel kullanıcı yetkileri',
  manager: 'Yönetici yetkileri ve onay süreçleri',
  admin: 'Sistem yönetimi ve kullanıcı kontrolü',
  site_personnel: 'Sadece talep görüntüleme yetkisi',
  site_manager: 'Talep yönetimi ve onay yetkisi',
  warehouse_manager: 'Dashboard ve talep yönetimi yetkisi',
  purchasing_officer: 'Dashboard ve talep yönetimi yetkisi',
  santiye_depo: 'Tüm satın alma taleplerini görüntüleme yetkisi'
}

// Rol doğrulama
export const isValidRole = (role: string): role is UserRole => {
  return Object.keys(roleLabels).includes(role as UserRole)
}

// Rol etiketini al
export const getRoleLabel = (role: UserRole): string => {
  return roleLabels[role] || role
}

// Rol açıklamasını al
export const getRoleDescription = (role: UserRole): string => {
  return roleDescriptions[role] || ''
}

// Tüm rolleri al
export const getAllRoles = (): Array<{ value: UserRole; label: string; description: string }> => {
  return Object.entries(roleLabels).map(([value, label]) => ({
    value: value as UserRole,
    label,
    description: roleDescriptions[value as UserRole]
  }))
}

// Rol gruplama ve yetkilendirme
export const roleGroups = {
  full_access: ['admin', 'manager'] as UserRole[], // Tüm sayfalara erişim
  basic_access: ['user'] as UserRole[], // Normal kullanıcı erişimi
  limited_access: ['site_personnel', 'santiye_depo'] as UserRole[], // Sadece requests sayfası
  site_management: ['site_manager', 'warehouse_manager'] as UserRole[], // Dashboard ve requests sayfaları
  purchasing_access: ['purchasing_officer'] as UserRole[] // Dashboard, requests, suppliers, sites sayfaları
}

// Rol bazlı sayfa erişim kontrolleri
export const canAccessPage = (userRole: UserRole, page: string): boolean => {
  // Admin ve manager her yere erişebilir
  if (roleGroups.full_access.includes(userRole)) {
    return true
  }
  
  // Site yöneticisi sadece requests sayfasına erişebilir
  if (userRole === 'site_manager') {
    return page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/')
  }
  
  // Depo yöneticisi dashboard ve requests sayfalarına erişebilir
  if (userRole === 'warehouse_manager') {
    return page === 'dashboard' || 
           page === '/dashboard' ||
           page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/') ||
           page === 'reports' ||
           page === '/dashboard/reports'
  }
  
  // Purchasing officer dashboard, requests, suppliers, sites, orders, products, brands ve reports sayfalarına erişebilir
  if (userRole === 'purchasing_officer') {
    return page === 'dashboard' || 
           page === '/dashboard' ||
           page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/') ||
           page === 'suppliers' ||
           page === '/dashboard/suppliers' ||
           page.startsWith('/dashboard/suppliers/') ||
           page === 'sites' ||
           page === '/dashboard/sites' ||
           page.startsWith('/dashboard/sites/') ||
           page === 'orders' ||
           page === '/dashboard/orders' ||
           page.startsWith('/dashboard/orders/') ||
           page === 'products' ||
           page === '/dashboard/products' ||
           page.startsWith('/dashboard/products/') ||
           page === 'brands' ||
           page === '/dashboard/brands' ||
           page.startsWith('/dashboard/brands/') ||
           page === 'reports' ||
           page === '/dashboard/reports'
  }
  
  // Site personeli sadece requests sayfasına ve talep oluşturma sayfasına erişebilir
  if (userRole === 'site_personnel') {
    return page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/')
  }
  
  // Santiye depo sadece requests sayfasına erişebilir (site personnel ile aynı)
  if (userRole === 'santiye_depo') {
    return page === 'requests' || 
           page === '/dashboard/requests' || 
           page.startsWith('/dashboard/requests/')
  }
  
  // Normal kullanıcılar hiçbir sayfaya erişemez
  if (userRole === 'user') {
    return false
  }
  
  return false
}

// Sidebar menü öğelerini filtreleme
export const getAccessibleMenuItems = (userRole: UserRole) => {
  if (userRole === 'site_manager') {
    return ['requests'] // Sadece requests menüsü
  }
  
  if (userRole === 'warehouse_manager') {
    return ['dashboard', 'requests', 'products', 'brands', 'reports'] // Dashboard, requests, products, brands ve reports
  }
  
  if (userRole === 'purchasing_officer') {
    return ['dashboard', 'requests', 'suppliers', 'sites', 'orders', 'products', 'brands', 'reports'] // Dashboard, requests, suppliers, sites, orders, products, brands ve reports
  }
  
  if (userRole === 'site_personnel') {
    return ['requests'] // Sadece requests menüsü
  }
  
  if (userRole === 'santiye_depo') {
    return ['requests'] // Sadece requests menüsü
  }
  
  if (userRole === 'user') {
    return [] // User rolü hiçbir menüye erişemez
  }
  
  // Admin ve manager tüm menülere erişebilir
  return ['dashboard', 'requests', 'offers', 'suppliers', 'sites', 'orders', 'products', 'brands', 'reports', 'settings']
}
