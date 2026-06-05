import type { SupabaseClient } from '@supabase/supabase-js'
import type { PurchaseRequestItemRow } from '../../lib/requestOfferBundle'
import { updatePurchaseRequestItemQuantity } from './itWorkflowItemQuantity'

/**
 * Web `ItWorkflowView.confirmSendGonderildi` ile aynı mantık:
 * gönderim miktarları → shipment + kalem miktarı düşümü → talep `gönderildi`.
 */
export async function itWorkflowConfirmSendGonderildi(
  supabase: SupabaseClient,
  params: {
    requestId: string
    items: PurchaseRequestItemRow[]
    sendQuantities: Record<string, string>
  }
): Promise<{ summary: string }> {
  const { requestId, items, sendQuantities } = params

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Oturum bulunamadı')

  const toShip: { item: PurchaseRequestItemRow; qty: number }[] = []

  for (const item of items) {
    const raw = sendQuantities[item.id] ?? '0'
    const qty = Math.floor(Number(String(raw).replace(',', '.')))
    if (Number.isNaN(qty) || qty < 0) {
      throw new Error('Geçersiz adet girişi')
    }
    if (qty > item.quantity) {
      throw new Error(`${item.item_name} için en fazla ${item.quantity} ${item.unit} girebilirsiniz`)
    }
    if (item.quantity <= 0 && qty > 0) {
      throw new Error(`${item.item_name} için kalan miktar yok`)
    }
    if (qty > 0) toShip.push({ item, qty })
  }

  if (toShip.length === 0) {
    throw new Error('En az bir kalem için gönderim adedi girin')
  }

  const summaryParts: string[] = []

  for (const { item, qty } of toShip) {
    const newQuantity = Math.max(0, item.quantity - qty)

    try {
      await updatePurchaseRequestItemQuantity(supabase, item.id, newQuantity)
    } catch (e) {
      throw new Error(
        e instanceof Error
          ? `Miktar güncellenemedi (${item.item_name}): ${e.message}`
          : 'Miktar güncellenemedi'
      )
    }

    const { error: shipmentError } = await supabase.from('shipments').insert({
      purchase_request_id: requestId,
      purchase_request_item_id: item.id,
      shipped_quantity: qty,
      shipped_by: user.id,
      notes: `${item.item_name} - ${qty} ${item.unit} gönderildi (IT Yönetim)`,
    })

    if (shipmentError) {
      try {
        await updatePurchaseRequestItemQuantity(supabase, item.id, item.quantity)
      } catch {
        await supabase.from('purchase_request_items').update({ quantity: item.quantity }).eq('id', item.id)
      }
      throw new Error(shipmentError.message || 'Gönderim kaydı oluşturulamadı')
    }

    summaryParts.push(`${item.item_name}: ${qty} ${item.unit}`)
  }

  const { error: updateError } = await supabase
    .from('purchase_requests')
    .update({
      status: 'gönderildi',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) throw new Error(updateError.message)

  const summary = summaryParts.join('; ')
  await supabase.from('approval_history').insert({
    purchase_request_id: requestId,
    action: 'approved',
    performed_by: user.id,
    comments: `IT Yönetim gönderildi: ${summary}`,
  })

  return { summary }
}
