import type { SupabaseClient } from '@supabase/supabase-js'

export const PURCHASING_REJECT_STATUSES = new Set([
  'satın almaya gönderildi',
  'eksik malzemeler talep edildi',
  'reddedildi',
])

export type PurchasingRejectableItem = {
  id: string
  item_name?: string | null
  purchasing_rejection_reason?: string | null
}

export function purchasingRejectionReason(
  item: { purchasing_rejection_reason?: string | null } | null | undefined
): string | null {
  const reason = item?.purchasing_rejection_reason?.trim()
  return reason || null
}

export function rejectedPurchasingItems<T extends PurchasingRejectableItem>(items: T[] | null | undefined): T[] {
  return (items ?? []).filter((item) => purchasingRejectionReason(item))
}

export async function rejectPurchaseRequestItem(
  supabase: SupabaseClient,
  opts: {
    requestId: string
    requestStatus: string | null | undefined
    item: PurchasingRejectableItem
    reason: string
    userId: string
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const reason = opts.reason.trim()
  if (!reason) return { ok: false, message: 'Reddedilme nedeni yazın.' }
  if (!PURCHASING_REJECT_STATUSES.has(opts.requestStatus || '')) {
    return { ok: false, message: 'Bu aşamadaki talep reddedilemez.' }
  }
  if (purchasingRejectionReason(opts.item)) {
    return { ok: false, message: 'Bu malzeme zaten reddedilmiş.' }
  }

  const { error: itemError } = await supabase
    .from('purchase_request_items')
    .update({
      purchasing_rejection_reason: reason,
      purchasing_rejected_at: new Date().toISOString(),
      purchasing_rejected_by: opts.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.item.id)

  if (itemError) return { ok: false, message: itemError.message }

  if (opts.requestStatus !== 'reddedildi') {
    const { error: statusError } = await supabase
      .from('purchase_requests')
      .update({
        status: 'reddedildi',
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.requestId)
    if (statusError) return { ok: false, message: statusError.message }
  }

  await supabase.from('approval_history').insert({
    purchase_request_id: opts.requestId,
    action: 'rejected',
    performed_by: opts.userId,
    comments: `Satın alma sorumlusu malzemeyi reddetti: ${opts.item.item_name || 'Malzeme'}. Neden: ${reason}`,
  })

  return { ok: true }
}

export async function resendRejectedPurchaseRequest(
  supabase: SupabaseClient,
  opts: { requestId: string; userId: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: clearError } = await supabase
    .from('purchase_request_items')
    .update({
      purchasing_rejection_reason: null,
      purchasing_rejected_at: null,
      purchasing_rejected_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('purchase_request_id', opts.requestId)
    .not('purchasing_rejection_reason', 'is', null)

  if (clearError) return { ok: false, message: clearError.message }

  const { data: updated, error: statusError } = await supabase
    .from('purchase_requests')
    .update({
      status: 'satın almaya gönderildi',
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.requestId)
    .eq('requested_by', opts.userId)
    .select('id')
    .maybeSingle()

  if (statusError) return { ok: false, message: statusError.message }
  if (!updated) return { ok: false, message: 'Talep yeniden gönderilemedi.' }

  await supabase.from('approval_history').insert({
    purchase_request_id: opts.requestId,
    action: 'updated',
    performed_by: opts.userId,
    comments: 'Talep sahibi reddedilen malzemeleri düzenleyip satın almaya yeniden gönderdi',
  })

  return { ok: true }
}
