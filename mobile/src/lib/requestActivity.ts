/**
 * Talep onay / durum geçmişi — mobil (web `src/lib/request-activity.ts` ile aynı mantık).
 */

export type RequestActivityRow = {
  id: string
  action: string
  comments: string | null
  created_at: string | null
  performed_by: string
  profiles?: {
    full_name: string | null
    email: string | null
    role: string | null
  } | null
}

export type RequestActivityItem = {
  id: string
  action: string
  actionLabel: string
  actorName: string
  actorRole: string | null
  comments: string | null
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  super_admin: 'Süper Admin',
  manager: 'Yönetici',
  user: 'Kullanıcı',
  site_personnel: 'Şantiye Personeli',
  site_manager: 'Şantiye Yöneticisi',
  warehouse_manager: 'Depo Yöneticisi',
  purchasing_officer: 'Satın Alma Sorumlusu',
  santiye_depo: 'Şantiye Depo',
  santiye_depo_yonetici: 'Şantiye Depo Yöneticisi',
  department_head: 'Departman Yöneticisi',
}

export function getActivityRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null
  return ROLE_LABELS[role] || role
}

function inferStatusLabelFromComments(comments: string | null): string | null {
  if (!comments) return null
  const c = comments.toLowerCase()

  if (c.includes('reddedildi') || c.includes('reddetti')) return 'Reddedildi'
  if (c.includes('satın almaya gönderildi') || c.includes('satin almaya gonderildi')) {
    return 'Satın almaya gönderildi'
  }
  if (c.includes('it yönetim onayı') || c.includes('it onay')) return 'IT onayı'
  if (c.includes('departman yöneticisi tarafından onaylandı')) return 'Departman onayı'
  if (c.includes('ana depoda stok mevcut') || c.includes('status: onaylandı')) return 'Onaylandı'
  if (c.includes('depoda mevcut değil')) return 'Depoda mevcut değil'
  if (c.includes('it yönetim incelemesinde') || c.includes('it_incelemesinde')) {
    return 'IT incelemesine alındı'
  }

  return null
}

export function getActivityActionLabel(action: string, comments: string | null): string {
  const inferred = inferStatusLabelFromComments(comments)

  switch (action) {
    case 'submitted':
      return inferred ? `Talep oluşturuldu → ${inferred}` : 'Talep oluşturuldu'
    case 'approved':
      return inferred || 'Onaylandı'
    case 'rejected':
      return 'Reddedildi'
    case 'updated':
      return 'Talep güncellendi'
    case 'deleted':
      return 'Talep kaldırıldı (gizlendi)'
    default:
      return inferred || action
  }
}

export function mapApprovalHistoryToActivity(rows: RequestActivityRow[]): RequestActivityItem[] {
  return rows
    .filter((row) => row.created_at)
    .map((row) => {
      const profile = row.profiles
      const actorName =
        profile?.full_name?.trim() || profile?.email?.trim() || 'Bilinmeyen kullanıcı'

      return {
        id: row.id,
        action: row.action,
        actionLabel: getActivityActionLabel(row.action, row.comments),
        actorName,
        actorRole: getActivityRoleLabel(profile?.role),
        comments: row.comments,
        createdAt: row.created_at as string,
      }
    })
}

export function formatActivityDateTime(iso: string, locale = 'tr-TR'): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
