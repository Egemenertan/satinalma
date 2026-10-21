import type { SupabaseClient } from '@supabase/supabase-js'

const REJECT_STATUSES = new Set(['satın almaya gönderildi', 'eksik malzemeler talep edildi', 'reddedildi'])

export function purchasingRejectionReason(item: { purchasing_rejection_reason?: string | null } | null | undefined) {
  const reason = item?.purchasing_rejection_reason?.trim()
  return reason || null
}

export async function rejectPurchaseRequestItem(
  supabase: SupabaseClient,
  opts: {
    requestId: string
    requestStatus: string | null | undefined
    itemId: string
    itemName: string
    reason: string
    userId: string
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const reason = opts.reason.trim()
  if (!reason) return { ok: false, message: 'Reddedilme nedeni yazın.' }
  if (!REJECT_STATUSES.has(opts.requestStatus || '')) {
    return { ok: false, message: 'Bu aşamadaki talep reddedilemez.' }
  }

  const { error: itemError } = await supabase
    .from('purchase_request_items')
    .update({
      purchasing_rejection_reason: reason,
      purchasing_rejected_at: new Date().toISOString(),
      purchasing_rejected_by: opts.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.itemId)
  if (itemError) return { ok: false, message: itemError.message }

  if (opts.requestStatus !== 'reddedildi') {
    const { error: statusError } = await supabase
      .from('purchase_requests')
      .update({ status: 'reddedildi', updated_at: new Date().toISOString() })
      .eq('id', opts.requestId)
    if (statusError) return { ok: false, message: statusError.message }
  }

  await supabase.from('approval_history').insert({
    purchase_request_id: opts.requestId,
    action: 'rejected',
    performed_by: opts.userId,
    comments: `Satın alma sorumlusu malzemeyi reddetti: ${opts.itemName}. Neden: ${reason}`,
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

  const { data, error } = await supabase
    .from('purchase_requests')
    .update({ status: 'satın almaya gönderildi', updated_at: new Date().toISOString() })
    .eq('id', opts.requestId)
    .eq('requested_by', opts.userId)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: false, message: 'Talep yeniden gönderilemedi.' }

  await supabase.from('approval_history').insert({
    purchase_request_id: opts.requestId,
    action: 'updated',
    performed_by: opts.userId,
    comments: 'Talep sahibi reddedilen malzemeleri düzenleyip satın almaya yeniden gönderdi',
  })
  return { ok: true }
}

export async function updateRejectedPurchaseItem(
  supabase: SupabaseClient,
  opts: { itemId: string; itemName: string; quantity: number; purpose: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const itemName = opts.itemName.trim()
  if (!itemName) return { ok: false, message: 'Malzeme adı boş olamaz.' }
  if (!Number.isFinite(opts.quantity) || opts.quantity <= 0) {
    return { ok: false, message: 'Geçerli bir miktar girin.' }
  }
  const { error } = await supabase
    .from('purchase_request_items')
    .update({
      item_name: itemName,
      quantity: Math.round(opts.quantity),
      purpose: opts.purpose.trim() || '—',
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.itemId)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
