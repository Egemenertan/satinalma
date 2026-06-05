import type { SupabaseClient } from '@supabase/supabase-js'

/** Public / render URL içinden `satinalma` bucket nesne yolunu çıkarır. */
export function extractSatinalmaStoragePath(publicUrl: string): string | null {
  const clean = publicUrl.trim().split('?')[0]
  const idx = clean.indexOf('/satinalma/')
  if (idx < 0) return null
  const path = clean.slice(idx + '/satinalma/'.length)
  return path.length > 0 ? path : null
}

/** Özel bucket’ta okuma için kısa süreli imzalı URL. Public bucket’ta da çalışır. */
export async function createSignedSatinalmaUrl(
  supabase: SupabaseClient,
  publicUrl: string,
  expiresSec = 3600
): Promise<string | null> {
  const path = extractSatinalmaStoragePath(publicUrl)
  if (!path) return null
  const { data, error } = await supabase.storage.from('satinalma').createSignedUrl(path, expiresSec)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
