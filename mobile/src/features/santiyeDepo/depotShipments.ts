import type { SupabaseClient } from '@supabase/supabase-js'
import type { PurchaseRequestItemRow, ShipmentInfo } from '../../lib/requestOfferBundle'

export async function markItemDepotNotAvailable(
  supabase: SupabaseClient,
  opts: {
    requestId: string
    item: PurchaseRequestItemRow
    shipmentData: Record<string, ShipmentInfo>
    userId: string
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { requestId, item, shipmentData, userId } = opts
  const itemShipments = shipmentData[item.id]
  if ((itemShipments?.total_shipped || 0) > 0) {
    return { ok: false, message: `${item.item_name} zaten gönderilmiş.` }
  }
  if (item.quantity <= 0) {
    return { ok: false, message: `${item.item_name} zaten işlenmiş.` }
  }

  const originalQuantity = item.original_quantity ?? item.quantity
  if (item.original_quantity != null && item.quantity !== originalQuantity) {
    const { error: rpcError } = await supabase.rpc('update_purchase_request_item_quantity', {
      item_id: item.id,
      new_quantity: originalQuantity,
    })
    if (rpcError) {
      const { error: updateError } = await supabase
        .from('purchase_request_items')
        .update({ quantity: originalQuantity })
        .eq('id', item.id)
      if (updateError) {
        return { ok: false, message: updateError.message || rpcError.message }
      }
    }
  }

  const { error: shipmentError } = await supabase.from('shipments').insert({
    purchase_request_id: requestId,
    purchase_request_item_id: item.id,
    shipped_quantity: 0,
    shipped_by: userId,
    notes: `${item.item_name} - Depoda mevcut değil (0 adet gönderildi)`,
  })
  if (shipmentError) {
    return { ok: false, message: shipmentError.message }
  }

  try {
    await supabase.rpc('update_purchase_request_status_manual', { request_id: requestId })
  } catch {
    /* web ile aynı: status RPC hatası sessiz */
  }

  return { ok: true }
}

export async function sendQuantityFromDepot(
  supabase: SupabaseClient,
  opts: {
    requestId: string
    item: PurchaseRequestItemRow
    sentQuantity: number
    userId: string
  }
): Promise<{ ok: true; newQuantity: number } | { ok: false; message: string }> {
  const { requestId, item, sentQuantity, userId } = opts
  if (sentQuantity <= 0) {
    return { ok: false, message: 'Gönderim miktarı 0’dan büyük olmalı' }
  }
  if (sentQuantity > item.quantity) {
    return { ok: false, message: `Maksimum ${item.quantity} ${item.unit} gönderebilirsiniz` }
  }

  const newQuantity = Math.max(0, item.quantity - sentQuantity)

  const { error: rpcError } = await supabase.rpc('update_purchase_request_item_quantity', {
    item_id: item.id,
    new_quantity: newQuantity,
  })
  if (rpcError) {
    const { error: updateError } = await supabase
      .from('purchase_request_items')
      .update({ quantity: newQuantity })
      .eq('id', item.id)
    if (updateError) {
      return { ok: false, message: updateError.message || rpcError.message }
    }
  }

  const { error: shipmentError } = await supabase.from('shipments').insert({
    purchase_request_id: requestId,
    purchase_request_item_id: item.id,
    shipped_quantity: sentQuantity,
    shipped_by: userId,
    notes: `${item.item_name} - ${sentQuantity} ${item.unit} gönderildi`,
  })
  if (shipmentError) {
    await supabase.rpc('update_purchase_request_item_quantity', {
      item_id: item.id,
      new_quantity: item.quantity,
    })
    return { ok: false, message: 'Gönderim kaydı oluşturulamadı' }
  }

  try {
    await supabase.rpc('update_purchase_request_status_manual', { request_id: requestId })
  } catch {
    /* sessiz */
  }

  return { ok: true, newQuantity }
}

export async function deletePurchaseRequestItem(
  supabase: SupabaseClient,
  itemId: string,
  minItemsRemain: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (minItemsRemain <= 1) {
    return { ok: false, message: 'En az bir malzeme bulunmalıdır' }
  }
  const { error } = await supabase.from('purchase_request_items').delete().eq('id', itemId)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
