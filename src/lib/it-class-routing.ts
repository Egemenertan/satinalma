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
 * Site / depo onayı satın almaya gidecekse ve talep Ofis Ekipmanları sınıfındaysa
 * IT incelemesine çevirir. Stoktan karşılanan `onaylandı` yolu değişmez.
 */
export function routeItClassAwayFromPurchasing<
  T extends { newStatus: string; successMessage: string; historyComment: string }
>(draft: T, hasItClass: boolean): T & { itWorkflowApplies: boolean } {
  if (!hasItClass || draft.newStatus !== 'satın almaya gönderildi') {
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
