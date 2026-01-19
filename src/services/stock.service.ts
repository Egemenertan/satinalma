/**
 * Stock Service
 * Stok yönetimi için temiz ve optimize edilmiş Supabase sorguları
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { uploadInvoiceImages } from '@/lib/utils/imageUpload'

type WarehouseStock = Database['public']['Tables']['warehouse_stock']['Row']
type WarehouseStockInsert = Database['public']['Tables']['warehouse_stock']['Insert']
type WarehouseStockUpdate = Database['public']['Tables']['warehouse_stock']['Update']
type StockMovement = Database['public']['Tables']['stock_movements']['Row']
type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert']

export interface StockMovementFilters {
  productId?: string
  warehouseId?: string
  movementType?: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme'
  startDate?: string
  endDate?: string
}

export interface StockWithDetails extends WarehouseStock {
  product?: {
    id: string
    name: string
    sku: string | null
    unit: string
  }
  warehouse?: {
    id: string
    name: string
  }
}

/**
 * Ürüne ait tüm stokları getir
 */
export async function fetchStockByProduct(productId: string): Promise<StockWithDetails[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('warehouse_stock')
    .select(`
      *,
      product:products(id, name, sku, unit),
      warehouse:sites(id, name)
    `)
    .eq('product_id', productId)
    .order('warehouse_id')

  if (error) {
    console.error('Stock fetch by product error:', error)
    throw error
  }

  return data as StockWithDetails[]
}

/**
 * Depoya ait tüm stokları getir
 */
export async function fetchStockByWarehouse(warehouseId: string): Promise<StockWithDetails[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('warehouse_stock')
    .select(`
      *,
      product:products(id, name, sku, unit),
      warehouse:sites(id, name)
    `)
    .eq('warehouse_id', warehouseId)
    .order('quantity', { ascending: true })

  if (error) {
    console.error('Stock fetch by warehouse error:', error)
    throw error
  }

  return data as StockWithDetails[]
}

/**
 * Düşük stoklu ürünleri getir
 */
export async function fetchLowStockProducts(): Promise<StockWithDetails[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('warehouse_stock')
    .select(`
      *,
      product:products(id, name, sku, unit),
      warehouse:sites(id, name)
    `)
    .filter('quantity', 'lte', 'min_stock_level')
    .order('quantity', { ascending: true })

  if (error) {
    console.error('Low stock fetch error:', error)
    throw error
  }

  return data as StockWithDetails[]
}

/**
 * Stok hareketlerini getir (filtreleme ve pagination ile)
 */
export async function fetchStockMovements(
  filters?: StockMovementFilters,
  page = 1,
  pageSize = 50
) {
  const supabase = createClient()

  let query = supabase
    .from('stock_movements')
    .select(`
      *,
      product:products(id, name, sku),
      warehouse:sites(id, name),
      created_by_profile:profiles(id, full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  // Filtreleme
  if (filters?.productId) {
    query = query.eq('product_id', filters.productId)
  }

  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }

  if (filters?.movementType) {
    query = query.eq('movement_type', filters.movementType)
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Stock movements fetch error:', error)
    throw error
  }

  return {
    movements: data as any[],
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    currentPage: page,
  }
}

/**
 * Stok oluştur veya güncelle
 */
export async function upsertStock(
  productId: string,
  warehouseId: string,
  quantity: number,
  minLevel?: number,
  maxLevel?: number
): Promise<WarehouseStock> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const stockData: WarehouseStockInsert = {
    product_id: productId,
    warehouse_id: warehouseId,
    quantity,
    min_stock_level: minLevel,
    max_stock_level: maxLevel,
    updated_by: user?.id,
  }

  const { data, error } = await supabase
    .from('warehouse_stock')
    .upsert(stockData, {
      onConflict: 'product_id,warehouse_id',
    })
    .select()
    .single()

  if (error) {
    console.error('Stock upsert error:', error)
    throw error
  }

  return data as WarehouseStock
}

/**
 * Stok güncelle ve hareket kaydı oluştur
 */
export async function updateStockWithMovement(
  productId: string,
  warehouseId: string,
  quantityChange: number,
  movementType: 'giriş' | 'çıkış' | 'transfer' | 'düzeltme',
  reason?: string,
  referenceId?: string,
  referenceType?: string,
  supplierName?: string,
  productCondition?: 'yeni' | 'kullanılmış' | 'arızalı' | 'hek',
  assignedTo?: string,
  unitPrice?: number,
  currency?: string,
  invoiceFiles?: File[]
): Promise<WarehouseStock> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Mevcut stok bilgisini al
  const { data: currentStock } = await supabase
    .from('warehouse_stock')
    .select('quantity, condition_breakdown, assigned_breakdown')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .single()

  const previousQuantity = currentStock ? parseFloat(currentStock.quantity.toString()) : 0
  const newQuantity = previousQuantity + quantityChange

  // Condition breakdown güncelle
  const currentBreakdown = (currentStock?.condition_breakdown as any) || {
    yeni: 0,
    kullanılmış: 0,
    hek: 0,
    arızalı: 0,
  }

  // Yeni breakdown hesapla
  const newBreakdown = { ...currentBreakdown }
  if (productCondition) {
    const currentConditionQty = Number(newBreakdown[productCondition] || 0)
    newBreakdown[productCondition] = Math.max(0, currentConditionQty + quantityChange)
  }

  // Assigned breakdown güncelle (sadece zimmetli transfer'lerde)
  const currentAssignedBreakdown = (currentStock?.assigned_breakdown as any) || {}
  const newAssignedBreakdown = { ...currentAssignedBreakdown }
  
  if (assignedTo && productCondition) {
    // Çalışan için mevcut breakdown'ı al
    const employeeBreakdown = newAssignedBreakdown[assignedTo] || {
      yeni: 0,
      kullanılmış: 0,
      hek: 0,
      arızalı: 0,
    }
    
    // Çalışanın condition breakdown'ını güncelle
    const currentEmployeeConditionQty = Number(employeeBreakdown[productCondition] || 0)
    employeeBreakdown[productCondition] = Math.max(0, currentEmployeeConditionQty + quantityChange)
    
    newAssignedBreakdown[assignedTo] = employeeBreakdown
  }

  // Stok güncelle
  const stockData: WarehouseStockUpdate = {
    quantity: newQuantity,
    updated_by: user?.id,
    condition_breakdown: newBreakdown as any,
    assigned_breakdown: newAssignedBreakdown as any,
  }

  const { data: updatedStock, error: stockError } = await supabase
    .from('warehouse_stock')
    .upsert({
      product_id: productId,
      warehouse_id: warehouseId,
      ...stockData,
    }, {
      onConflict: 'product_id,warehouse_id',
    })
    .select()
    .single()

  if (stockError) {
    console.error('Stock update error:', stockError)
    throw stockError
  }

  // Hareket kaydı oluştur
  const movementData: StockMovementInsert = {
    product_id: productId,
    warehouse_id: warehouseId,
    movement_type: movementType,
    quantity: Math.abs(quantityChange),
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    reason,
    reference_id: referenceId,
    reference_type: referenceType,
    created_by: user?.id,
    supplier_name: supplierName,
    product_condition: productCondition,
    assigned_to: assignedTo,
    unit_price: unitPrice,
    currency: currency || 'TRY',
  }

  // İlk önce hareketi ekle ve ID'sini al
  const { data: insertedMovement, error: movementError } = await supabase
    .from('stock_movements')
    .insert(movementData)
    .select('id')
    .single()

  if (movementError) {
    console.error('Stock movement create error:', movementError)
    // Hareket kaydı oluşturulamasa bile stok güncellemesi başarılı
    return updatedStock as WarehouseStock
  }

  // Fatura resimleri varsa yükle ve güncelle
  if (invoiceFiles && invoiceFiles.length > 0 && insertedMovement) {
    try {
      const imageUrls = await uploadInvoiceImages(invoiceFiles, insertedMovement.id)
      
      // Movement kaydını resim URL'leriyle güncelle
      await supabase
        .from('stock_movements')
        .update({ invoice_images: imageUrls })
        .eq('id', insertedMovement.id)
    } catch (uploadError) {
      console.error('Invoice upload error:', uploadError)
      // Upload hatası kritik değil, devam et
    }
  }

  return updatedStock as WarehouseStock
}

/**
 * Stok girişi
 */
export async function addStock(
  productId: string,
  warehouseId: string,
  quantity: number,
  reason?: string,
  referenceId?: string,
  supplierName?: string,
  productCondition?: 'yeni' | 'kullanılmış' | 'arızalı' | 'hek',
  unitPrice?: number,
  currency?: string,
  invoiceFiles?: File[]
): Promise<WarehouseStock> {
  return await updateStockWithMovement(
    productId,
    warehouseId,
    quantity,
    'giriş',
    reason,
    referenceId,
    'manual',
    supplierName,
    productCondition,
    undefined,
    unitPrice,
    currency,
    invoiceFiles
  )
}

/**
 * Stok çıkışı
 */
export async function removeStock(
  productId: string,
  warehouseId: string,
  quantity: number,
  reason?: string,
  referenceId?: string
): Promise<WarehouseStock> {
  return await updateStockWithMovement(
    productId,
    warehouseId,
    -quantity,
    'çıkış',
    reason,
    referenceId,
    'manual'
  )
}

/**
 * Stok transferi
 */
export async function transferStock(
  productId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  quantity: number,
  reason?: string,
  assignedTo?: string
): Promise<{ from: WarehouseStock; to: WarehouseStock }> {
  // Kaynak depodan çıkış
  const fromStock = await updateStockWithMovement(
    productId,
    fromWarehouseId,
    -quantity,
    'transfer',
    `Transfer: ${reason || ''}`,
    toWarehouseId,
    'transfer',
    undefined,
    undefined,
    assignedTo
  )

  // Hedef depoya giriş
  const toStock = await updateStockWithMovement(
    productId,
    toWarehouseId,
    quantity,
    'transfer',
    `Transfer: ${reason || ''}`,
    fromWarehouseId,
    'transfer',
    undefined,
    undefined,
    assignedTo
  )

  return { from: fromStock, to: toStock }
}

/**
 * Stok düzeltme
 */
export async function adjustStock(
  productId: string,
  warehouseId: string,
  newQuantity: number,
  reason: string
): Promise<WarehouseStock> {
  const supabase = createClient()

  // Mevcut stok
  const { data: currentStock } = await supabase
    .from('warehouse_stock')
    .select('quantity')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .single()

  const previousQuantity = currentStock ? parseFloat(currentStock.quantity.toString()) : 0
  const difference = newQuantity - previousQuantity

  return await updateStockWithMovement(
    productId,
    warehouseId,
    difference,
    'düzeltme',
    reason,
    undefined,
    'adjustment'
  )
}

