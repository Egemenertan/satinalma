import 'server-only'
import { linasoftPost, LinasoftNotConfiguredError } from './client'
import type { LinasoftSiteMapping } from './site-mapping'

export interface PurchaseInvoiceTotal {
  total: number
  currency: string
  invoiceCount: number
}

/**
 * TODO: Alış faturası endpoint'i Swagger'dan netleşince doldurulacak.
 * Mevcut API kılavuzu yalnızca Taksitli Satış Sözleşme endpoint'lerini içerir;
 * alış faturası endpoint'i yoktur. Yol, istek gövdesi ve yanıt alanları
 * (toplam tutar, para birimi, proje/şube alanı) Linasoft'tan teyit edilmelidir.
 */
export async function fetchPurchaseInvoiceTotal(mapping: LinasoftSiteMapping): Promise<PurchaseInvoiceTotal> {
  const path = process.env.LINASOFT_PURCHASE_INVOICE_PATH
  if (!path) throw new LinasoftNotConfiguredError('LINASOFT_PURCHASE_INVOICE_PATH tanımlı değil')

  const rows = await linasoftPost<unknown>(path, { FirmaID: mapping.firmaId, SubeID: mapping.subeId })
  void rows
  throw new Error('Alış faturası yanıt eşlemesi henüz yazılmadı (Swagger bekleniyor)')
}
