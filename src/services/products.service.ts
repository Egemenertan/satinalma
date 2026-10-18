/**
 * Products Service
 * Ürün yönetimi için temiz ve optimize edilmiş Supabase sorguları
 */

import { format, subDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
type Brand = Database['public']['Tables']['brands']['Row']
type ProductCategory = Database['public']['Tables']['product_categories']['Row']
type WarehouseStock = Database['public']['Tables']['warehouse_stock']['Row']

export type StatusFilter = 'all' | 'active' | 'inactive' | 'available'

export interface ProductFilters {
  search?: string
  brandId?: string
  siteId?: string
  /** Kısıtlı depo yetkisi: siteId yokken bu depolardaki ürünlerle sınırla */
  allowedWarehouseIds?: string[]
  categoryId?: string
  productType?: string
  isActive?: boolean
  statusFilter?: StatusFilter
  minPrice?: number
  maxPrice?: number
  /**
   * Kısıtlı depo kullanıcısı: listeye o depodaki aktif zimmet ürünleri de girer.
   * Tablodaki adet yöneticide fiziksel stok, görüntülemede zimmet miktarıdır.
   */
  useDepotZimmetQty?: boolean
  /** Seçilen zimmet sahibi. `user:`, `email:` veya `name:` anahtarı. */
  zimmetOwner?: string
}

export interface ZimmetOwnerOption {
  value: string
  label: string
  email: string | null
}

export interface ProductWithDetails extends Omit<Product, 'category'> {
  brand?: Brand | null
  category?: ProductCategory | null
  total_stock?: number
  /** Raftaki adet eksi aynı depodaki zimmet */
  available_stock?: number
  /** Depo id → aktif zimmet adedi */
  zimmet_by_warehouse?: Record<string, number>
  /** Sorumlu depodaki aktif zimmet adedi */
  depot_quantity?: number
  warehouse_stocks?: WarehouseStock[]
}

function productIdRows(rows: unknown): ProductWithDetails[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || !('id' in row)) return []
    const id = (row as { id: unknown }).id
    return typeof id === 'string' ? [{ id } as ProductWithDetails] : []
  })
}

type ScopedWarehouseStock = {
  warehouse_id?: string | null
  user_id?: string | null
  quantity?: number | string | null
}

/** Ana depo satırı: user_id boş. Zimmet sorumluluktur, bu satırın miktarını düşürmez. */
function isMainDepotStockRow(stock: ScopedWarehouseStock) {
  return stock.user_id == null || stock.user_id === undefined
}

function sumMainDepotQty(
  stocks: any[] | undefined,
  warehouseId?: string,
  allowedWarehouseIds?: string[]
): number {
  const allowed =
    allowedWarehouseIds && allowedWarehouseIds.length > 0
      ? new Set(allowedWarehouseIds)
      : null
  return (stocks || [])
    .filter((s: any) => {
      if (!isMainDepotStockRow(s)) return false
      if (warehouseId) return s.warehouse_id === warehouseId
      if (allowed) return s.warehouse_id && allowed.has(s.warehouse_id)
      return true
    })
    .reduce((sum: number, s: any) => sum + (parseFloat(s.quantity) || 0), 0)
}

function scopeWarehouseStocks<T extends ScopedWarehouseStock>(
  stocks: T[] | undefined,
  filters?: ProductFilters
): T[] {
  if (!stocks?.length) return []
  if (filters?.siteId) {
    return stocks.filter((s) => s.warehouse_id === filters.siteId)
  }
  if (filters?.allowedWarehouseIds?.length) {
    const allowed = new Set(filters.allowedWarehouseIds)
    return stocks.filter((s) => s.warehouse_id && allowed.has(s.warehouse_id))
  }
  return stocks
}

/**
 * Depoda hâlâ duran zimmet, stok satırına yazılmışsa tekrar eklenmez.
 * Eski kayıtlarda miktar sıfırlandıysa, o deponun zimmet adedi stoğa dahil edilir.
 */
function zimmetQtyMissingFromDepot(
  inventories: { quantity?: number | string | null; source_warehouse_id?: string | null; parent_inventory_id?: string | null }[] | null,
  stocks: any[] | undefined,
  filters?: ProductFilters
): number {
  const stockByWarehouse = new Map<string, number>()
  for (const stock of scopeWarehouseStocks(stocks, filters)) {
    if (!isMainDepotStockRow(stock) || !stock.warehouse_id) continue
    stockByWarehouse.set(
      stock.warehouse_id,
      (stockByWarehouse.get(stock.warehouse_id) || 0) + (Number(stock.quantity) || 0)
    )
  }

  let extra = 0
  for (const inv of inventories || []) {
    if (inv.parent_inventory_id) continue
    const qty = parseFloat(String(inv.quantity ?? 0)) || 0
    if (!(qty > 0)) continue
    const warehouseId = inv.source_warehouse_id || null
    if (filters?.siteId && warehouseId !== filters.siteId) continue
    if (
      !filters?.siteId &&
      filters?.allowedWarehouseIds?.length &&
      (!warehouseId || !filters.allowedWarehouseIds.includes(warehouseId))
    ) {
      continue
    }
    if (!warehouseId) {
      extra += qty
      continue
    }
    if ((stockByWarehouse.get(warehouseId) || 0) <= 0) extra += qty
  }
  return extra
}

/** Sorumlu depodaki aktif zimmet adedi. Eyüp'te 2 zimmet varsa sonuç 2'dir. */
function sumDepotZimmetQty(
  inventories: { quantity?: number | string | null; source_warehouse_id?: string | null; parent_inventory_id?: string | null }[] | null,
  filters?: ProductFilters
): number {
  if (!filters?.useDepotZimmetQty) return 0
  let total = 0
  for (const inv of inventories || []) {
    if (inv.parent_inventory_id) continue
    const qty = parseFloat(String(inv.quantity ?? 0)) || 0
    if (!(qty > 0)) continue
    const warehouseId = inv.source_warehouse_id || null
    if (filters.siteId) {
      if (warehouseId === filters.siteId) total += qty
      continue
    }
    if (
      filters.allowedWarehouseIds?.length &&
      warehouseId &&
      filters.allowedWarehouseIds.includes(warehouseId)
    ) {
      total += qty
    }
  }
  return total
}

function isDepotScopedList(filters?: ProductFilters) {
  return Boolean(filters?.useDepotZimmetQty) || Boolean(filters?.allowedWarehouseIds?.length)
}

/** Depoda rafta duran (miktarı sıfırdan büyük) ürünler. */
async function productIdsWithPositiveStock(
  supabase: ReturnType<typeof createClient>,
  warehouseIds: string[]
): Promise<string[]> {
  const ids = warehouseIds.filter(Boolean)
  if (ids.length === 0) return []
  let query = supabase.from('warehouse_stock').select('product_id').gt('quantity', 0)
  query = ids.length === 1 ? query.eq('warehouse_id', ids[0]) : query.in('warehouse_id', ids)
  const { data, error } = await query
  if (error) {
    console.error('Depo stok ürünleri okunamadı:', error)
    return []
  }
  return [...new Set((data || []).map((row) => row.product_id).filter(Boolean))]
}

/**
 * Deponun kendi listesi: rafta adedi olanlar ve bu depodan zimmetli olanlar.
 * Miktarı 0 kalan boş stok satırları listeye girmez.
 */
async function productIdsInDepot(
  supabase: ReturnType<typeof createClient>,
  warehouseIds: string[],
  includeZimmet: boolean
): Promise<string[]> {
  const stockIds = await productIdsWithPositiveStock(supabase, warehouseIds)
  if (!includeZimmet) return stockIds
  const zimmetIds = await productIdsZimmettedAt(supabase, warehouseIds)
  return [...new Set([...stockIds, ...zimmetIds])]
}

async function productIdsZimmettedAt(
  supabase: ReturnType<typeof createClient>,
  warehouseIds: string[]
): Promise<string[]> {
  const ids = warehouseIds.filter(Boolean)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('user_inventory')
    .select('product_id')
    .in('source_warehouse_id', ids)
    .eq('status', 'active')
    .gt('quantity', 0)
  if (error) {
    console.error('Depo zimmet ürünleri okunamadı:', error)
    return []
  }
  return [...new Set((data || []).map((row) => row.product_id).filter(Boolean))]
}

function scopedActiveInventory(
  supabase: ReturnType<typeof createClient>,
  warehouseIds: string[]
) {
  let query = supabase
    .from('user_inventory')
    .select('product_id')
    .eq('status', 'active')
    .gt('quantity', 0)
  if (warehouseIds.length === 1) query = query.eq('source_warehouse_id', warehouseIds[0])
  else if (warehouseIds.length > 1) query = query.in('source_warehouse_id', warehouseIds)
  return query
}

async function productIdsFromInventoryQuery(
  query: ReturnType<typeof scopedActiveInventory>
): Promise<string[]> {
  const { data, error } = await query.limit(3000)
  if (error) {
    console.error('Zimmet sahibi ürünleri okunamadı:', error)
    return []
  }
  return (data || []).map((row) => row.product_id).filter((id): id is string => Boolean(id))
}

/** Seçilen kişinin aktif zimmetindeki ürünler. */
async function productIdsForZimmetOwner(
  supabase: ReturnType<typeof createClient>,
  owner: string,
  warehouseIds?: string[]
): Promise<string[]> {
  const raw = owner.trim()
  if (!raw) return []
  const scope = (warehouseIds || []).filter(Boolean)
  const ids = new Set<string>()

  const add = async (query: ReturnType<typeof scopedActiveInventory>) => {
    for (const id of await productIdsFromInventoryQuery(query)) ids.add(id)
  }

  if (raw.startsWith('user:')) {
    const userId = raw.slice(5)
    if (!userId) return []
    await add(scopedActiveInventory(supabase, scope).eq('user_id', userId))
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()
    const email = profile?.email?.trim()
    const name = profile?.full_name?.trim()
    if (email) await add(scopedActiveInventory(supabase, scope).ilike('owner_email', email))
    if (name) await add(scopedActiveInventory(supabase, scope).ilike('owner_name', name))
    return [...ids]
  }

  if (raw.startsWith('email:')) {
    const email = decodeURIComponent(raw.slice(6)).trim()
    if (!email) return []
    await add(scopedActiveInventory(supabase, scope).ilike('owner_email', email))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .limit(5)
    const profileIds = (profiles || []).map((profile) => profile.id).filter(Boolean)
    if (profileIds.length > 0) {
      await add(scopedActiveInventory(supabase, scope).in('user_id', profileIds))
    }
    return [...ids]
  }

  if (raw.startsWith('name:')) {
    const name = decodeURIComponent(raw.slice(5)).trim()
    if (!name) return []
    await add(scopedActiveInventory(supabase, scope).ilike('owner_name', name))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .ilike('full_name', name)
      .limit(5)
    const profileIds = (profiles || []).map((profile) => profile.id).filter(Boolean)
    if (profileIds.length > 0) {
      await add(scopedActiveInventory(supabase, scope).in('user_id', profileIds))
    }
    return [...ids]
  }

  const safe = sanitizeSearchTerm(raw)
  if (!safe) return []
  const pattern = `%${safe}%`
  await add(
    scopedActiveInventory(supabase, scope).or(
      `owner_name.ilike."${pattern}",owner_email.ilike."${pattern}"`
    )
  )
  return [...ids]
}

/** Aktif zimmeti olan kişiler. Dropdown bu listeyi gösterir. */
export async function fetchZimmetOwnerOptions(warehouseIds?: string[]): Promise<ZimmetOwnerOption[]> {
  const supabase = createClient()
  const scope = (warehouseIds || []).filter(Boolean)
  const rows: {
    user_id: string | null
    owner_name: string | null
    owner_email: string | null
  }[] = []

  for (let from = 0; from < 8000; from += 1000) {
    let query = supabase
      .from('user_inventory')
      .select('user_id, owner_name, owner_email')
      .eq('status', 'active')
      .gt('quantity', 0)
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (scope.length === 1) query = query.eq('source_warehouse_id', scope[0])
    else if (scope.length > 1) query = query.in('source_warehouse_id', scope)

    const { data, error } = await query
    if (error) {
      console.error('Zimmetli kişiler okunamadı:', error)
      break
    }
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const missingProfileIds = [
    ...new Set(rows.filter((row) => row.user_id && !row.owner_name?.trim()).map((row) => row.user_id as string)),
  ]
  const profiles = new Map<string, { name: string; email: string | null }>()
  for (let index = 0; index < missingProfileIds.length; index += 100) {
    const chunk = missingProfileIds.slice(index, index + 100)
    const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', chunk)
    for (const profile of data || []) {
      profiles.set(profile.id, {
        name: (profile.full_name || '').trim(),
        email: profile.email?.trim() || null,
      })
    }
  }

  const options = new Map<string, ZimmetOwnerOption>()
  for (const row of rows) {
    const profile = row.user_id ? profiles.get(row.user_id) : undefined
    const name = (row.owner_name || profile?.name || '').trim()
    const email = (row.owner_email || profile?.email || '').trim()
    let value = ''
    if (row.user_id) value = `user:${row.user_id}`
    else if (email) value = `email:${encodeURIComponent(email)}`
    else if (name) value = `name:${encodeURIComponent(name)}`
    if (!value) continue

    const current = options.get(value)
    const label = name || email || 'İsimsiz'
    if (!current || (current.label === 'İsimsiz' && label !== 'İsimsiz')) {
      options.set(value, { value, label, email: email || current?.email || null })
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'tr'))
}

function collectZimmetByWarehouse(
  inventories: { quantity?: number | string | null; source_warehouse_id?: string | null; parent_inventory_id?: string | null }[] | null
) {
  const zimmetByWarehouse = new Map<string, number>()
  for (const inv of inventories || []) {
    if (inv.parent_inventory_id) continue
    const qty = parseFloat(String(inv.quantity ?? 0)) || 0
    if (!(qty > 0)) continue
    const warehouseId = inv.source_warehouse_id || null
    if (!warehouseId) continue
    zimmetByWarehouse.set(warehouseId, (zimmetByWarehouse.get(warehouseId) || 0) + qty)
  }
  return zimmetByWarehouse
}

/** Raftaki adetten, aynı depodaki zimmet düşülür. 4 adetten 1’i zimmetliyse stokta 3 kalır. */
function availableStockQty(
  product: any,
  inventories: { quantity?: number | string | null; source_warehouse_id?: string | null; parent_inventory_id?: string | null }[] | null,
  filters?: ProductFilters
) {
  const shelfByWarehouse = new Map<string, number>()
  for (const stock of scopeWarehouseStocks(product.warehouse_stocks, filters)) {
    if (!isMainDepotStockRow(stock) || !stock.warehouse_id) continue
    const qty = Number(stock.quantity) || 0
    shelfByWarehouse.set(stock.warehouse_id, (shelfByWarehouse.get(stock.warehouse_id) || 0) + qty)
  }

  const zimmetByWarehouse = collectZimmetByWarehouse(inventories)

  let free = 0
  for (const [warehouseId, shelf] of shelfByWarehouse) {
    if (filters?.siteId && warehouseId !== filters.siteId) continue
    if (
      !filters?.siteId &&
      filters?.allowedWarehouseIds?.length &&
      !filters.allowedWarehouseIds.includes(warehouseId)
    ) {
      continue
    }
    free += Math.max(0, shelf - (zimmetByWarehouse.get(warehouseId) || 0))
  }
  return free
}
function totalStockForProductList(
  product: any,
  inventories: { quantity?: number | string | null; source_warehouse_id?: string | null; parent_inventory_id?: string | null }[] | null,
  filters?: ProductFilters
) {
  const scopedStocks = scopeWarehouseStocks(product.warehouse_stocks, filters)
  const warehouseScoped = sumMainDepotQty(
    scopedStocks,
    filters?.siteId,
    filters?.allowedWarehouseIds
  )
  if (filters?.statusFilter === 'available') {
    return warehouseScoped
  }
  return warehouseScoped + zimmetQtyMissingFromDepot(inventories, product.warehouse_stocks, filters)
}

const PRODUCT_LIST_SELECT = `
  *,
  brand:brands(*),
  category:product_categories(*),
  warehouse_stocks:warehouse_stock(
    *,
    warehouse:sites(id, name)
  )
`

function sanitizeSearchTerm(value: string) {
  return value.replace(/[%_,()"]/g, ' ').replace(/\s+/g, ' ').trim()
}

function emptyProductPage(page: number) {
  return { products: [] as ProductWithDetails[], totalCount: 0, totalPages: 0, currentPage: page }
}

async function attachInventoryTotals(
  supabase: ReturnType<typeof createClient>,
  products: any[],
  filters?: ProductFilters
) {
  if (products.length === 0) return []
  const ids = products.map((product) => product.id).filter(Boolean)
  const { data: inventories } = await supabase
    .from('user_inventory')
    .select('product_id, quantity, source_warehouse_id, parent_inventory_id')
    .in('product_id', ids)
    .eq('status', 'active')

  const byProduct = new Map<string, NonNullable<typeof inventories>>()
  for (const row of inventories || []) {
    if (!row.product_id) continue
    const list = byProduct.get(row.product_id) || []
    list.push(row)
    byProduct.set(row.product_id, list)
  }

  return products.map((product) => {
    const productInventories = byProduct.get(product.id) || []
    return {
      ...product,
      warehouse_stocks: scopeWarehouseStocks(product.warehouse_stocks, filters),
      total_stock: totalStockForProductList(product, productInventories, filters),
      available_stock: availableStockQty(product, productInventories, filters),
      zimmet_by_warehouse: Object.fromEntries(collectZimmetByWarehouse(productInventories)),
      depot_quantity: sumDepotZimmetQty(productInventories, filters),
    }
  })
}

/**
 * Ad veya SKU araması tek sorguda, sayfa boyutunda döner.
 * Eşleşen tüm kimlikleri çekip sonra filtrelemek yerine veritabanı sınırlar.
 */
async function fetchProductsByTextSearch(
  supabase: ReturnType<typeof createClient>,
  filters: ProductFilters | undefined,
  searchTerm: string,
  page: number,
  pageSize: number,
  idsOnly = false
) {
  const safe = sanitizeSearchTerm(searchTerm)
  if (!safe) return emptyProductPage(page)

  const pattern = `%${safe}%`
  const orParts = [`name.ilike."${pattern}"`, `sku.ilike."${pattern}"`]

  const warehouseIds = filters?.siteId
    ? [filters.siteId]
    : filters?.allowedWarehouseIds || []
  const constrainStock =
    !filters?.zimmetOwner?.trim() &&
    (warehouseIds.length > 0 || filters?.statusFilter === 'available')
  const select = idsOnly
    ? constrainStock
      ? 'id, warehouse_stocks:warehouse_stock!inner(warehouse_id)'
      : 'id'
    : constrainStock
      ? PRODUCT_LIST_SELECT.replace('warehouse_stock(', 'warehouse_stock!inner(')
      : PRODUCT_LIST_SELECT

  let query = supabase
    .from('products')
    .select(select, { count: 'exact' })
    .or(orParts.join(','))
    .order('created_at', { ascending: false })

  if (warehouseIds.length === 1) {
    query = query.eq('warehouse_stocks.warehouse_id', warehouseIds[0])
  } else if (warehouseIds.length > 1) {
    query = query.in('warehouse_stocks.warehouse_id', warehouseIds)
  }

  if (filters?.statusFilter === 'available') {
    query = query.is('warehouse_stocks.user_id', null).gt('warehouse_stocks.quantity', 0)
  }

  if (filters?.zimmetOwner?.trim()) {
    const ownerIds = await productIdsForZimmetOwner(
      supabase,
      filters.zimmetOwner,
      warehouseIds
    )
    if (ownerIds.length === 0) return emptyProductPage(page)
    query = query.in('id', ownerIds)
  }

  if (filters?.brandId) query = query.eq('brand_id', filters.brandId)
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters?.productType) query = query.eq('product_type', filters.productType)
  if (filters?.statusFilter === 'available') {
    query = query.eq('is_active', true)
  } else if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }
  if (filters?.minPrice !== undefined) query = query.gte('unit_price', filters.minPrice)
  if (filters?.maxPrice !== undefined) query = query.lte('unit_price', filters.maxPrice)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Ürün araması başarısız:', error)
    throw error
  }

  if (idsOnly) {
    return {
      products: productIdRows(data),
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page,
    }
  }

  const products = await attachInventoryTotals(supabase, data || [], filters)
  return {
    products: products as ProductWithDetails[],
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    currentPage: page,
  }
}

/**
 * Ürünleri listele (filtreleme ve pagination ile)
 */
export async function fetchProducts(
  filters?: ProductFilters,
  page = 1,
  pageSize = 20,
  idsOnly = false
) {
  const supabase = createClient()
  const searchTerm = filters?.search?.trim()

  // Depoya bağlı kullanıcı henüz depo seçmeden tüm kataloğu görmesin.
  if (
    filters?.useDepotZimmetQty &&
    !filters.siteId &&
    Array.isArray(filters.allowedWarehouseIds) &&
    filters.allowedWarehouseIds.length === 0
  ) {
    return { products: [], totalCount: 0, totalPages: 0, currentPage: page }
  }
  
  if (searchTerm) {
    return fetchProductsByTextSearch(supabase, filters, searchTerm, page, pageSize, idsOnly)
  }

  let ownerProductIds: string[] | null = null
  if (filters?.zimmetOwner?.trim()) {
    ownerProductIds = await productIdsForZimmetOwner(
      supabase,
      filters.zimmetOwner,
      filters.siteId ? [filters.siteId] : filters.allowedWarehouseIds
    )
    if (ownerProductIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0, currentPage: page }
    }
  }

  // Kişi filtresi varsa liste yalnızca o zimmetten gelir. Depo kapsamı sorguya zaten uygulanır.
  let siteProductIds: string[] | null = null
  if (ownerProductIds) {
    siteProductIds = ownerProductIds
  } else if (filters?.siteId && isDepotScopedList(filters)) {
    siteProductIds = await productIdsInDepot(
      supabase,
      [filters.siteId],
      Boolean(filters.useDepotZimmetQty)
    )
    if (siteProductIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }
  } else if (filters?.siteId) {
    const { data: stockProducts } = await supabase
      .from('warehouse_stock')
      .select('product_id')
      .eq('warehouse_id', filters.siteId)

    siteProductIds = stockProducts?.map((s) => s.product_id) || []
    if (siteProductIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }
  } else if (filters?.allowedWarehouseIds?.length) {
    siteProductIds = await productIdsInDepot(
      supabase,
      filters.allowedWarehouseIds,
      Boolean(filters.useDepotZimmetQty)
    )
    if (siteProductIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }
  }
  
  // "Mevcut Olanlar": depoda fiziksel miktarı olan ürünler (zimmet depodan düşülmez)
  let availableProductIds: string[] | null = null
  if (filters?.statusFilter === 'available') {
    let stockQuery = supabase
      .from('warehouse_stock')
      .select('product_id')
      .is('user_id', null)
      .gt('quantity', 0)

    if (filters?.siteId) {
      stockQuery = stockQuery.eq('warehouse_id', filters.siteId)
    } else if (filters?.allowedWarehouseIds?.length) {
      stockQuery = stockQuery.in('warehouse_id', filters.allowedWarehouseIds)
    }

    const { data: stockData } = await stockQuery

    if (!stockData || stockData.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }

    availableProductIds = [...new Set(stockData.map((s) => s.product_id))]

    console.log('🏷️ Mevcut Olanlar filtresi:', {
      serbest_urun_sayisi: availableProductIds.length,
    })

    if (siteProductIds) {
      siteProductIds = siteProductIds.filter((id) => availableProductIds!.includes(id))
    } else {
      siteProductIds = availableProductIds
    }

    if (siteProductIds.length === 0) {
      return { products: [], totalCount: 0, totalPages: 0 }
    }
  }

  let query = supabase
    .from('products')
    .select(
      idsOnly
        ? 'id'
        : `
      *,
      brand:brands(*),
      category:product_categories(*),
      warehouse_stocks:warehouse_stock(
        *,
        warehouse:sites(id, name)
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  // Site veya available filtresi uygula (varsa)
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

  // isActive filtresi - "available" modunda aktif ürünleri göster
  if (filters?.statusFilter === 'available') {
    query = query.eq('is_active', true)
  } else if (filters?.isActive !== undefined) {
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

  if (idsOnly) {
    return {
      products: productIdRows(data),
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page,
    }
  }

  const productsWithStock = await attachInventoryTotals(supabase, data || [], filters)

  return {
    products: productsWithStock as ProductWithDetails[],
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    currentPage: page,
  }
}

/** Filtreye uyan tüm ürün kimlikleri. Sayfa sınırı yoktur. */
export async function fetchAllFilteredProductIds(filters?: ProductFilters): Promise<string[]> {
  const ids: string[] = []
  const pageSize = 500
  for (let page = 1; page <= 20; page += 1) {
    const result = await fetchProducts(filters, page, pageSize, true)
    for (const product of result.products) {
      if (product.id) ids.push(product.id)
    }
    if (page >= result.totalPages || result.products.length === 0) break
  }
  return [...new Set(ids)]
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

  const { data: inventories } = await supabase
    .from('user_inventory')
    .select('quantity, source_warehouse_id, parent_inventory_id')
    .eq('product_id', id)
    .eq('status', 'active')

  const totalStock = totalStockForProductList(data, inventories)
  const availableStock = availableStockQty(data, inventories)
  const zimmetByWarehouse = Object.fromEntries(collectZimmetByWarehouse(inventories))

  return {
    ...data,
    total_stock: totalStock,
    available_stock: availableStock,
    zimmet_by_warehouse: zimmetByWarehouse,
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
        topProducts: [],
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

  // En çok stoklu 100 ürün
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
  
  // En çok stoklu 100 ürünü seç
  const topProducts = productsWithStock
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 100)

  return {
    totalProducts: totalProducts || 0,
    lowStockCount: lowStockProducts?.length || 0,
    totalValue: Math.round(totalValue * 100) / 100,
    topProducts
  }
}

/** Günlük grafik serisi (ürünler sayfası özet) */
export interface ProductsDailyPoint {
  dayKey: string
  label: string
  newProducts: number
  stockInQty: number
}

export interface ProductsInsightsBundle {
  stats: {
    totalProducts: number
    lowStockCount: number
    totalValue: number
    totalStockUnits: number
  }
  dailyPoints: ProductsDailyPoint[]
}

function productsDayKeyFromIso(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso.trim())
  if (m) return m[1]
  return format(new Date(iso), 'yyyy-MM-dd')
}

function buildProductsDailyShell(): ProductsDailyPoint[] {
  const out: ProductsDailyPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = subDays(new Date(), i)
    const dayKey = format(d, 'yyyy-MM-dd')
    out.push({
      dayKey,
      label: format(d, 'd MMM', { locale: tr }),
      newProducts: 0,
      stockInQty: 0,
    })
  }
  return out
}

function mergeProductTrendRows(
  shell: ProductsDailyPoint[],
  creations: { created_at: string }[] | null,
  movements: { created_at: string; quantity: number | null }[] | null
): ProductsDailyPoint[] {
  const map = new Map(shell.map(d => [d.dayKey, { ...d }]))
  for (const c of creations || []) {
    const k = productsDayKeyFromIso(c.created_at)
    const row = map.get(k)
    if (row) row.newProducts += 1
  }
  for (const m of movements || []) {
    const k = productsDayKeyFromIso(m.created_at)
    const row = map.get(k)
    if (row) row.stockInQty += Math.abs(Number(m.quantity) || 0)
  }
  return shell.map(d => map.get(d.dayKey)!)
}

/**
 * Ürünler dashboard kartları + 30 günlük trend + top stok
 */
export async function fetchProductsInsightsBundle(siteId?: string): Promise<ProductsInsightsBundle> {
  const statsBase = await fetchProductStats(siteId)
  const shell = buildProductsDailyShell()
  const supabase = createClient()

  let productIds: string[] | undefined
  if (siteId) {
    const { data: stockProducts } = await supabase
      .from('warehouse_stock')
      .select('product_id')
      .eq('warehouse_id', siteId)
    productIds = [...new Set((stockProducts || []).map(s => s.product_id))]
    if (productIds.length === 0) {
      return {
        stats: {
          totalProducts: 0,
          lowStockCount: 0,
          totalValue: 0,
          totalStockUnits: 0,
        },
        dailyPoints: shell,
      }
    }
  }

  const windowStart = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  let pq = supabase
    .from('products')
    .select('created_at')
    .eq('is_active', true)
    .gte('created_at', `${windowStart}T00:00:00`)
  if (productIds) pq = pq.in('id', productIds)
  const { data: recentCreations } = await pq

  let mq = supabase
    .from('stock_movements')
    .select('created_at, quantity')
    .eq('movement_type', 'giriş')
    .gte('created_at', `${windowStart}T00:00:00`)
  if (siteId) mq = mq.eq('warehouse_id', siteId)
  const { data: movements } = await mq

  let sq = supabase.from('warehouse_stock').select('quantity')
  if (siteId) sq = sq.eq('warehouse_id', siteId)
  const { data: stocks } = await sq
  const totalStockUnits = Math.round((stocks || []).reduce((s, r) => s + Number(r.quantity || 0), 0))

  const dailyPoints = mergeProductTrendRows(shell, recentCreations, movements)

  return {
    stats: {
      totalProducts: statsBase.totalProducts,
      lowStockCount: statsBase.lowStockCount,
      totalValue: statsBase.totalValue,
      totalStockUnits,
    },
    dailyPoints,
  }
}

