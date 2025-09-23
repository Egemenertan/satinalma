// Main interface - all_materials table structure
export interface AllMaterial {
  id: number
  class: string | null
  class_code: string | null
  group: string | null
  group_code: string | null
  item_name: string | null
  item_code: string | null
  created_at: string
}

// Legacy interfaces - for backward compatibility
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

// Updated SupplierMaterial to match supplier_materials table
export interface SupplierMaterial {
  id: string
  supplier_id: string
  material_class: string
  material_group: string
  material_item: string
  price_range_min?: number
  price_range_max?: number
  currency?: string
  delivery_time_days?: number
  minimum_order_quantity?: number
  is_preferred?: boolean
  notes?: string
  created_at: string
  updated_at: string
}

