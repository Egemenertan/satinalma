import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isItMaterialClass,
  IT_STATUS_INCELEMEDE,
  linesIncludeItMaterialClass
} from '@/lib/it-workflow'

export async function purchaseRequestHasItMaterialClass(
  supabase: SupabaseClient,
  requestId: string,
  headerClass?: string | null
): Promise<boolean> {
  if (isItMaterialClass(headerClass)) return true

  const { data, error } = await supabase
    .from('purchase_request_items')
    .select('material_class')
    .eq('purchase_request_id', requestId)

  if (error) {
    throw new Error('Malzeme sınıfı kontrol edilemedi: ' + error.message)
  }

  return linesIncludeItMaterialClass(data ?? [])
}

/**
 * IT incelemesine yalnızca ilk site/depo gönderiminde sapılır.
 * Satın almaya gitmiş veya IT onayı tamamlanmış talep tekrar IT'ye dönmez.
 */
export const IT_REVIEW_DIVERT_SOURCE_STATUSES = new Set([
  'onay_bekliyor',
  'awaiting_offers',
  'kısmen gönderildi',
  'depoda mevcut değil',
  'ana depoda yok',
])

export function canDivertToItReview(currentStatus: string | null | undefined): boolean {
  if (!currentStatus) return false
  return IT_REVIEW_DIVERT_SOURCE_STATUSES.has(currentStatus.toLowerCase())
}

/**
 * Site / depo onayı satın almaya gidecekse ve talep Ofis Ekipmanları sınıfındaysa
 * IT incelemesine çevirir. Stoktan karşılanan `onaylandı` yolu değişmez.
 * `currentStatus` satın almaya gönderilmiş / IT onaylı ise tekrar sapmaz.
 */
export function routeItClassAwayFromPurchasing<
  T extends { newStatus: string; successMessage: string; historyComment: string }
>(
  draft: T,
  hasItClass: boolean,
  currentStatus?: string | null
): T & { itWorkflowApplies: boolean } {
  if (!hasItClass || draft.newStatus !== 'satın almaya gönderildi') {
    return { ...draft, itWorkflowApplies: false }
  }

  if (!canDivertToItReview(currentStatus)) {
    return { ...draft, itWorkflowApplies: false }
  }

  return {
    ...draft,
    newStatus: IT_STATUS_INCELEMEDE,
    successMessage: 'Talep IT incelemesine alındı.',
    historyComment: 'Site yöneticisi onayı sonrası IT incelemesine alındı (Ofis Ekipmanları)',
    itWorkflowApplies: true
  }
}
