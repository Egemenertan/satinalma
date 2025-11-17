// Order Types
export interface OrderData {
  id: string
  purchase_request_id: string
  supplier_id: string
  delivery_date: string
  amount: number
  currency: string
  quantity: number
  returned_quantity?: number
  return_notes?: string
  is_return_reorder?: boolean
  status: string
  is_delivered: boolean
  created_at: string
  delivery_image_urls?: string[]
  delivered_at?: string
  // Relations
  suppliers: {
    name: string
    contact_person?: string
    phone?: string
    email?: string
  } | null
  purchase_requests: {
    title: string
    request_number: string
    site_name?: string
    status: string
    sites?: {
      name: string
    }
  } | null
  purchase_request_items: {
    item_name: string
    unit: string
    brand?: string
    specifications?: string
  } | null
  invoices?: InvoiceData[]
}

export interface InvoiceData {
  id: string
  amount: number
  currency: string
  invoice_photos: string[]
  created_at: string
  // Yeni yapı - invoice_groups ile ilişki
  invoice_group_id?: string | null
  // Eski yapı - geriye uyumluluk için (deprecated)
  parent_invoice_id?: string | null
  is_master?: boolean
  // Özet bilgiler (sadece master/group için)
  subtotal?: number | null
  discount?: number | null
  tax?: number | null
  grand_total?: number | null
  notes?: string
}

export interface OrdersResponse {
  orders: OrderData[]
  totalCount: number
  totalPages: number
}

export interface OrderFilters {
  page: number
  pageSize: number
  searchTerm: string
  statusFilter: string
  dateRange: {
    from: Date | undefined
    to?: Date | undefined
  }
}

export interface GroupedOrder {
  request: any
  orders: OrderData[]
}



