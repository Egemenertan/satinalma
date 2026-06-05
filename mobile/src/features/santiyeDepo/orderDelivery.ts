import type { SupabaseClient } from '@supabase/supabase-js'
import { readUriForStorageUpload } from '../../lib/readUriForStorageUpload'

/**
 * Toplu teslimde yüklenen irsaliye dosyaları `irsaliye/{purchaseRequestId}/` altına gider;
 * public URL bu segmenti içerir. Talep oluşturma sırasındaki genel görseller bundan ayrılır.
 */
export function partitionPurchaseRequestImageUrls(
  purchaseRequestId: string,
  urls: string[] | null | undefined
): { irsaliye: string[]; other: string[] } {
  const list = (Array.isArray(urls) ? urls : []).filter((u): u is string => typeof u === 'string' && u.length > 0)
  if (list.length === 0 || !purchaseRequestId) return { irsaliye: [], other: [] }
  const id = purchaseRequestId.trim()
  const idLower = id.toLowerCase()
  const isIrsaliyeUrl = (raw: string): boolean => {
    try {
      const s = decodeURIComponent(raw).toLowerCase()
      return s.includes(`/irsaliye/${idLower}/`)
    } catch {
      return raw.toLowerCase().includes(`/irsaliye/${idLower}/`)
    }
  }
  const irsaliye: string[] = []
  const other: string[] = []
  for (const u of list) {
    if (isIrsaliyeUrl(u)) irsaliye.push(u)
    else other.push(u)
  }
  return { irsaliye, other }
}

export async function uploadDeliveryPhotoUris(
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
      const path = `order_deliveries/${orderId}_${Date.now()}_${i}.${ext}`
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

/** Talep bazlı irsaliye yolu — aynı teslim turundaki siparişler bu URL’leri paylaşır. */
export async function uploadIrsaliyePhotoUris(
  supabase: SupabaseClient,
  localUris: string[],
  purchaseRequestId: string
): Promise<{ ok: true; urls: string[] } | { ok: false; message: string }> {
  const uploaded: string[] = []
  const ts = Date.now()
  for (let i = 0; i < localUris.length; i++) {
    const uri = localUris[i]
    try {
      const { data, contentType } = await readUriForStorageUpload(uri)
      const ext = uri.split('.').pop()?.split('?')[0] || 'jpg'
      const path = `irsaliye/${purchaseRequestId}/${ts}_${i}.${ext}`
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

/** İrsaliye görsellerini talep kaydına ekler (mevcut image_urls ile birleştirir, tekrarsız). */
export async function appendIrsaliyeUrlsToPurchaseRequest(
  supabase: SupabaseClient,
  purchaseRequestId: string,
  urls: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (urls.length === 0) return { ok: true }
  const { data: row, error: fetchErr } = await supabase
    .from('purchase_requests')
    .select('image_urls')
    .eq('id', purchaseRequestId)
    .maybeSingle()
  if (fetchErr) return { ok: false, message: fetchErr.message }
  const existing = (row?.image_urls as string[] | null) ?? []
  const merged = [...existing]
  for (const u of urls) {
    if (u && !merged.includes(u)) merged.push(u)
  }
  const { error: upErr } = await supabase
    .from('purchase_requests')
    .update({ image_urls: merged, updated_at: new Date().toISOString() })
    .eq('id', purchaseRequestId)
  if (upErr) return { ok: false, message: upErr.message }
  return { ok: true }
}

export async function createOrderDeliveryRpc(
  supabase: SupabaseClient,
  opts: {
    orderId: string
    deliveredQuantity: number
    userId: string
    deliveryNotes: string | null
    photoUrls: string[]
    qualityCheck: boolean
    damageNotes: string | null
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('create_order_delivery', {
    p_order_id: opts.orderId,
    p_delivered_quantity: opts.deliveredQuantity,
    p_received_by: opts.userId,
    p_delivery_notes: opts.deliveryNotes,
    p_delivery_photos: opts.photoUrls,
    p_quality_check: opts.qualityCheck,
    p_damage_notes: opts.damageNotes,
  })
  if (error) return { ok: false, message: error.message }
  const result = data as { success?: boolean; error?: string } | null
  if (result && result.success === false) {
    return { ok: false, message: result.error || 'Teslim alınamadı' }
  }
  return { ok: true }
}
