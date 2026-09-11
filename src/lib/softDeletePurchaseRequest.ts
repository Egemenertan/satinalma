/**
 * Satın alma talepleri — soft delete.
 * Veri DB'de kalır; listelerde `deleted_at IS NULL` ile gizlenir.
 *
 * Kural:
 * - purchasing_officer: gördüğü herhangi bir talebi gizleyebilir (başkasının talebi
 *   ve "satın almaya gönderildi" dahil).
 * - diğer roller: yalnızca kendi talebini kaldırabilir;
 *   "satın almaya gönderildi" statusündeki talepler kaldırılamaz.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const PURCHASE_REQUEST_DELETED_STATUS = 'deleted' as const

/** Bu status'teki talepler, talep sahibi tarafından listeden kaldırılamaz */
export const SOFT_DELETE_BLOCKED_STATUS = 'satın almaya gönderildi' as const

const PURCHASING_OFFICER_ROLE = 'purchasing_officer'

function isPurchasingOfficerRole(role: string | null | undefined): boolean {
  return role === PURCHASING_OFFICER_ROLE
}

export function canSoftDeletePurchaseRequest(opts: {
  status: string | null | undefined
  requestedBy: string | null | undefined
  currentUserId: string | null | undefined
  userRole?: string | null
}): boolean {
  const { status, requestedBy, currentUserId, userRole } = opts
  if (!status || !currentUserId) return false
  if (status === PURCHASE_REQUEST_DELETED_STATUS) return false
  if (isPurchasingOfficerRole(userRole)) return true
  if (!requestedBy) return false
  if (status === SOFT_DELETE_BLOCKED_STATUS) return false
  return requestedBy === currentUserId
}

/** Aktif (gizlenmemiş) talepler — tüm liste/stats sorgularına eklenmeli */
export function excludeSoftDeletedRequests(query: any): any {
  return query.is('deleted_at', null)
}

export async function softDeletePurchaseRequest(
  supabase: any,
  params: {
    requestId: string
    userId: string
    reason?: string
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', params.userId)
    .maybeSingle()

  if (profileError) {
    return { ok: false, message: profileError.message }
  }

  const canHideAnyVisibleRequest = isPurchasingOfficerRole(profile?.role)

  let query = supabase
    .from('purchase_requests')
    .update({
      deleted_at: now,
      deleted_by: params.userId,
      status: PURCHASE_REQUEST_DELETED_STATUS,
      updated_at: now,
    })
    .eq('id', params.requestId)
    .is('deleted_at', null)
    .neq('status', PURCHASE_REQUEST_DELETED_STATUS)

  // Satın alma sorumlusu dışındaki roller: yalnızca kendi talebi + satın almaya gönderildi değil
  if (!canHideAnyVisibleRequest) {
    query = query
      .eq('requested_by', params.userId)
      .neq('status', SOFT_DELETE_BLOCKED_STATUS)
  }

  const { data, error } = await query.select('id').maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return {
      ok: false,
      message: canHideAnyVisibleRequest
        ? 'Talep kaldırılamadı. Talep bulunamadı veya zaten gizlenmiş olabilir.'
        : 'Talep kaldırılamadı. Yalnızca kendi talebinizi ve "satın almaya gönderildi" dışındaki talepleri kaldırabilirsiniz.',
    }
  }

  const { error: historyError } = await supabase.from('approval_history').insert({
    purchase_request_id: params.requestId,
    action: 'deleted',
    performed_by: params.userId,
    comments: params.reason ?? 'Talep listeden kaldırıldı (gizlendi, veri silinmedi)',
  })

  if (historyError) {
    console.warn('approval_history soft-delete kaydı:', historyError.message)
  }

  return { ok: true }
}
