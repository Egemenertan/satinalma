/**
 * Invoices Service
 * Fatura CRUD işlemleri için servis katmanı
 */

import { createClient } from '@/lib/supabase/client'
import type { InvoiceData, InvoiceGroupData } from '@/app/dashboard/orders/types'

export interface CreateInvoiceParams {
  orderIds: string[]
  amounts: Record<string, number>
  currencies: Record<string, string>
  photos: string[]
  notes?: string
  // Toplu fatura özet bilgileri
  subtotal?: number
  discount?: number
  tax?: number
  grandTotal?: number
  grandTotalCurrency?: string
}

export interface UpdateInvoiceParams {
  invoiceId: string
  amount: number
  currency: string
  photos: string[]
}

/**
 * Fatura oluştur (tek veya toplu) - YENİ YAPI: invoice_groups kullanarak
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<void> {
  const supabase = createClient()
  const { orderIds, amounts, currencies, photos, notes, subtotal, discount, tax, grandTotal, grandTotalCurrency } = params

  // Tek sipariş için basit fatura
  if (orderIds.length === 1) {
    const { error } = await supabase
      .from('invoices')
      .insert({
        order_id: orderIds[0],
        amount: amounts[orderIds[0]],
        currency: currencies[orderIds[0]] || 'TRY',
        invoice_photos: photos,
        notes: notes || null,
        invoice_group_id: null,
      })

    if (error) {
      console.error('❌ Fatura kaydetme hatası:', error)
      throw new Error('Fatura kaydedilemedi: ' + error.message)
    }

    console.log('✅ Fatura başarıyla kaydedildi')
    return
  }

  // Toplu fatura için invoice_group oluştur
  const { data: { user } } = await supabase.auth.getUser()
  
  const invoiceGroupData: any = {
    created_by: user?.id || null,
    group_name: `Toplu Fatura - ${new Date().toLocaleDateString('tr-TR')}`,
    notes: notes || null,
    subtotal: subtotal || 0,
    discount: discount || null,
    tax: tax || null,
    grand_total: grandTotal || subtotal || 0,
    currency: grandTotalCurrency || currencies[orderIds[0]] || 'TRY',
    invoice_photos: photos,
  }

  // Invoice group kaydını oluştur
  const { data: invoiceGroup, error: groupError } = await supabase
    .from('invoice_groups')
    .insert(invoiceGroupData)
    .select()
    .single()

  if (groupError) {
    console.error('❌ Invoice group kaydetme hatası:', groupError)
    throw new Error('Invoice group kaydedilemedi: ' + groupError.message)
  }

  console.log('✅ Invoice group başarıyla kaydedildi:', invoiceGroup.id)

  // Tüm siparişler için invoice kayıtları oluştur
  const invoices = orderIds.map(orderId => ({
    order_id: orderId,
    amount: amounts[orderId],
    currency: currencies[orderId] || 'TRY',
    invoice_photos: photos,
    invoice_group_id: invoiceGroup.id,
    // Geriye uyumluluk için (deprecated)
    is_master: false,
    parent_invoice_id: null,
  }))

  const { error: invoicesError } = await supabase
    .from('invoices')
    .insert(invoices)

  if (invoicesError) {
    console.error('❌ Faturalar kaydetme hatası:', invoicesError)
    // Invoice group'u geri al
    await supabase.from('invoice_groups').delete().eq('id', invoiceGroup.id)
    throw new Error('Faturalar kaydedilemedi: ' + invoicesError.message)
  }

  console.log(`✅ ${orderIds.length} fatura başarıyla kaydedildi`)
}

/**
 * Fatura güncelle
 */
export async function updateInvoice(params: UpdateInvoiceParams): Promise<void> {
  const supabase = createClient()
  const { invoiceId, amount, currency, photos } = params

  const { error } = await supabase
    .from('invoices')
    .update({
      amount,
      currency,
      invoice_photos: photos,
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('❌ Fatura güncelleme hatası:', error)
    throw new Error('Fatura güncellenemedi: ' + error.message)
  }

  console.log('✅ Fatura başarıyla güncellendi')
}

/**
 * Fatura sil
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = createClient()

  console.log('🗑️ Fatura siliniyor:', invoiceId)

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)

  if (error) {
    console.error('❌ Fatura silme hatası:', error)
    throw new Error('Fatura silinemedi: ' + error.message)
  }

  console.log('✅ Fatura başarıyla silindi')
}

/**
 * Invoice group bilgilerini çek (toplu fatura detayları için)
 */
export async function fetchInvoiceGroup(invoiceGroupId: string): Promise<InvoiceGroupData | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('invoice_groups_with_orders')
    .select('*')
    .eq('id', invoiceGroupId)
    .single()

  if (error) {
    console.error('❌ Invoice group çekme hatası:', error)
    return null
  }

  return data as InvoiceGroupData
}



