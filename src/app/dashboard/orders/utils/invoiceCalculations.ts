/**
 * Invoice Calculation Utilities
 * Fatura hesaplama işlemleri
 */

import { parseToNumber } from './numberFormatting'

export interface SubtotalsByCurrency {
  [currency: string]: number
}

/**
 * Sipariş tutarlarından ara toplamları hesapla (para birimi bazında)
 * @param orderAmounts - Sipariş ID -> Tutar mapping
 * @param orderCurrencies - Sipariş ID -> Para birimi mapping
 * @returns Para birimi bazında ara toplamlar
 */
export function calculateSubtotals(
  orderAmounts: Record<string, string>,
  orderCurrencies: Record<string, string>
): SubtotalsByCurrency {
  const subtotals: SubtotalsByCurrency = {}
  
  Object.keys(orderAmounts).forEach(orderId => {
    const amount = orderAmounts[orderId]
    const currency = orderCurrencies[orderId] || 'TRY'
    
    if (amount) {
      const numAmount = parseToNumber(amount)
      if (!isNaN(numAmount)) {
        subtotals[currency] = (subtotals[currency] || 0) + numAmount
      }
    }
  })
  
  return subtotals
}

/**
 * Tek sipariş için ara toplam hesapla
 * @param amount - Sipariş tutarı
 * @param currency - Para birimi
 * @returns Para birimi bazında ara toplamlar
 */
export function calculateSingleSubtotal(
  amount: string,
  currency: string
): SubtotalsByCurrency {
  const numAmount = parseToNumber(amount)
  if (!isNaN(numAmount) && numAmount > 0) {
    return { [currency]: numAmount }
  }
  return {}
}

/**
 * Genel toplam hesapla: Ara Toplam - İndirim + KDV
 * @param subtotal - Ara toplam
 * @param discount - İndirim tutarı
 * @param tax - KDV tutarı
 * @returns Genel toplam
 */
export function calculateGrandTotal(
  subtotal: number,
  discount: number = 0,
  tax: number = 0
): number {
  return subtotal - discount + tax
}

/**
 * Fatura özet bilgilerini doğrula
 * @param subtotalCurrency - Ara toplam para birimi
 * @param discountCurrency - İndirim para birimi
 * @param taxCurrency - KDV para birimi
 * @param grandTotalCurrency - Genel toplam para birimi
 * @returns Para birimleri uyumluysa true
 */
export function validateInvoiceCurrencies(
  subtotalCurrency: string,
  discountCurrency: string,
  taxCurrency: string,
  grandTotalCurrency: string
): boolean {
  // Tüm para birimleri aynı olmalı
  return (
    subtotalCurrency === discountCurrency &&
    subtotalCurrency === taxCurrency &&
    subtotalCurrency === grandTotalCurrency
  )
}

/**
 * Ara toplamları formatla (string olarak)
 * @param subtotals - Para birimi bazında ara toplamlar
 * @returns Formatlanmış string'ler
 */
export function formatSubtotals(subtotals: SubtotalsByCurrency): Record<string, string> {
  const formatted: Record<string, string> = {}
  Object.keys(subtotals).forEach(currency => {
    formatted[currency] = subtotals[currency].toFixed(2).replace('.', ',')
  })
  return formatted
}

















