import { getRoleDescription, getRoleLabel } from '@/lib/roles'
import type { UserRole } from '@/lib/types'
import { isSentToPurchasingStatus } from '@/lib/request-process'
import { titleCaseTr } from '@/lib/reports/titleCase'

export const ROLE_REPORT_OPTIONS: UserRole[] = [
  'purchasing_officer',
  'site_manager',
  'department_head',
  'warehouse_manager',
  'santiye_depo_yonetici',
  'santiye_depo',
  'site_personnel',
  'manager',
  'admin',
]

export type RoleSlaBucketKey = 'under_1h' | 'h1_4' | 'h4_24' | 'd1_3' | 'over_3d' | 'pending'

export type RoleSlaBucket = {
  key: RoleSlaBucketKey
  label: string
  count: number
}

export type RolePerformanceUser = {
  userId: string
  fullName: string
  email: string | null
  department: string | null
  isActive: boolean
  requestCreatedCount: number
  approvalCount: number
  rejectionCount: number
  sentToPurchasingCount: number
  orderCount: number
  invoiceGroupCount: number
  shipmentCount: number
  deliveryConfirmCount: number
  completedCaseCount: number
  pendingCaseCount: number
  avgMinutes: number | null
  medianMinutes: number | null
  lastActionAt: string | null
}

export type RolePerformanceCase = {
  requestId: string
  requestNumber: string
  siteName: string | null
  department: string | null
  status: string | null
  actorId: string | null
  actorName: string
  startAt: string | null
  actionAt: string | null
  minutes: number | null
  metricLabel: string
}

export type RolePerformanceSummary = {
  userCount: number
  actionCount: number
  caseCount: number
  completedCaseCount: number
  pendingCaseCount: number
  avgMinutes: number | null
  medianMinutes: number | null
  orderCount: number
  approvalCount: number
  rejectionCount: number
  requestCreatedCount: number
  shipmentCount: number
  invoiceGroupCount: number
}

export type RolePerformanceReport = {
  filters: {
    role: UserRole
    userId: string | null
    dateFrom: string
    dateTo: string
  }
  roleLabel: string
  roleDescription: string
  metricTitle: string
  metricHint: string
  summary: RolePerformanceSummary
  slaBuckets: RoleSlaBucket[]
  users: RolePerformanceUser[]
  cases: RolePerformanceCase[]
}

export function isReportRole(value: string): value is UserRole {
  return ROLE_REPORT_OPTIONS.includes(value as UserRole)
}

export function getRoleMetricCopy(role: UserRole): { title: string; hint: string } {
  switch (role) {
    case 'purchasing_officer':
      return {
        title: 'Satın Almaya Geliş → İlk Sipariş',
        hint: 'Talep Satın Alma Statüsüne Geldikten Sonra İlk Siparişin Verilme Süresi',
      }
    case 'site_manager':
      return {
        title: 'Talep Oluşturma → Yönetici İşlemi',
        hint: 'Şantiye Yöneticisinin Onay Veya Satın Almaya Gönderme Süresi',
      }
    case 'department_head':
      return {
        title: 'Talep Oluşturma → Departman Onayı',
        hint: 'Departman Yöneticisinin Talebi Onaylama Süresi',
      }
    case 'warehouse_manager':
      return {
        title: 'Talep Oluşturma → Depo Kararı',
        hint: 'Depo Yöneticisinin Stok Kontrolü Veya Sevkiyat Süresi',
      }
    case 'santiye_depo_yonetici':
      return {
        title: 'Talep Oluşturma → Depo / Satın Alma Kararı',
        hint: 'Şantiye Depo Yöneticisinin Satın Almaya Gönderme Veya Depo Kararı Süresi',
      }
    case 'santiye_depo':
      return {
        title: 'Talep Oluşturma → Sevkiyat',
        hint: 'Şantiye Depo Kullanıcısının Sevkiyat Ve Depo İşlem Süresi',
      }
    case 'site_personnel':
      return {
        title: 'Talep Oluşturma Ve Teslim Onayı',
        hint: 'Şantiye Personelinin Oluşturduğu Talepler Ve Teslim Onay Süreleri',
      }
    default:
      return {
        title: 'İşlem Performansı',
        hint: 'Bu Roldeki Kullanıcıların Yaptığı İşlemlere Göre Süre Ve Adet Özeti',
      }
  }
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—'
  const abs = Math.max(0, Math.round(minutes))
  if (abs < 1) return titleCaseTr('1 Dk Altı')
  const days = Math.floor(abs / (60 * 24))
  const hours = Math.floor((abs % (60 * 24)) / 60)
  const mins = abs % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days} Gün`)
  if (hours > 0) parts.push(`${hours} Saat`)
  if (mins > 0 && days === 0) parts.push(`${mins} Dk`)
  return parts.join(' ') || titleCaseTr('1 Dk Altı')
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export function minutesBetween(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return Math.max(0, Math.round((end - start) / 60000))
}

export function slaBucketFor(minutes: number | null): RoleSlaBucketKey {
  if (minutes == null) return 'pending'
  if (minutes < 60) return 'under_1h'
  if (minutes < 240) return 'h1_4'
  if (minutes < 1440) return 'h4_24'
  if (minutes < 4320) return 'd1_3'
  return 'over_3d'
}

export function emptySlaBuckets(): RoleSlaBucket[] {
  return [
    { key: 'under_1h', label: '1 Saat Altı', count: 0 },
    { key: 'h1_4', label: '1-4 Saat', count: 0 },
    { key: 'h4_24', label: '4-24 Saat', count: 0 },
    { key: 'd1_3', label: '1-3 Gün', count: 0 },
    { key: 'over_3d', label: '3 Gün Üzeri', count: 0 },
    { key: 'pending', label: 'Bekleyen', count: 0 },
  ]
}

export function buildSlaBuckets(minutesList: Array<number | null>): RoleSlaBucket[] {
  const buckets = emptySlaBuckets()
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]))
  for (const value of minutesList) {
    const key = slaBucketFor(value)
    const i = index.get(key)
    if (i != null) buckets[i].count += 1
  }
  return buckets
}

export function commentsIndicatePurchasingSend(comments: string | null | undefined): boolean {
  if (!comments) return false
  const value = comments.toLocaleLowerCase('tr-TR')
  return (
    value.includes('satın almaya gönder') ||
    value.includes('satin almaya gonder') ||
    value.includes('satın almaya atandı')
  )
}

export function commentsIndicateDepartmentApproval(comments: string | null | undefined): boolean {
  if (!comments) return false
  const value = comments.toLocaleLowerCase('tr-TR')
  return value.includes('departman')
}

export function commentsIndicateWarehouseAction(comments: string | null | undefined): boolean {
  if (!comments) return false
  const value = comments.toLocaleLowerCase('tr-TR')
  return (
    value.includes('depo') ||
    value.includes('ana depoda') ||
    value.includes('stok')
  )
}

export function resolveSentToPurchasingAt(input: {
  createdAt: string | null
  purchasingAssignmentDate: string | null
  status: string | null
  history: Array<{ created_at: string | null; comments: string | null }>
}): string | null {
  if (input.purchasingAssignmentDate) return input.purchasingAssignmentDate
  const historyHit = [...input.history]
    .filter((row) => commentsIndicatePurchasingSend(row.comments) && row.created_at)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0]
  if (historyHit?.created_at) return historyHit.created_at
  if (isSentToPurchasingStatus(input.status)) return input.createdAt
  return null
}

export function personLabel(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = (fullName || '').trim()
  if (name) return titleCaseTr(name)
  const mail = (email || '').trim()
  if (mail) return mail
  return titleCaseTr('İsimsiz Kullanıcı')
}

export function roleMeta(role: UserRole) {
  const copy = getRoleMetricCopy(role)
  return {
    roleLabel: titleCaseTr(getRoleLabel(role)),
    roleDescription: titleCaseTr(getRoleDescription(role)),
    metricTitle: titleCaseTr(copy.title),
    metricHint: titleCaseTr(copy.hint),
  }
}
