import type { SupabaseClient } from '@supabase/supabase-js'
import { isItMaterialClass, linesIncludeItMaterialClass } from './it-workflow'

/** Web `src/lib/it-class-routing.ts` ile aynı — yalnızca ilk gönderimde IT'ye sap. */
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

export async function requestHasItMaterialClass(
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
