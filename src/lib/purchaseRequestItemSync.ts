import type { SupabaseClient } from '@supabase/supabase-js'

export function isPersistedPurchaseRequestItemId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export type PurchaseRequestItemSyncRow = {
  id: string
  item_name: string
  quantity: number
  unit: string
  brand?: string | null
  material_class?: string | null
  material_group?: string | null
  material_item_name?: string | null
  specifications?: string | null
  purpose?: string | null
  delivery_date?: string | null
  image_urls?: string[] | null
}

function toDbPayload(material: PurchaseRequestItemSyncRow, requestId: string) {
  const qty = Math.round(material.quantity)
  return {
    purchase_request_id: requestId,
    item_name: material.item_name,
    description: `${material.brand || ''} ${material.item_name}`.trim(),
    quantity: qty,
    original_quantity: qty,
    unit: material.unit,
    unit_price: 0,
    specifications: material.specifications || null,
    purpose: material.purpose || '',
    delivery_date: material.delivery_date || null,
    brand: material.brand || null,
    material_class: material.material_class || null,
    material_group: material.material_group || null,
    material_item_name: material.material_item_name || material.item_name,
    image_urls: material.image_urls?.length ? material.image_urls : null
  }
}

/** Mevcut kalem ID'lerini korur; extra-* satırlarını insert eder. */
export async function syncPurchaseRequestItemsIncremental(
  supabase: SupabaseClient,
  requestId: string,
  materials: PurchaseRequestItemSyncRow[]
): Promise<void> {
  const { data: existingItems, error: existingError } = await supabase
    .from('purchase_request_items')
    .select('id')
    .eq('purchase_request_id', requestId)

  if (existingError) {
    throw new Error(`Mevcut kalemler okunamadı: ${existingError.message}`)
  }

  const keepIds = new Set(
    materials.filter((m) => isPersistedPurchaseRequestItemId(m.id)).map((m) => m.id)
  )
  const toDelete = (existingItems ?? [])
    .map((row) => row.id)
    .filter((id) => !keepIds.has(id))

  if (toDelete.length > 0) {
    await deletePurchaseRequestItemRows(supabase, toDelete)
  }

  for (const material of materials) {
    const payload = toDbPayload(material, requestId)
    if (isPersistedPurchaseRequestItemId(material.id)) {
      const { error: updateError } = await supabase
        .from('purchase_request_items')
        .update(payload)
        .eq('id', material.id)
      if (updateError) {
        throw new Error(`Kalem güncellenemedi (${material.item_name}): ${updateError.message}`)
      }
    } else {
      const { error: insertError } = await supabase
        .from('purchase_request_items')
        .insert(payload)
      if (insertError) {
        throw new Error(`Yeni kalem eklenemedi (${material.item_name}): ${insertError.message}`)
      }
    }
  }
}

export async function deletePurchaseRequestItemRows(
  supabase: SupabaseClient,
  itemIds: string[]
): Promise<void> {
  const ids = itemIds.filter((id) => isPersistedPurchaseRequestItemId(id))
  if (ids.length === 0) return

  const { error: shipmentError } = await supabase
    .from('shipments')
    .delete()
    .in('purchase_request_item_id', ids)

  if (shipmentError) {
    throw new Error(`Gönderim kayıtları silinemedi: ${shipmentError.message}`)
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('purchase_request_items')
    .delete()
    .in('id', ids)
    .select('id')

  if (deleteError) {
    throw new Error(`Kaldırılan kalemler silinemedi: ${deleteError.message}`)
  }

  const deletedIds = new Set((deleted ?? []).map((row) => row.id))
  const missing = ids.filter((id) => !deletedIds.has(id))
  if (missing.length > 0) {
    throw new Error('Kalem silinemedi. Sayfayı yenileyip tekrar deneyin.')
  }
}
