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

export type ItWorkflowExtraItemDraft = {
  tempId: string
  item_name: string
  material_class: string
  material_group: string
  material_item_name: string
  quantity: string
  unit: string
  purpose: string
  brand: string
  specifications: string
  delivery_date: string
  description: string
}

export function emptyExtraItemDraft(opts: {
  class: string
  group: string
  item_name: string
  purpose?: string
  delivery_date?: string
}): ItWorkflowExtraItemDraft {
  const name = opts.item_name.trim()
  return {
    tempId: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    item_name: name,
    material_class: opts.class,
    material_group: opts.group,
    material_item_name: name,
    quantity: '',
    unit: '',
    purpose: opts.purpose ?? '',
    brand: '',
    specifications: '',
    delivery_date: opts.delivery_date ?? '',
    description: '',
  }
}

export async function insertItWorkflowExtraItems(
  supabase: SupabaseClient,
  requestId: string,
  extras: ItWorkflowExtraItemDraft[]
): Promise<void> {
  if (extras.length === 0) return

  const rows = extras.map((e) => {
    const name = norm(e.item_name)
    if (!name) {
      throw new Error('Yeni kalem için ürün adı boş olamaz')
    }

    const qty = Math.floor(Number(String(e.quantity).replace(',', '.')))
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error(`${name}: miktar en az 1 olmalı`)
    }

    const unit = norm(e.unit)
    if (!unit) {
      throw new Error(`${name}: birim zorunlu`)
    }

    return {
      purchase_request_id: requestId,
      item_name: name,
      description: normEmpty(e.description) ?? `${norm(e.brand)} ${name}`.trim(),
      quantity: qty,
      original_quantity: qty,
      unit,
      unit_price: 0,
      specifications: normEmpty(e.specifications),
      purpose: norm(e.purpose),
      delivery_date: norm(e.delivery_date) === '' ? null : norm(e.delivery_date),
      brand: normEmpty(e.brand),
      material_class: normEmpty(e.material_class),
      material_group: normEmpty(e.material_group),
      material_item_name: normEmpty(e.material_item_name) ?? name,
    }
  })

  const { error } = await supabase.from('purchase_request_items').insert(rows)
  if (error) throw new Error(error.message)
}
