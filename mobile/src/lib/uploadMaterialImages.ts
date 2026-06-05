import type { SupabaseClient } from '@supabase/supabase-js'
import { readUriForStorageUpload } from './readUriForStorageUpload'

const MAX_MB = 10

export async function uploadPurchaseMaterialImages(
  supabase: SupabaseClient,
  materialId: string,
  uris: string[]
): Promise<string[]> {
  const uploaded: string[] = []
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i]
    const { data, contentType } = await readUriForStorageUpload(uri)
    if (data.byteLength > MAX_MB * 1024 * 1024) {
      throw new Error(`Dosya çok büyük (maksimum ${MAX_MB}MB)`)
    }
    const extGuess = uri.split('.').pop()?.split('?')[0] || 'jpg'
    const safeExt = /^[a-z0-9]+$/i.test(extGuess) ? extGuess : 'jpg'
    const uniqueId = Math.random().toString(36).substring(2, 15)
    const fileName = `purchase_requests/materials/${materialId}/${Date.now()}_${uniqueId}.${safeExt}`
    const { error } = await supabase.storage.from('satinalma').upload(fileName, data, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    })
    if (error) throw new Error(error.message)
    const { data: pub } = supabase.storage.from('satinalma').getPublicUrl(fileName)
    uploaded.push(pub.publicUrl)
  }
  return uploaded
}
