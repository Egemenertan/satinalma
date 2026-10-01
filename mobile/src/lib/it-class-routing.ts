import type { SupabaseClient } from '@supabase/supabase-js'
import { isItMaterialClass, linesIncludeItMaterialClass } from './it-workflow'

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
