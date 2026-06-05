import type { SupabaseClient } from '@supabase/supabase-js'
import type { BundleOrderRow, PurchaseRequestItemRow } from '../../lib/requestOfferBundle'
import { readUriForStorageUpload } from '../../lib/readUriForStorageUpload'

export async function uploadReturnPhotoUris(
  supabase: SupabaseClient,
  localUris: string[],
  orderId: string
): Promise<{ ok: true; urls: string[] } | { ok: false; message: string }> {
  const uploaded: string[] = []
  for (let i = 0; i < localUris.length; i++) {
    const uri = localUris[i]
    try {
      const { data, contentType } = await readUriForStorageUpload(uri)
      const ext = uri.split('.').pop()?.split('?')[0] || 'jpg'
      const path = `return_photos/${orderId}_${Date.now()}_${i}.${ext}`
      const { error } = await supabase.storage.from('satinalma').upload(path, data, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })
      if (error) return { ok: false, message: error.message }
      const { data: pub } = supabase.storage.from('satinalma').getPublicUrl(path)
      uploaded.push(pub.publicUrl)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Yükleme hatası'
      return { ok: false, message: msg }
    }
  }
  return { ok: true, urls: uploaded }
}

async function createAutoReorderRequest(
  supabase: SupabaseClient,
  opts: {
    returnQty: number
    originalRequestId: string
    originalOrderId: string
    materialItem: PurchaseRequestItemRow
    userId: string
    userRole: string
  }
): Promise<string | null> {
  const { returnQty, originalRequestId, originalOrderId, materialItem, userId, userRole } = opts

  const { data: originalRequest, error: requestError } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('id', originalRequestId)
    .single()
  if (requestError || !originalRequest) return null

  const now = new Date()
  const requestNumber = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const { data: newRequest, error: newRequestError } = await supabase
    .from('purchase_requests')
    .insert({
      request_number: requestNumber,
      title: `İade Nedeniyle Yeniden Sipariş - ${materialItem.item_name}`,
      description: `${materialItem.item_name} — iade nedeniyle otomatik talep. Orijinal: #${originalRequestId.slice(-8)}`,
      department: (originalRequest as { department?: string }).department || 'Satın Alma',
      total_amount: 0,
      currency: (originalRequest as { currency?: string }).currency || 'TRY',
      urgency_level: (originalRequest as { urgency_level?: string }).urgency_level || 'normal',
      site_id: (originalRequest as { site_id?: string }).site_id,
      site_name: (originalRequest as { site_name?: string | null }).site_name,
      requested_by: userId,
      status: 'iade nedeniyle sipariş',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      original_request_id: originalRequestId,
      return_order_id: originalOrderId,
    } as Record<string, unknown>)
    .select()
    .single()

  if (newRequestError || !newRequest) return null

  const newItemData = {
    purchase_request_id: (newRequest as { id: string }).id,
    item_name: materialItem.item_name,
    description:
      materialItem.description || `İade nedeniyle yeniden sipariş - ${materialItem.item_name}`,
    quantity: Math.floor(returnQty),
    unit: materialItem.unit,
    unit_price: 0,
    brand: materialItem.brand || null,
    specifications: materialItem.specifications || null,
    purpose: materialItem.purpose || null,
    delivery_date: materialItem.delivery_date || null,
    image_urls: materialItem.image_urls || null,
    original_quantity: Math.floor(returnQty),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: newItem, error: newItemError } = await supabase
    .from('purchase_request_items')
    .insert(newItemData)
    .select()
    .single()

  if (newItemError || !newItem) {
    await supabase.from('purchase_requests').delete().eq('id', (newRequest as { id: string }).id)
    return null
  }

  await supabase.from('audit_log').insert({
    purchase_request_id: (newRequest as { id: string }).id,
    action_type: 'auto_reorder_created',
    performed_by: userId,
    user_role: userRole,
    description: `İade nedeniyle otomatik talep. Orijinal: #${originalRequestId.slice(-8)}, iade: ${returnQty} ${materialItem.unit}`,
    comments: `Orijinal sipariş: ${originalOrderId}`,
    metadata: {
      original_request_id: originalRequestId,
      return_order_id: originalOrderId,
      returned_quantity: returnQty,
      material_name: materialItem.item_name,
      auto_created: true,
    },
  })

  return (newRequest as { id: string }).id
}

export async function processOrderReturn(
  supabase: SupabaseClient,
  opts: {
    order: BundleOrderRow & {
      purchase_request_id?: string
      status?: string | null
    }
    materialItem: PurchaseRequestItemRow
    returnQty: number
    returnNotes: string
    reorderRequested: boolean
    photoUrls: string[]
    userRole: string
  }
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const { order, materialItem, returnQty, returnNotes, reorderRequested, photoUrls, userRole } = opts
  if (!returnNotes.trim()) return { ok: false, message: 'İade nedeni zorunludur' }

  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes.user
  if (!user) return { ok: false, message: 'Oturum bulunamadı' }

  let purchaseRequestId = order.purchase_request_id
  if (!purchaseRequestId && order.material_item_id) {
    const { data: row } = await supabase
      .from('purchase_request_items')
      .select('purchase_request_id')
      .eq('id', order.material_item_id)
      .single()
    purchaseRequestId = (row as { purchase_request_id?: string } | null)?.purchase_request_id
  }

  const currentReturned = order.returned_quantity || 0
  const orderQuantity = order.quantity || 0
  const totalDelivered = order.delivered_quantity || 0
  const remainingQuantity = orderQuantity - totalDelivered - currentReturned
  const maxReturnable = Math.max(0, remainingQuantity)
  if (returnQty > maxReturnable || returnQty <= 0) {
    return {
      ok: false,
      message: `İade miktarı geçersiz (en fazla ${maxReturnable.toFixed(2)} ${materialItem.unit})`,
    }
  }

  const newReturned = currentReturned + returnQty
  const isFullyReturned = newReturned >= orderQuantity
  const updateData: Record<string, unknown> = {
    returned_quantity: newReturned,
    reorder_requested: reorderRequested,
    updated_at: new Date().toISOString(),
  }
  if (isFullyReturned && order.status !== 'iade edildi') {
    updateData.status = 'iade edildi'
  }

  const { error: updateError } = await supabase.from('orders').update(updateData).eq('id', order.id)
  if (updateError) return { ok: false, message: updateError.message }

  if (returnNotes.trim()) {
    await supabase.from('orders').update({ return_notes: returnNotes.trim() }).eq('id', order.id)
  }

  /* Web ReturnModal: tam iade sonrası status’un gerçekten güncellenmesini doğrula */
  if (isFullyReturned) {
    const { data: updatedCheck } = await supabase
      .from('orders')
      .select('id, status, returned_quantity, quantity')
      .eq('id', order.id)
      .maybeSingle()
    const row = updatedCheck as { status?: string | null } | null
    if (row && row.status !== 'iade edildi') {
      await supabase
        .from('orders')
        .update({ status: 'iade edildi', updated_at: new Date().toISOString() })
        .eq('id', order.id)
    }
  }

  let autoReorderCreated = false
  if (reorderRequested && purchaseRequestId) {
    const nid = await createAutoReorderRequest(supabase, {
      returnQty,
      originalRequestId: purchaseRequestId,
      originalOrderId: order.id,
      materialItem,
      userId: user.id,
      userRole,
    })
    autoReorderCreated = Boolean(nid)
  }

  if (purchaseRequestId) {
    await supabase.from('audit_log').insert({
      purchase_request_id: purchaseRequestId,
      action_type: 'material_returned',
      performed_by: user.id,
      user_role: userRole,
      description: `${materialItem.item_name} malzemesi için ${returnQty} ${materialItem.unit} iade edildi${
        photoUrls.length > 0 ? ` (${photoUrls.length} fotoğraf)` : ''
      }. Yeniden sipariş: ${
        reorderRequested
          ? `İsteniyor${autoReorderCreated ? ' (otomatik talep oluşturuldu)' : ''}`
          : 'İstenmiyor'
      }`,
      comments: returnNotes.trim() || null,
      metadata: {
        order_id: order.id,
        material_item_id: order.material_item_id,
        returned_quantity: returnQty,
        total_returned_quantity: newReturned,
        supplier_name: order.supplier?.name ?? null,
        return_photos: photoUrls.length > 0 ? photoUrls : null,
        reorder_requested: reorderRequested,
        auto_reorder_created: autoReorderCreated,
      },
    })
  }

  let message = `${returnQty} ${materialItem.unit} başarıyla iade edildi`
  if (isFullyReturned) {
    message = `Sipariş tamamen iade edildi! (${returnQty} ${materialItem.unit})`
  }
  if (reorderRequested) {
    if (autoReorderCreated) {
      message += ' Otomatik yeniden sipariş talebi oluşturuldu.'
    } else {
      message += ' Otomatik talep oluşturulamadı, manuel olarak oluşturmanız gerekebilir.'
    }
  }

  return { ok: true, message }
}
