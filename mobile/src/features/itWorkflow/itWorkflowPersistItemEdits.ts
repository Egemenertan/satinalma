import type { SupabaseClient } from '@supabase/supabase-js'
import type { PurchaseRequestItemRow } from '../../lib/requestOfferBundle'
import { updatePurchaseRequestItemQuantity } from './itWorkflowItemQuantity'

export type ItWorkflowItemDraft = {
  id: string
  item_name: string
  description: string
  quantity: string
  unit: string
  specifications: string
  purpose: string
  brand: string
  delivery_date: string
}

export function draftsFromItems(items: PurchaseRequestItemRow[]): Record<string, ItWorkflowItemDraft> {
  const out: Record<string, ItWorkflowItemDraft> = {}
  for (const it of items) {
    out[it.id] = {
      id: it.id,
      item_name: it.item_name ?? '',
      description: it.description ?? '',
      quantity: String(it.quantity ?? 0),
      unit: it.unit ?? '',
      specifications: it.specifications ?? '',
      purpose: it.purpose ?? '',
      brand: it.brand ?? '',
      delivery_date: it.delivery_date ? String(it.delivery_date).slice(0, 10) : '',
    }
  }
  return out
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim()
}

function normEmpty(s: string | null | undefined): string | null {
  const t = norm(s)
  return t === '' ? null : t
}

/**
 * Kalemlerde yapılan düzenlemeleri veritabanına yazar (web talep düzenle ile uyumlu alanlar).
 *
 * Metin alanları (marka dahil) her kayıtta tek UPDATE ile yazılır; yalnızca değişen alanları
 * göndermek bazı ortamlarda markanın hiç güncellenmemesine yol açıyordu.
 */
export async function persistItWorkflowItemEdits(
  supabase: SupabaseClient,
  originals: PurchaseRequestItemRow[],
  drafts: Record<string, ItWorkflowItemDraft>
): Promise<void> {
  for (const o of originals) {
    const d = drafts[o.id]
    if (!d) {
      throw new Error(
        `Kayıt senkronu bozuk (kalem ${o.id}). Sayfayı yenileyip tekrar deneyin.`
      )
    }

    const name = norm(d.item_name)
    if (!name) {
      throw new Error('Ürün adı boş olamaz')
    }

    const qty = Math.floor(Number(String(d.quantity).replace(',', '.')))
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error(`${name}: miktar en az 1 olmalı`)
    }

    const unit = norm(d.unit)
    if (!unit) {
      throw new Error(`${name}: birim zorunlu`)
    }

    const qtyChanged = qty !== o.quantity
    if (qtyChanged) {
      await updatePurchaseRequestItemQuantity(supabase, o.id, qty)
    }

    const specifications = normEmpty(d.specifications)
    const purpose = normEmpty(d.purpose)
    const brand = normEmpty(d.brand)
    const description = normEmpty(d.description)
    const deliveryRaw = norm(d.delivery_date)
    const delivery_date = deliveryRaw === '' ? null : deliveryRaw

    const syncPayload = {
      item_name: name,
      unit,
      specifications,
      purpose: purpose ?? '',
      brand,
      description,
      delivery_date,
    }

    const { error } = await supabase.from('purchase_request_items').update(syncPayload).eq('id', o.id)
    if (error) throw new Error(error.message)
  }
}
