/**
 * Image Upload Utility
 * Supabase Storage'a resim yükleme fonksiyonları
 */

import { createClient } from '@/lib/supabase/client'

/**
 * Fatura/Fiş resimlerini Supabase Storage'a yükle
 */
export async function uploadInvoiceImages(
  files: File[],
  movementId: string
): Promise<string[]> {
  const supabase = createClient()
  const uploadedUrls: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fileExt = file.name.split('.').pop()
    const fileName = `${movementId}_${i}_${Date.now()}.${fileExt}`
    const filePath = `invoices/${fileName}`

    // Storage'a yükle
    const { data, error } = await supabase.storage
      .from('stock-invoices')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Invoice upload error:', error)
      throw error
    }

    // Public URL al
    const {
      data: { publicUrl },
    } = supabase.storage.from('stock-invoices').getPublicUrl(filePath)

    uploadedUrls.push(publicUrl)
  }

  return uploadedUrls
}

/**
 * Fatura resmini sil
 */
export async function deleteInvoiceImage(imageUrl: string): Promise<void> {
  const supabase = createClient()

  // URL'den dosya yolunu çıkar
  const urlParts = imageUrl.split('/stock-invoices/')
  if (urlParts.length < 2) {
    throw new Error('Invalid image URL')
  }

  const filePath = urlParts[1]

  const { error } = await supabase.storage
    .from('stock-invoices')
    .remove([filePath])

  if (error) {
    console.error('Invoice delete error:', error)
    throw error
  }
}

/**
 * Dosya boyutunu kontrol et (max 5MB)
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Sadece JPG, PNG, WebP ve PDF dosyaları yüklenebilir',
    }
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Dosya boyutu 5MB\'dan büyük olamaz',
    }
  }

  return { valid: true }
}
