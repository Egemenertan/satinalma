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

export interface ProductWithDetails extends Omit<Product, 'category'> {
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
  const searchTerm = filters?.search?.trim()
  
  console.log('🔍 fetchProducts called with:', { filters, searchTerm, page, pageSize })
  
  // Site ve arama birlikte varsa özel mantık kullan
  if (filters?.siteId && searchTerm) {
    console.log('🏢 Site + Search mode:', { siteId: filters.siteId, searchTerm })
    
    // Önce site'deki ürün ID'lerini al
    const { data: stockProducts } = await supabase
      .from('warehouse_stock')
      .select('product_id')
      .eq('warehouse_id', filters.siteId)
    
    const siteProductIds = stockProducts?.map(s => s.product_id) || []
    console.log('📦 Site product IDs count:', siteProductIds.length)
    
    if (siteProductIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }
    
    // Name ile eşleşenleri ayrı sorgula
    const { data: nameMatches } = await supabase
      .from('products')
      .select('id')
      .in('id', siteProductIds)
      .ilike('name', `%${searchTerm}%`)
    
    // SKU ile eşleşenleri ayrı sorgula
    const { data: skuMatches } = await supabase
      .from('products')
      .select('id')
      .in('id', siteProductIds)
      .ilike('sku', `%${searchTerm}%`)
    
    // Seri numarasına göre ara
    const { data: inventoryProducts } = await supabase
      .from('user_inventory')
      .select('product_id')
      .ilike('serial_number', `%${searchTerm}%`)
    
    const { data: pendingProducts } = await supabase
      .from('pending_user_inventory')
      .select('product_id')
      .ilike('serial_number', `%${searchTerm}%`)
    
    const serialProductIds = [
      ...(inventoryProducts?.map(inv => inv.product_id).filter(Boolean) || []),
      ...(pendingProducts?.map(inv => inv.product_id).filter(Boolean) || [])
    ]
    
    // Tüm eşleşmeleri birleştir
    const nameMatchIds = nameMatches?.map(p => p.id) || []
    const skuMatchIds = skuMatches?.map(p => p.id) || []
    const serialMatchIds = serialProductIds.filter(id => siteProductIds.includes(id))
    
    console.log('🔎 Search results:', { 
      nameMatchIds: nameMatchIds.length, 
      skuMatchIds: skuMatchIds.length,
      serialMatchIds: serialMatchIds.length,
      skuMatchIdsActual: skuMatchIds
    })
    
    const matchingIds = [...new Set([...nameMatchIds, ...skuMatchIds, ...serialMatchIds])]
    console.log('✅ Final matching IDs:', matchingIds.length, matchingIds)
    
    if (matchingIds.length === 0) {
      console.log('❌ No matching IDs found, returning empty')
      return { products: [], totalCount: 0, totalPages: 0 }
    }
    
    // Ana sorguyu bu ID'lerle yap
    let query = supabase
      .from('products')
      .select(`
        *,
        brand:brands(*),
        category:product_categories(*),
        warehouse_stocks:warehouse_stock(*)
      `, { count: 'exact' })
      .in('id', matchingIds)
      .order('created_at', { ascending: false })
    
    // Diğer filtreleri uygula - log ekle
    console.log('🔧 Applying filters:', { 
      brandId: filters?.brandId, 
      categoryId: filters?.categoryId, 
      productType: filters?.productType, 
      isActive: filters?.isActive 
    })
    
    if (filters?.brandId) query = query.eq('brand_id', filters.brandId)
    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters?.productType) query = query.eq('product_type', filters.productType)
    if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)
    if (filters?.minPrice !== undefined) query = query.gte('unit_price', filters.minPrice)
    if (filters?.maxPrice !== undefined) query = query.lte('unit_price', filters.maxPrice)
    
    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)
    
    const { data, error, count } = await query
    
    console.log('📋 Query result:', { dataLength: data?.length, count, error })
    
    if (error) {
      console.error('Products fetch error:', error)
      throw error
    }
    
    // Calculate total stock for each product
    const productsWithStock = await Promise.all((data || []).map(async (product: any) => {
      const warehouseStock = (product.warehouse_stocks || [])
        .filter((stock: any) => stock.user_id === null || stock.user_id === undefined)
        .reduce((sum: number, stock: any) => sum + (parseFloat(stock.quantity) || 0), 0)
      
      const { data: inventories } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('product_id', product.id)
        .eq('status', 'active')
      
      const userInventoryStock = (inventories || []).reduce(
        (sum: number, inv: any) => sum + (parseFloat(inv.quantity) || 0),
        0
      )
      
      return {
        ...product,
        total_stock: warehouseStock + userInventoryStock,
      }
    }))
    
    return {
      products: productsWithStock as ProductWithDetails[],
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page,
    }
  }
  
  // Site olmadan sadece arama varsa
  if (searchTerm && !filters?.siteId) {
    console.log('🔍 Search only mode (no site):', searchTerm)
    
    // Name ile eşleşenleri ara
    const { data: nameMatches } = await supabase
      .from('products')
      .select('id')
      .ilike('name', `%${searchTerm}%`)
    
    // SKU ile eşleşenleri ara
    const { data: skuMatches } = await supabase
      .from('products')
      .select('id')
      .ilike('sku', `%${searchTerm}%`)
    
    // Seri numarasına göre ara
    const { data: inventoryProducts } = await supabase
      .from('user_inventory')
      .select('product_id')
      .ilike('serial_number', `%${searchTerm}%`)
    
    const { data: pendingProducts } = await supabase
      .from('pending_user_inventory')
      .select('product_id')
      .ilike('serial_number', `%${searchTerm}%`)
    
    const nameMatchIds = nameMatches?.map(p => p.id) || []
    const skuMatchIds = skuMatches?.map(p => p.id) || []
    const serialMatchIds = [
      ...(inventoryProducts?.map(inv => inv.product_id).filter(Boolean) || []),
      ...(pendingProducts?.map(inv => inv.product_id).filter(Boolean) || [])
    ]
    
    const allMatchingIds = [...new Set([...nameMatchIds, ...skuMatchIds, ...serialMatchIds])]
    
    console.log('🔎 Search only results:', { 
      nameMatchIds: nameMatchIds.length, 
      skuMatchIds: skuMatchIds.length, 
      serialMatchIds: serialMatchIds.length,
      total: allMatchingIds.length 
    })
    
    if (allMatchingIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }
    
    // Ana sorguyu bu ID'lerle yap
    let query = supabase
      .from('products')
      .select(`
        *,
        brand:brands(*),
        category:product_categories(*),
        warehouse_stocks:warehouse_stock(*)
      `, { count: 'exact' })
      .in('id', allMatchingIds)
      .order('created_at', { ascending: false })
    
    // Diğer filtreleri uygula
    if (filters?.brandId) query = query.eq('brand_id', filters.brandId)
    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters?.productType) query = query.eq('product_type', filters.productType)
    if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)
    if (filters?.minPrice !== undefined) query = query.gte('unit_price', filters.minPrice)
    if (filters?.maxPrice !== undefined) query = query.lte('unit_price', filters.maxPrice)
    
    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)
    
    const { data, error, count } = await query
    
    console.log('📋 Search only query result:', { dataLength: data?.length, count, error })
    
    if (error) {
      console.error('Products fetch error:', error)
      throw error
    }
    
    // Calculate total stock for each product
    const productsWithStock = await Promise.all((data || []).map(async (product: any) => {
      const warehouseStock = (product.warehouse_stocks || [])
        .filter((stock: any) => stock.user_id === null || stock.user_id === undefined)
        .reduce((sum: number, stock: any) => sum + (parseFloat(stock.quantity) || 0), 0)
      
      const { data: inventories } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('product_id', product.id)
        .eq('status', 'active')
      
      const userInventoryStock = (inventories || []).reduce(
        (sum: number, inv: any) => sum + (parseFloat(inv.quantity) || 0),
        0
      )
      
      return {
        ...product,
        total_stock: warehouseStock + userInventoryStock,
      }
    }))
    
    return {
      products: productsWithStock as ProductWithDetails[],
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page,
    }
  }
  
  // Site filtresi varsa (arama olmadan)
  let siteProductIds: string[] | null = null
  if (filters?.siteId) {
    const { data: stockProducts } = await supabase
      .from('warehouse_stock')
      .select('product_id')
      .eq('warehouse_id', filters.siteId)
    
    siteProductIds = stockProducts?.map(s => s.product_id) || []
    if (siteProductIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }
  }

  let query = supabase
    .from('products')
    .select(`
      *,
      brand:brands(*),
      category:product_categories(*),
      warehouse_stocks:warehouse_stock(*)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  // Site filtresi uygula (varsa)
  if (siteProductIds) {
    query = query.in('id', siteProductIds)
  }

  if (filters?.brandId) {
    query = query.eq('brand_id', filters.brandId)
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
 * Kategoriye göre bir sonraki stok kodunu oluştur
 */
export async function generateNextSKU(categoryId: string): Promise<string> {
  const supabase = createClient()

  // Kategorideki tüm ürünlerin SKU'larını al
  const { data: products, error } = await supabase
    .from('products')
    .select('sku')
    .eq('category_id', categoryId)
    .not('sku', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('SKU fetch error:', error)
    throw error
  }

  // Eğer kategoride hiç ürün yoksa, başlangıç SKU'su oluştur
  if (!products || products.length === 0) {
    return '6500000001'
  }

  // Sadece sayısal SKU'ları filtrele ve en yüksek olanı bul
  const numericSKUs = products
    .map(p => p.sku)
    .filter(sku => sku && /^\d+$/.test(sku.trim())) // Sadece rakamlardan oluşan SKU'lar
    .map(sku => parseInt(sku, 10))
    .filter(num => !isNaN(num))
    .sort((a, b) => b - a) // Büyükten küçüğe sırala

  // En yüksek sayısal SKU'yu bul
  let nextNumber: number
  if (numericSKUs.length > 0) {
    nextNumber = numericSKUs[0] + 1
  } else {
    // Hiç sayısal SKU yoksa, başlangıç değeri
    nextNumber = 6500000001
  }

  // 10 haneli formatta döndür
  return nextNumber.toString().padStart(10, '0')
}

/**
 * Ürün istatistikleri getir
 */
export async function fetchProductStats(siteId?: string) {
  const supabase = createClient()

  // Site filtresine göre ürün ID'lerini al
  let productIds: string[] | undefined = undefined
  if (siteId) {
    const { data: stockProducts } = await supabase
      .from('warehouse_stock')
      .select('product_id')
      .eq('warehouse_id', siteId)
    
    productIds = stockProducts?.map(s => s.product_id) || []
    
    // Site'da hiç ürün yoksa boş istatistik dön
    if (productIds.length === 0) {
      return {
        totalProducts: 0,
        lowStockCount: 0,
        totalValue: 0,
      }
    }
  }

  // Toplam ürün sayısı
  let productCountQuery = supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  
  if (productIds) {
    productCountQuery = productCountQuery.in('id', productIds)
  }
  
  const { count: totalProducts } = await productCountQuery

  // Düşük stoklu ürünler
  let lowStockQuery = supabase
    .from('warehouse_stock')
    .select('product_id, quantity, min_stock_level')
  
  if (siteId) {
    lowStockQuery = lowStockQuery.eq('warehouse_id', siteId)
  }
  
  const { data: allStocks } = await lowStockQuery
  const lowStockProducts = allStocks?.filter((stock: any) => {
    const minLevel = stock.min_stock_level || 10
    return stock.quantity < minLevel
  }) || []

  // Toplam stok değeri
  let productsQuery = supabase
    .from('products')
    .select('id, unit_price, warehouse_stock(quantity, warehouse_id)')
    .eq('is_active', true)
  
  if (productIds) {
    productsQuery = productsQuery.in('id', productIds)
  }
  
  const { data: products } = await productsQuery

  let totalValue = 0
  if (products) {
    products.forEach((product: any) => {
      const price = parseFloat(product.unit_price || 0)
      let stocks = product.warehouse_stock || []
      
      // Eğer siteId varsa sadece o site'nin stoklarını hesapla
      if (siteId) {
        stocks = stocks.filter((s: any) => s.warehouse_id === siteId)
      }
      
      const totalQuantity = stocks.reduce(
        (sum: number, stock: any) => sum + parseFloat(stock.quantity || 0),
        0
      )
      totalValue += price * totalQuantity
    })
  }

  // En çok stoklu 5 ürün
  let topProductsQuery = supabase
    .from('products')
    .select('id, name, warehouse_stock(quantity, warehouse_id)')
    .eq('is_active', true)
  
  if (productIds) {
    topProductsQuery = topProductsQuery.in('id', productIds)
  }
  
  const { data: allProducts } = await topProductsQuery
  
  // Her ürün için toplam stok hesapla
  const productsWithStock = (allProducts || []).map((product: any) => {
    let stocks = product.warehouse_stock || []
    
    // Eğer siteId varsa sadece o site'nin stoklarını hesapla
    if (siteId) {
      stocks = stocks.filter((s: any) => s.warehouse_id === siteId)
    }
    
    const totalStock = stocks.reduce(
      (sum: number, stock: any) => sum + parseFloat(stock.quantity || 0),
      0
    )
    
    return {
      name: product.name,
      count: Math.round(totalStock)
    }
  })
  
  // En çok stoklu 10 ürünü seç
  const topProducts = productsWithStock
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalProducts: totalProducts || 0,
    lowStockCount: lowStockProducts?.length || 0,
    totalValue: Math.round(totalValue * 100) / 100,
    topProducts
  }
}

