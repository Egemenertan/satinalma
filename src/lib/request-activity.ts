/**
 * Talep onay / durum geçmişi (approval_history) için ortak etiket ve format yardımcıları.
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
  santiye_depo_siparis: 'Şantiye Depo (Sipariş)',
  santiye_depo_yonetici: 'Şantiye Depo Yöneticisi',
  department_head: 'Departman Yöneticisi',
}

export function getActivityRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null
  return ROLE_LABELS[role] || role
}

/** comments içinden bilinen durum ifadelerini çıkar */
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
  if (c.includes('depo kontrolü bekleniyor')) return 'Ana depo kontrolü yapılıyor'
  if (c.includes('ana depoda yok')) return 'Ana depoda yok'
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

export function mapApprovalHistoryToActivity(
  rows: RequestActivityRow[]
): RequestActivityItem[] {
  return rows
    .filter((row) => row.created_at)
    .map((row) => {
      const profile = row.profiles
      const actorName =
        profile?.full_name?.trim() ||
        profile?.email?.trim() ||
        'Bilinmeyen kullanıcı'

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

type QueryResult = { data: unknown[] | null; error: { message: string } | null }

type ActivityClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<QueryResult> & {
        order: (column: string, options: { ascending: boolean }) => PromiseLike<QueryResult>
      }
    }
  }
}

function asActivityClient(supabase: unknown): ActivityClient {
  return supabase as ActivityClient
}

function depotMissAlreadyRecorded(items: RequestActivityItem[]): boolean {
  return items.some((item) => {
    const comments = (item.comments || '').toLowerCase()
    return (
      item.actorRole === 'Depo Yöneticisi' ||
      comments.includes('warehouse manager tarafından işaretlendi') ||
      comments.includes('ana depoda yok olarak işaretlendi') ||
      comments.includes('depo yöneticisi — depoda mevcut değil') ||
      comments.includes('depo yöneticisi — ana depoda yok')
    )
  })
}

/** Geçmişe yazılamamış "ana depoda yok" işaretini gönderim kaydından ekler. */
export async function appendDepotMissActivities(
  supabase: unknown,
  requestId: string,
  history: RequestActivityItem[]
): Promise<RequestActivityItem[]> {
  if (depotMissAlreadyRecorded(history)) return history

  const client = asActivityClient(supabase)
  const shipmentResult = await client
    .from('shipments')
    .select('id, notes, shipped_quantity, shipped_at, created_at, shipped_by')
    .eq('purchase_request_id', requestId)
    .order('created_at', { ascending: true })

  if (shipmentResult.error || !shipmentResult.data?.length) return history

  const misses = (shipmentResult.data as Array<{
    id: string
    notes: string | null
    shipped_quantity: number | string | null
    shipped_at: string | null
    created_at: string | null
    shipped_by: string | null
  }>).filter((row) => Number(row.shipped_quantity) === 0)

  const first = misses[0]
  if (!first?.shipped_by) return history

  const profileResult = await client
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', first.shipped_by)

  const profile = (profileResult.data?.[0] ?? null) as {
    full_name: string | null
    email: string | null
    role: string | null
  } | null

  if (profile?.role && profile.role !== 'warehouse_manager') return history

  const createdAt = first.shipped_at || first.created_at
  if (!createdAt) return history

  const emailName = profile?.email?.split('@')[0]?.trim()
  const depotMark: RequestActivityItem = {
    id: `shipment-${first.id}`,
    action: 'approved',
    actionLabel: 'Ana depoda yok',
    actorName: profile?.full_name?.trim() || emailName || 'Depo yöneticisi',
    actorRole: 'Depo Yöneticisi',
    comments: first.notes || 'Warehouse Manager — ana depoda yok olarak işaretlendi',
    createdAt,
  }

  return [...history, depotMark].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function loadRequestActivities(
  supabase: unknown,
  requestId: string
): Promise<RequestActivityItem[]> {
  const historyResult = await asActivityClient(supabase)
    .from('approval_history')
    .select(
      `
      id,
      action,
      comments,
      created_at,
      performed_by,
      profiles:performed_by (
        full_name,
        email,
        role
      )
    `
    )
    .eq('purchase_request_id', requestId)
    .order('created_at', { ascending: true })

  if (historyResult.error) {
    throw new Error(historyResult.error.message)
  }

  const history = mapApprovalHistoryToActivity((historyResult.data || []) as RequestActivityRow[])
  return appendDepotMissActivities(asActivityClient(supabase), requestId, history)
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
