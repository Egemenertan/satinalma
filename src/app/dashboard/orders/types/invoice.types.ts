// Invoice Types
export interface InvoiceFormData {
  orderId: string
  amount: string
  currency: string
  photos: string[]
}

export interface MultiInvoiceFormData {
  orderAmounts: Record<string, string>
  orderCurrencies: Record<string, string>
  photos: string[]
  // Toplu fatura özeti
  subtotals?: Record<string, string>
  discount?: string
  discountCurrency?: string
  tax?: string
  taxCurrency?: string
  grandTotal?: string
  grandTotalCurrency?: string
}

export interface InvoiceSummary {
  subtotals: Record<string, number>
  discount?: number
  discountCurrency?: string
  tax?: number
  taxCurrency?: string
  grandTotal?: number
  grandTotalCurrency?: string
}

export interface InvoiceEditState {
  invoiceId: string | null
  amount: string
  currency: string
  photos: string[]
}

// Invoice Group - Toplu fatura grubu
export interface InvoiceGroupData {
  id: string
  created_at: string
  created_by?: string
  group_name?: string
  notes?: string
  subtotal: number
  discount?: number
  tax?: number
  grand_total: number
  currency: string
  invoice_photos: string[]
  updated_at?: string
  // View'dan gelen ek bilgiler
  invoices?: Array<{
    invoice_id: string
    order_id: string
    amount: number
    currency: string
    created_at: string
  }>
  invoice_count?: number
}



