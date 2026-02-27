import { UserRole } from './types'

// Rol etiketleri ve açıklamaları
export const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Yönetici', 
  user: 'Kullanıcı',
  site_personnel: 'Şantiye Personeli',
  site_manager: 'Şantiye Yöneticisi',
  warehouse_manager: 'Depo Yöneticisi',
  purchasing_officer: 'Satın Alma Sorumlusu',
  santiye_depo: 'Şantiye Depo',
  santiye_depo_yonetici: 'Şantiye Depo Yöneticisi'
}

export const roleDescriptions: Record<UserRole, string> = {
  admin: 'Sistem yönetimi ve kullanıcı kontrolü',
  manager: 'Yönetici yetkileri ve onay süreçleri',
  user: 'Temel kullanıcı yetkileri',
  site_personnel: 'Sadece talep görüntüleme yetkisi',
  site_manager: 'Talep yönetimi ve onay yetkisi',
  warehouse_manager: 'Dashboard, talep, ürün ve marka yönetimi yetkisi',
  purchasing_officer: 'Dashboard, talep ve sipariş yönetimi yetkisi',
  santiye_depo: 'Tüm satın alma taleplerini görüntüleme yetkisi',
  santiye_depo_yonetici: 'Depo işlemleri ve talep onaylama yetkisi (Şantiye Depo + Site Manager)'
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
  site_management: ['site_manager', 'warehouse_manager', 'santiye_depo_yonetici'] as UserRole[], // Dashboard ve requests sayfaları + onay yetkisi
  purchasing_access: ['purchasing_officer'] as UserRole[] // Dashboard, requests, orders ve reports sayfaları
}

// Admin kontrolü için helper
const isAdmin = (role: string): boolean => role === 'admin'

// Rol bazlı sayfa erişim kontrolleri
export const canAccessPage = (userRole: UserRole, page: string): boolean => {
  // Admin özel kontrolleri
  if (isAdmin(userRole)) {
    return true // Admin her yere erişebilir (admin sayfası dahil)
  }
  
  // Admin sayfası sadece admin rolüne özel
  if (page === 'admin' || page === '/dashboard/admin' || page.startsWith('/dashboard/admin/')) {
    return isAdmin(userRole)
  }
  
  // Manager her yere erişebilir (admin sayfası hariç)
  if (userRole === 'manager') {
    return true
  }
  
  // Site yöneticisi requests, inventory ve all-inventory sayfasına erişebilir
  if (userRole === 'site_manager') {
    return page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/') ||
           page === 'inventory' ||
           page === '/dashboard/inventory' ||
           page === 'all-inventory' ||
           page === '/dashboard/inventory/all'
  }
  
  // Depo yöneticisi dashboard, requests, inventory, products, brands ve reports sayfalarına erişebilir
  if (userRole === 'warehouse_manager') {
    return page === 'dashboard' || 
           page === '/dashboard' ||
           page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/') ||
           page === 'inventory' ||
           page === '/dashboard/inventory' ||
           page === 'all-inventory' ||
           page === '/dashboard/inventory/all' ||
           page === 'products' ||
           page === '/dashboard/products' ||
           page.startsWith('/dashboard/products/') ||
           page === 'brands' ||
           page === '/dashboard/brands' ||
           page.startsWith('/dashboard/brands/') ||
           page === 'reports' ||
           page === '/dashboard/reports'
  }
  
  // Purchasing officer dashboard, requests, inventory, products, orders ve reports sayfalarına erişebilir
  // NOT: suppliers ve sites sayfalarına erişemez
  if (userRole === 'purchasing_officer') {
    return page === 'dashboard' || 
           page === '/dashboard' ||
           page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/') ||
           page === 'inventory' ||
           page === '/dashboard/inventory' ||
           page === 'products' ||
           page === '/dashboard/products' ||
           page.startsWith('/dashboard/products/') ||
           page === 'orders' ||
           page === '/dashboard/orders' ||
           page.startsWith('/dashboard/orders/') ||
           page === 'reports' ||
           page === '/dashboard/reports'
  }
  
  // Site personeli sadece requests ve inventory sayfasına erişebilir
  if (userRole === 'site_personnel') {
    return page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/') ||
           page === 'inventory' ||
           page === '/dashboard/inventory'
  }
  
  // Santiye depo sadece requests, inventory ve products sayfasına erişebilir
  if (userRole === 'santiye_depo') {
    return page === 'requests' || 
           page === '/dashboard/requests' || 
           page.startsWith('/dashboard/requests/') ||
           page === 'inventory' ||
           page === '/dashboard/inventory' ||
           page === 'products' ||
           page === '/dashboard/products' ||
           page.startsWith('/dashboard/products/')
  }
  
  // Santiye depo yöneticisi - site_manager ile aynı yetkilere sahip
  if (userRole === 'santiye_depo_yonetici') {
    return page === 'requests' || 
           page === '/dashboard/requests' || 
           page === '/dashboard/requests/create' ||
           page.startsWith('/dashboard/requests/') ||
           page === 'inventory' ||
           page === '/dashboard/inventory'
  }
  
  
  // Normal kullanıcılar sadece inventory sayfasına erişebilir
  if (userRole === 'user') {
    return page === 'inventory' || page === '/dashboard/inventory'
  }
  
  return false
}

// Sidebar menü öğelerini filtreleme
export const getAccessibleMenuItems = (userRole: UserRole) => {
  if (userRole === 'site_manager') {
    return ['requests', 'inventory', 'all-inventory'] // Requests, zimmet ve tüm zimmetler menüsü
  }
  
  if (userRole === 'warehouse_manager') {
    return ['dashboard', 'requests', 'inventory', 'all-inventory', 'products', 'brands', 'reports'] // Dashboard, requests, zimmet, tüm zimmetler, products, brands ve reports
  }
  
  if (userRole === 'purchasing_officer') {
    return ['dashboard', 'requests', 'inventory', 'products', 'orders', 'reports'] // Dashboard, requests, zimmet, products, orders ve reports (suppliers ve sites erişimi yok)
  }
  
  if (userRole === 'site_personnel') {
    return ['requests', 'inventory'] // Requests ve zimmet menüsü
  }
  
  if (userRole === 'santiye_depo') {
    return ['requests', 'inventory', 'products'] // Requests, zimmet ve ürünler menüsü
  }
  
  if (userRole === 'santiye_depo_yonetici') {
    return ['requests', 'inventory'] // Requests ve zimmet menüsü (site_manager gibi)
  }
  
  
  if (userRole === 'user') {
    return ['inventory'] // User rolü sadece zimmet sayfasına erişebilir
  }
  
  // Admin tüm menülere erişebilir (admin menüsü dahil)
  if (userRole === 'admin') {
    return ['dashboard', 'requests', 'inventory', 'all-inventory', 'offers', 'suppliers', 'sites', 'orders', 'products', 'brands', 'reports', 'admin', 'settings']
  }
  
  // Manager tüm menülere erişebilir (admin menüsü hariç)
  return ['dashboard', 'requests', 'inventory', 'all-inventory', 'offers', 'suppliers', 'sites', 'orders', 'products', 'brands', 'reports', 'settings']
}
