export interface MaterialCategory {
  id: string
  name: string
  description?: string
  created_at: string
}

export interface MaterialSubcategory {
  id: string
  category_id: string
  name: string
  description?: string
  created_at: string
}

export interface MaterialItem {
  id: string
  subcategory_id: string
  name: string
  description?: string
  unit: string
  created_at: string
}

export interface SupplierMaterial {
  id: string
  supplier_id: string
  material_item_id: string
  price?: number
  currency?: string
  lead_time?: number
  min_order_quantity?: number
  created_at: string
}

