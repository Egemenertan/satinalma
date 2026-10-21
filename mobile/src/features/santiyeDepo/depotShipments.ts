import type { SupabaseClient } from '@supabase/supabase-js'
import type { PurchaseRequestItemRow, ShipmentInfo } from '../../lib/requestOfferBundle'
import { isConstructionWarehouseQueueSite, isSentToPurchasingStatus, isWarehouseDepotActionAllowed } from '../../lib/warehouseQueue'

export async function markItemDepotNotAvailable(
  supabase: SupabaseClient,
  opts: {
    requestId: string
    item: PurchaseRequestItemRow
    shipmentData: Record<string, ShipmentInfo>
    userId: string
    requestStatus?: string | null
    siteId?: string | null
    siteName?: string | null
    requestedBy?: string | null
    items?: { id: string }[]
    actorRole?: string | null
  }
): Promise<{ ok: true; markedLabel: string } | { ok: false; message: string }> {
  const { requestId, item, shipmentData, userId, actorRole } = opts
  if (actorRole === 'warehouse_manager' && !isWarehouseDepotActionAllowed(opts.requestStatus)) {
    return { ok: false, message: 'Bu talep satın alma sürecinde. Depo statusü geri alınamaz.' }
  }
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

  const constructionSite = isConstructionWarehouseQueueSite(opts.siteId, opts.siteName)
  let creatorRole: string | null = null
  if (actorRole === 'warehouse_manager' && constructionSite && opts.requestedBy) {
    const { data: creator } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', opts.requestedBy)
      .maybeSingle()
    creatorRole = (creator as { role?: string } | null)?.role ?? null
  }

  const unavailableStatus =
    actorRole !== 'warehouse_manager'
      ? null
      : !constructionSite
        ? 'ana depoda yok'
        : creatorRole === 'santiye_depo_yonetici'
          ? 'satın almaya gönderildi'
          : 'depoda mevcut değil'

  const { error: shipmentError } = await supabase.from('shipments').insert({
    purchase_request_id: requestId,
    purchase_request_item_id: item.id,
    shipped_quantity: 0,
    shipped_by: userId,
    notes:
      unavailableStatus === 'ana depoda yok'
        ? `${item.item_name} - Ana depoda yok (depo yöneticisi)`
        : `${item.item_name} - Depoda mevcut değil (0 adet gönderildi)`,
  })
  if (shipmentError) {
    return { ok: false, message: shipmentError.message }
  }

  const allItems = opts.items ?? []
  let allItemsUnavailable = allItems.length > 0
  for (const reqItem of allItems) {
    if (reqItem.id === item.id) continue
    const itemShips = shipmentData[reqItem.id]
    const hasShipment = (itemShips?.shipments?.length || 0) > 0
    const hasActualShipment = (itemShips?.total_shipped || 0) > 0
    const isDepotUnavailable = itemShips?.shipments?.some((s) => {
      const q = (s as { shipped_quantity?: number }).shipped_quantity
      return q === 0
    })
    if (!hasShipment || hasActualShipment || !isDepotUnavailable) {
      allItemsUnavailable = false
      break
    }
  }

  const shouldSetStatus = Boolean(unavailableStatus) && (allItemsUnavailable || allItems.length <= 1)
  if (shouldSetStatus && unavailableStatus && opts.requestStatus !== unavailableStatus) {
    const { error: statusError } = await supabase
      .from('purchase_requests')
      .update({ status: unavailableStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId)
    if (statusError) {
      return { ok: false, message: statusError.message }
    }
    await supabase.from('approval_history').insert({
      purchase_request_id: requestId,
      action: 'updated',
      performed_by: userId,
      comments:
        unavailableStatus === 'satın almaya gönderildi'
          ? 'Depo yöneticisi — depoda mevcut değil. Şantiye depo yöneticisi talebi satın almaya gönderildi'
          : unavailableStatus === 'depoda mevcut değil'
            ? 'Depo yöneticisi — depoda mevcut değil'
            : 'Depo yöneticisi — ana depoda yok olarak işaretlendi',
    })
  } else {
    try {
      await supabase.rpc('update_purchase_request_status_manual', { request_id: requestId })
    } catch {
      /* web ile aynı: status RPC hatası sessiz */
    }
  }

  const markedLabel =
    unavailableStatus === 'satın almaya gönderildi'
      ? 'Satın almaya gönderildi'
      : unavailableStatus === 'depoda mevcut değil'
        ? 'Depoda mevcut değil'
        : unavailableStatus === 'ana depoda yok'
          ? 'Ana depoda yok'
          : 'Depoda mevcut değil'

  return { ok: true, markedLabel }
}

export async function sendQuantityFromDepot(
  supabase: SupabaseClient,
  opts: {
    requestId: string
    item: PurchaseRequestItemRow
    sentQuantity: number
    userId: string
    requestStatus?: string | null
    actorRole?: string | null
  }
): Promise<{ ok: true; newQuantity: number } | { ok: false; message: string }> {
  const { requestId, item, sentQuantity, userId } = opts
  if (opts.actorRole === 'warehouse_manager' && !isWarehouseDepotActionAllowed(opts.requestStatus)) {
    return { ok: false, message: 'Bu talep satın alma sürecinde. Depo bu aşamada gönderim yapamaz.' }
  }
  if (
    opts.actorRole &&
    opts.actorRole !== 'warehouse_manager' &&
    (isSentToPurchasingStatus(opts.requestStatus) ||
      opts.requestStatus === 'beklemede' ||
      opts.requestStatus === 'gönderildi')
  ) {
    return { ok: false, message: 'Bu talepte depo gönderimi kapalı.' }
  }
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
