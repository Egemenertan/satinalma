/**
 * Satın alma talepleri — soft delete (mobil).
 * Veri DB'de kalır; listelerde `deleted_at IS NULL` ile gizlenir.
 *
 * Kural: herkes yalnızca kendi talebini kaldırabilir;
 * "satın almaya gönderildi" statusündeki talepler kaldırılamaz.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const PURCHASE_REQUEST_DELETED_STATUS = 'deleted' as const

export const SOFT_DELETE_BLOCKED_STATUS = 'satın almaya gönderildi' as const

export function canSoftDeletePurchaseRequest(opts: {
  status: string | null | undefined
  requestedBy: string | null | undefined
  currentUserId: string | null | undefined
}): boolean {
  const { status, requestedBy, currentUserId } = opts
  if (!status || !requestedBy || !currentUserId) return false
  if (status === PURCHASE_REQUEST_DELETED_STATUS) return false
  if (status === SOFT_DELETE_BLOCKED_STATUS) return false
  return requestedBy === currentUserId
}

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

  const { data, error } = await supabase
    .from('purchase_requests')
    .update({
      deleted_at: now,
      deleted_by: params.userId,
      status: PURCHASE_REQUEST_DELETED_STATUS,
      updated_at: now,
    })
    .eq('id', params.requestId)
    .eq('requested_by', params.userId)
    .neq('status', SOFT_DELETE_BLOCKED_STATUS)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return {
      ok: false,
      message:
        'Talep kaldırılamadı. Yalnızca kendi talebinizi ve "satın almaya gönderildi" dışındaki talepleri kaldırabilirsiniz.',
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
