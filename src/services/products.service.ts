/**
 * Products Service
 * Ürün yönetimi için temiz ve optimize edilmiş Supabase sorguları
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
type Brand = Database['public']['Tables']['brands']['Row']
type ProductCategory = Database['public']['Tables']['product_categories']['Row']
type WarehouseStock = Database['public']['Tables']['warehouse_stock']['Row']

export interface ProductFilters {
  search?: string
  brandId?: string
  siteId?: string
  categoryId?: string
  productType?: string
  isActive?: boolean
  minPrice?: number
  maxPrice?: number
}

export interface ProductWithDetails extends Product {
  brand?: Brand | null
  category?: ProductCategory | null
  total_stock?: number
  warehouse_stocks?: WarehouseStock[]
}

/**
 * Ürünleri listele (filtreleme ve pagination ile)
 */
export async function fetchProducts(
  filters?: ProductFilters,
  page = 1,
  pageSize = 20
) {
  const supabase = createClient()
  
  let query = supabase
    .from('products')
    .select(`
      *,
      brand:brands(*),
      category:product_categories(*),
      warehouse_stocks:warehouse_stock(*)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  // Filtreleme
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
  }

  if (filters?.brandId) {
    query = query.eq('brand_id', filters.brandId)
  }
  
  // Site filtresi - warehouse_stock üzerinden
  if (filters?.siteId) {
    const { data: stockProducts } = await supabase
      .from('warehouse_stock')
      .select('product_id')
      .eq('warehouse_id', filters.siteId)
    
    const productIds = stockProducts?.map(s => s.product_id) || []
    if (productIds.length > 0) {
      query = query.in('id', productIds)
    } else {
      // Site'da hiç ürün yoksa boş sonuç dön
      return { products: [], totalCount: 0, totalPages: 0 }
    }
  }

  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }

  if (filters?.productType) {
    query = query.eq('product_type', filters.productType)
  }

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  if (filters?.minPrice !== undefined) {
    query = query.gte('unit_price', filters.minPrice)
  }

  if (filters?.maxPrice !== undefined) {
    query = query.lte('unit_price', filters.maxPrice)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Products fetch error:', error)
    throw error
  }

  // Calculate total stock for each product
  // Toplam = Depo Stokları (user_id: null) + Kullanıcı Zimmetleri (user_inventory)
  const productsWithStock = await Promise.all((data || []).map(async (product: any) => {
    // Depo stokları (sadece user_id: null olanlar)
    const warehouseStock = (product.warehouse_stocks || [])
      .filter((stock: any) => stock.user_id === null || stock.user_id === undefined)
      .reduce((sum: number, stock: any) => sum + (parseFloat(stock.quantity) || 0), 0)
    
    // Kullanıcı zimmetleri (user_inventory)
    const supabase = createClient()
    const { data: inventories } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('product_id', product.id)
      .eq('status', 'active')
    
    const userInventoryStock = (inventories || []).reduce(
      (sum: number, inv: any) => sum + (parseFloat(inv.quantity) || 0),
      0
    )
    
    const totalStock = warehouseStock + userInventoryStock
    
    // Debug log (geliştirme sırasında)
    if (userInventoryStock > 0) {
      console.log(`📊 ${product.name}:`, {
        depo: warehouseStock,
        zimmet: userInventoryStock,
        toplam: totalStock
      })
    }
    
    return {
      ...product,
      total_stock: totalStock,
    }
  }))

  return {
    products: productsWithStock as ProductWithDetails[],
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    currentPage: page,
  }
}

/**
 * Tek bir ürünü ID ile getir (tüm detaylarıyla)
 */
export async function fetchProductById(id: string): Promise<ProductWithDetails | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      brand:brands(*),
      category:product_categories(*),
      warehouse_stocks:warehouse_stock(
        *,
        warehouse:sites(id, name)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Product fetch by ID error:', error)
    throw error
  }

  // Calculate total stock
  // Toplam = Depo Stokları (user_id: null) + Kullanıcı Zimmetleri (user_inventory)
  const warehouseStock = (data.warehouse_stocks || [])
    .filter((stock: any) => stock.user_id === null || stock.user_id === undefined)
    .reduce((sum: number, stock: any) => sum + (parseFloat(stock.quantity) || 0), 0)
  
  // Kullanıcı zimmetleri
  const { data: inventories } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('product_id', id)
    .eq('status', 'active')
  
  const userInventoryStock = (inventories || []).reduce(
    (sum: number, inv: any) => sum + (parseFloat(inv.quantity) || 0),
    0
  )
  
  const totalStock = warehouseStock + userInventoryStock
  
  // Debug log
  console.log(`📊 ${data.name} - Toplam Stok Hesaplama:`, {
    'Ana Depo (user_id: null)': warehouseStock,
    'Zimmetli (user_inventory)': userInventoryStock,
    'TOPLAM': totalStock,
    'warehouse_stocks kayıt sayısı': data.warehouse_stocks?.length || 0
  })

  return {
    ...data,
    total_stock: totalStock,
  } as ProductWithDetails
}

/**
 * Yeni ürün oluştur
 */
export async function createProduct(product: ProductInsert): Promise<Product> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single()

  if (error) {
    console.error('Product create error:', error)
    throw error
  }

  return data as Product
}

/**
 * Ürün güncelle
 */
export async function updateProduct(
  id: string,
  updates: ProductUpdate
): Promise<Product> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Product update error:', error)
    throw error
  }

  return data as Product
}

/**
 * Ürün sil (soft delete)
 */
export async function deleteProduct(id: string, hardDelete = false): Promise<void> {
  const supabase = createClient()

  if (hardDelete) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Product hard delete error:', error)
      throw error
    }
  } else {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Product soft delete error:', error)
      throw error
    }
  }
}

/**
 * Ürün görseli upload et
 */
export async function uploadProductImage(
  file: File,
  productId: string
): Promise<string> {
  const supabase = createClient()

  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `product-images/${productId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('satinalma')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('Product image upload error:', uploadError)
    throw uploadError
  }

  const { data: { publicUrl } } = supabase.storage
    .from('satinalma')
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Ürün görsellerini toplu upload et
 */
export async function uploadProductImages(
  files: File[],
  productId: string
): Promise<string[]> {
  const uploadPromises = files.map(file => uploadProductImage(file, productId))
  return await Promise.all(uploadPromises)
}

/**
 * Ürün görselini sil
 */
export async function deleteProductImage(imageUrl: string): Promise<void> {
  const supabase = createClient()

  // URL'den path'i çıkar
  const path = imageUrl.split('/satinalma/')[1]
  if (!path) return

  const { error } = await supabase.storage
    .from('satinalma')
    .remove([path])

  if (error) {
    console.error('Product image delete error:', error)
    throw error
  }
}

/**
 * Ürün istatistikleri getir
 */
export async function fetchProductStats() {
  const supabase = createClient()

  // Toplam ürün sayısı
  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Düşük stoklu ürünler
  const { data: lowStockProducts } = await supabase
    .from('warehouse_stock')
    .select('product_id')
    .lt('quantity', supabase.rpc('COALESCE', { column: 'min_stock_level', default: 10 }))

  // Toplam stok değeri (basit hesaplama)
  const { data: products } = await supabase
    .from('products')
    .select('unit_price, warehouse_stock(quantity)')
    .eq('is_active', true)

  let totalValue = 0
  if (products) {
    products.forEach((product: any) => {
      const price = parseFloat(product.unit_price || 0)
      const stocks = product.warehouse_stock || []
      const totalQuantity = stocks.reduce(
        (sum: number, stock: any) => sum + parseFloat(stock.quantity || 0),
        0
      )
      totalValue += price * totalQuantity
    })
  }

  return {
    totalProducts: totalProducts || 0,
    lowStockCount: lowStockProducts?.length || 0,
    totalValue: Math.round(totalValue * 100) / 100,
  }
}

