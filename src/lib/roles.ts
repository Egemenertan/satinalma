import { UserRole } from './types'

// Rol etiketleri ve açıklamaları
export const roleLabels: Record<UserRole, string> = {
  // Mevcut roller
  engineer: 'Şantiye Sorumlusu',
  site_supervisor: 'Saha Süpervizörü',
  procurement_specialist: 'Satın Alma Uzmanı',
  finance_manager: 'Finans Yöneticisi',
  project_manager: 'Proje Yöneticisi',
  general_manager: 'Genel Müdür',
  chief: 'Satın Alma Şefi',
  approver: 'Onaylayıcı',
  // Yeni roller
  muhendis: 'Mühendis',
  proje_sorumlusu: 'Proje Sorumlusu',
  satin_alma_sorumlusu: 'Satın Alma Sorumlusu',
  admin: 'Admin'
}

export const roleDescriptions: Record<UserRole, string> = {
  // Mevcut roller
  engineer: 'Talep oluşturma ve takip',
  site_supervisor: 'Saha kontrolü ve denetim',
  procurement_specialist: 'Satın alma süreçleri',
  finance_manager: 'Mali işler ve bütçe',
  project_manager: 'Proje planlama ve yönetim',
  general_manager: 'Genel yönetim ve koordinasyon',
  chief: 'Teklif yönetimi ve sipariş',
  approver: 'Onay/red kararları',
  // Yeni roller
  muhendis: 'Teknik değerlendirme ve analiz',
  proje_sorumlusu: 'Proje takibi ve koordinasyon',
  satin_alma_sorumlusu: 'Satın alma operasyonları',
  admin: 'Sistem yönetimi ve kullanıcı kontrolü'
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

// Rol gruplama (gelecekte kullanım için)
export const roleGroups = {
  legacy: ['engineer', 'chief', 'approver', 'site_supervisor', 'procurement_specialist', 'finance_manager', 'project_manager', 'general_manager'] as UserRole[],
  new: ['muhendis', 'proje_sorumlusu', 'satin_alma_sorumlusu', 'admin'] as UserRole[]
}

// NOT: Şu anda tüm roller aynı yetkilere sahiptir
// Bu dosya gelecekteki rol tabanlı yetkilendirme için hazırlık amaçlıdır
// Hiçbir rol kısıtlaması veya ayrıcalığı uygulanmamaktadır
