import type { SupabaseClient } from '@supabase/supabase-js'

const INVOICE_PHOTO_FOLDER = 'invoice-photos'

/**
 * Siparişler sayfasındaki fatura fotoğraflarıyla aynı klasöre yükler.
 */
export async function uploadInvoicePhotos(
  supabase: SupabaseClient,
  files: File[]
): Promise<string[]> {
  const urls: string[] = []

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${INVOICE_PHOTO_FOLDER}/${crypto.randomUUID()}.${extension}`

    const { error } = await supabase.storage.from('satinalma').upload(filePath, file)
    if (error) {
      throw new Error(`Fatura fotoğrafı yüklenemedi: ${error.message}`)
    }

    const { data } = supabase.storage.from('satinalma').getPublicUrl(filePath)
    urls.push(data.publicUrl)
  }

  return urls
}

/**
 * Siparişler sayfasındaki tek fatura kaydıyla aynı tabloya yazar.
 */
export async function saveOrderInvoice(
  supabase: SupabaseClient,
  params: {
    orderId: string
    amount: number
    currency: string
    files: File[]
    notes?: string | null
  }
): Promise<void> {
  const invoicePhotos = await uploadInvoicePhotos(supabase, params.files)

  const { error } = await supabase.from('invoices').insert({
    order_id: params.orderId,
    amount: params.amount,
    currency: params.currency,
    invoice_photos: invoicePhotos,
    notes: params.notes?.trim() || null,
    invoice_group_id: null,
  })

  if (error) {
    throw new Error(`Fatura kaydedilemedi: ${error.message}`)
  }
}
