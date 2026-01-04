/**
 * Products Types
 * Product, Brand, Stock, StockMovement interfaces ve filter types
 */

import type { Database } from '@/types/database.types'

export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type Brand = Database['public']['Tables']['brands']['Row']
export type BrandInsert = Database['public']['Tables']['brands']['Insert']
export type BrandUpdate = Database['public']['Tables']['brands']['Update']

export type ProductCategory = Database['public']['Tables']['product_categories']['Row']
export type ProductCategoryInsert = Database['public']['Tables']['product_categories']['Insert']
export type ProductCategoryUpdate = Database['public']['Tables']['product_categories']['Update']

export type WarehouseStock = Database['public']['Tables']['warehouse_stock']['Row']
export type WarehouseStockInsert = Database['public']['Tables']['warehouse_stock']['Insert']
export type WarehouseStockUpdate = Database['public']['Tables']['warehouse_stock']['Update']

export type StockMovement = Database['public']['Tables']['stock_movements']['Row']
export type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert']

export type MovementType = 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'

export interface ProductWithBrand extends Product {
  brand?: Brand | null
  category?: ProductCategory | null
  total_stock?: number
}

export interface ProductWithStock extends Product {
  brand?: Brand | null
  category?: ProductCategory | null
  warehouse_stocks?: WarehouseStockWithDetails[]
  total_stock?: number
}

export interface WarehouseStockWithDetails extends WarehouseStock {
  warehouse?: {
    id: string
    name: string
  } | null
  product?: {
    id: string
    name: string
    sku: string | null
  } | null
}

export interface StockMovementWithDetails extends StockMovement {
  product?: {
    id: string
    name: string
    sku: string | null
  } | null
  warehouse?: {
    id: string
    name: string
  } | null
  created_by_profile?: {
    id: string
    full_name: string | null
  } | null
}

