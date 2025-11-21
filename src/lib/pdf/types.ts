/**
 * PDF Generator Type Definitions
 */

export interface PDFInvoiceData {
  id: string
  amount: number
  currency: string
  created_at: string
  notes?: string
  supplier_name: string
  item_name: string
  added_by: string
}

export interface PDFStatistics {
  totalDays: number
  totalOffers: number
  totalShipments: number
  totalInvoices: number
  totalAmount: number
  currency: string
  subtotal?: number
  discount?: number
  tax?: number
  grandTotal?: number
}

export interface PDFRequestData {
  id: string
  title: string
  created_at: string
  status: string
  urgency_level: string
  material_class: string
  description: string
  site_name: string
  requester_name: string
  requester_email: string
}

export interface PDFOrderData {
  id: string
  supplier_name: string
  item_name: string
  quantity: number
  unit: string
  amount: number
  currency: string
  delivery_date?: string
  created_at: string
  ordered_by: string
}

export interface PDFTimelineItem {
  person_name: string
  person_role: string
  action: string
  date: string
}

export interface PDFData {
  request: PDFRequestData
  orders: PDFOrderData[]
  invoices: PDFInvoiceData[]
  statistics: PDFStatistics
  timeline?: PDFTimelineItem[]
}

