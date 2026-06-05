import type { SupabaseClient } from '@supabase/supabase-js'
import { IT_STATUS_ONAYLANDI } from '../../lib/it-workflow'

/** Web `SiteManagerView` ile aynı — Genel Merkez Ofisi şantiye kaydı */
export const SITE_MANAGER_SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'

export type SiteManagerApproveResult = {
  newStatus: string
  message: string
}

/**
 * Ana depo stok RPC + durum güncelleme + approval_history.
 * Web: `src/components/offers/SiteManagerView.tsx` `handleSiteManagerApproval`
 */
export async function siteManagerApproveOrSendToPurchasing(
  supabase: SupabaseClient,
  requestId: string,
  currentStatus: string | null,
  siteId: string | null
): Promise<SiteManagerApproveResult> {
  let { data: { session } } = await supabase.auth.getSession()
  
  // Session yoksa veya expire olduysa refresh deneyelim
  if (!session?.user) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    session = refreshData.session
  }
  
  const user = session?.user
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
  }

  /** IT `it_onaylandi` sonrası her zaman satın almaya ilet (stokta olsa bile `onaylandı` olmasın). */
  if (currentStatus === IT_STATUS_ONAYLANDI) {
    const newStatus = 'satın almaya gönderildi'
    const successMessage = 'Malzemeler satın almaya gönderildi!'
    const historyComment = 'Pazarlama site manager — IT onayı sonrası satın almaya gönderildi'

    const { error: updateError } = await supabase
      .from('purchase_requests')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const { error: historyError } = await supabase.from('approval_history').insert({
      purchase_request_id: requestId,
      action: 'approved',
      performed_by: user.id,
      comments: historyComment,
    })

    if (historyError) {
      console.warn('approval_history:', historyError.message)
    }

    return { newStatus, message: successMessage }
  }

  const { data: stockCheckData, error: stockCheckError } = await supabase.rpc('check_main_warehouse_stock', {
    request_id_param: requestId,
  })

  if (stockCheckError) {
    throw new Error('Stok kontrolü yapılamadı: ' + stockCheckError.message)
  }

  const allItemsInStock =
    stockCheckData && Array.isArray(stockCheckData) && stockCheckData.length > 0
      ? stockCheckData.every((item: { has_stock?: boolean }) => item.has_stock === true)
      : false

  const isSpecialSite = siteId === SITE_MANAGER_SPECIAL_SITE_ID
  const isAwaitingApproval = currentStatus === 'onay_bekliyor' || currentStatus === 'awaiting_offers'

  let newStatus = 'satın almaya gönderildi'
  let successMessage = 'Malzemeler satın almaya gönderildi!'
  let historyComment = 'Site Manager tarafından satın almaya gönderildi'

  if (isSpecialSite && isAwaitingApproval) {
    if (allItemsInStock) {
      newStatus = 'onaylandı'
      successMessage = 'Talep onaylandı! Ürünler ana depoda mevcut.'
      historyComment = 'Site Manager tarafından onaylandı (Ana depoda stok mevcut)'
    } else {
      newStatus = 'satın almaya gönderildi'
      successMessage = 'Malzemeler satın almaya gönderildi! (Ana depoda stok yok)'
      historyComment =
        'Site Manager tarafından satın almaya gönderildi (Genel Merkez Ofisi - Ana depoda stok yok)'
    }
  } else {
    if (allItemsInStock) {
      newStatus = 'onaylandı'
      successMessage = 'Talep onaylandı! Ürünler ana depoda mevcut.'
      historyComment = 'Site Manager tarafından onaylandı (Ana depoda stok mevcut)'
    } else {
      newStatus = 'satın almaya gönderildi'
      successMessage = 'Malzemeler satın almaya gönderildi! (Ana depoda stok yok)'
      historyComment = 'Site Manager tarafından satın almaya gönderildi (Ana depoda stok yok)'
    }
  }

  const { error: updateError } = await supabase
    .from('purchase_requests')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { error: historyError } = await supabase.from('approval_history').insert({
    purchase_request_id: requestId,
    action: 'approved',
    performed_by: user.id,
    comments: historyComment,
  })

  if (historyError) {
    console.warn('approval_history:', historyError.message)
  }

  return { newStatus, message: successMessage }
}

export async function siteManagerRejectRequest(
  supabase: SupabaseClient,
  requestId: string,
  reason: string
): Promise<void> {
  const trimmed = reason.trim()
  if (!trimmed) {
    throw new Error('Lütfen reddedilme nedenini belirtin.')
  }

  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    const { data: refreshData } = await supabase.auth.refreshSession()
    session = refreshData.session
  }
  const user = session?.user
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı.')
  }

  const { error: updateError } = await supabase
    .from('purchase_requests')
    .update({
      status: 'reddedildi',
      rejection_reason: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { error: historyError } = await supabase.from('approval_history').insert({
    purchase_request_id: requestId,
    action: 'rejected',
    performed_by: user.id,
    comments: `Site Manager tarafından reddedildi: ${trimmed}`,
  })

  if (historyError) {
    console.warn('approval_history:', historyError.message)
  }
}
