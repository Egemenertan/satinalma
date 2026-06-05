import type { SupabaseClient } from '@supabase/supabase-js'
import { SPECIAL_GMO_SITE_ID } from './santiyeDepoRules'

type ApproveResult = { ok: true; message: string; newStatus: string } | { ok: false; message: string }

/**
 * Web SantiyeDepoView.handleSiteManagerApproval — Teams webhook mobilde yok.
 */
export async function depoManagerApproveRequest(
  supabase: SupabaseClient,
  opts: { requestId: string; currentStatus: string | null; siteId: string | null }
): Promise<ApproveResult> {
  const { requestId, currentStatus, siteId } = opts

  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    session = refreshData.session
  }
  const user = session?.user
  if (!user) return { ok: false, message: 'Oturum bulunamadı' }

  const { data: stockCheckData, error: stockCheckError } = await supabase.rpc('check_main_warehouse_stock', {
    request_id_param: requestId,
  })
  if (stockCheckError) {
    return { ok: false, message: 'Stok kontrolü yapılamadı: ' + stockCheckError.message }
  }

  const allItemsInStock =
    stockCheckData && stockCheckData.length > 0
      ? stockCheckData.every((row: { has_stock?: boolean }) => row.has_stock === true)
      : false

  const isSpecialSite = siteId === SPECIAL_GMO_SITE_ID
  const isAwaitingApproval = currentStatus === 'onay_bekliyor'

  let newStatus = 'satın almaya gönderildi'
  let message = 'Malzemeler satın almaya gönderildi!'

  if (isSpecialSite && isAwaitingApproval) {
    if (allItemsInStock) {
      newStatus = 'onaylandı'
      message = 'Talep onaylandı! Ürünler ana depoda mevcut.'
    }
  } else if (allItemsInStock) {
    newStatus = 'onaylandı'
    message = 'Talep onaylandı! Ürünler ana depoda mevcut.'
  }

  const historyComment =
    newStatus === 'onaylandı'
      ? 'Şantiye depo yöneticisi / site yöneticisi tarafından onaylandı (ana depoda stok)'
      : 'Şantiye depo yöneticisi / site yöneticisi tarafından satın almaya gönderildi'

  const { error: updateError } = await supabase
    .from('purchase_requests')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) return { ok: false, message: updateError.message }

  await supabase.from('approval_history').insert({
    purchase_request_id: requestId,
    action: 'approved',
    performed_by: user.id,
    comments: historyComment,
  })

  return { ok: true, message, newStatus }
}

export async function depoManagerRejectRequest(
  supabase: SupabaseClient,
  opts: { requestId: string; reason: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { requestId, reason } = opts
  const trimmed = reason.trim()
  if (!trimmed) return { ok: false, message: 'Red nedeni gerekli' }

  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    session = refreshData.session
  }
  const user = session?.user
  if (!user) return { ok: false, message: 'Oturum bulunamadı' }

  const { error: updateError } = await supabase
    .from('purchase_requests')
    .update({
      status: 'reddedildi',
      rejection_reason: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) return { ok: false, message: updateError.message }

  await supabase.from('approval_history').insert({
    purchase_request_id: requestId,
    action: 'rejected',
    performed_by: user.id,
    comments: `Şantiye depo / site yöneticisi reddi: ${trimmed}`,
  })

  return { ok: true }
}
