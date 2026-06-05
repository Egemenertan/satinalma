import type { SupabaseClient } from '@supabase/supabase-js'

/** Şantiye depo / IT gönder ile aynı: önce RPC, olmazsa doğrudan güncelleme */
export async function updatePurchaseRequestItemQuantity(
  supabase: SupabaseClient,
  itemId: string,
  newQuantity: number
): Promise<void> {
  const { error: rpcError } = await supabase.rpc('update_purchase_request_item_quantity', {
    item_id: itemId,
    new_quantity: newQuantity,
  })
  if (!rpcError) return

  const { error: updateError } = await supabase
    .from('purchase_request_items')
    .update({ quantity: newQuantity })
    .eq('id', itemId)

  if (updateError) {
    throw new Error(updateError.message || rpcError.message)
  }
}
