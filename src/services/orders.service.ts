/**
 * Orders Service
 * Sipariş verilerini Supabase'den çeken servis katmanı
 */

import { createClient } from '@/lib/supabase/client'
import type { OrderData, OrdersResponse, OrderFilters } from '@/app/dashboard/orders/types'

/**
 * Siparişleri getir (pagination ve filtreleme ile)
 */
export async function fetchOrders(filters: OrderFilters): Promise<OrdersResponse> {
  const supabase = createClient()
  const { page, pageSize, searchTerm, statusFilter, siteFilter, dateRange } = filters

  // Kullanıcı rolünü ve site bilgisini kontrol et
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id')
    .eq('id', user.id)
    .single()

  // Sadece purchasing_officer, admin ve manager erişebilir
  const allowedRoles = ['purchasing_officer', 'admin', 'manager']
  if (!allowedRoles.includes(profile?.role)) {
    throw new Error('Bu sayfaya erişim yetkiniz yoktur')
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 1: Arama filtresi → eşleşen order ID'leri (null = filtre yok)
  // ─────────────────────────────────────────────────────────────
  let searchMatchIds: Set<string> | null = null

  if (searchTerm && searchTerm.trim()) {
    const search = searchTerm.trim().toLowerCase()
    console.log('🔍 Arama yapılıyor:', search)

    // Türkçe karakterleri normalize et
    const normalizeTurkish = (text: string): string =>
      text
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'c')

    const normalizedSearch = normalizeTurkish(search)
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0)

    // Tüm orderları paginated olarak çek (Supabase 1000 limit aşımını önlemek için)
    let allOrders: any[] = []
    let from = 0
    const batchSize = 1000

    while (true) {
      const { data: batch, error } = await supabase
        .from('orders')
        .select(`
          id,
          quantity,
          purchase_request_id,
          suppliers!orders_supplier_id_fkey (name),
          purchase_requests!orders_purchase_request_id_fkey (title, request_number),
          purchase_request_items!fk_orders_material_item_id (item_name, brand, specifications, unit)
        `)
        .range(from, from + batchSize - 1)

      if (error) {
        console.error('❌ Arama batch hatası:', error)
        throw error
      }

      if (!batch || batch.length === 0) break
      allOrders = allOrders.concat(batch)
      if (batch.length < batchSize) break
      from += batchSize
    }

    console.log(`✅ Toplam ${allOrders.length} order çekildi (arama için)`)

    searchMatchIds = new Set(
      allOrders
        .filter((order: any) => {
          const fields = [
            order.suppliers?.name,
            order.purchase_requests?.title,
            order.purchase_requests?.request_number,
            order.purchase_request_items?.item_name,
            order.purchase_request_items?.brand,
            order.purchase_request_items?.specifications,
            order.quantity ? `${order.quantity}` : null,
            order.purchase_request_items?.unit,
            order.quantity && order.purchase_request_items?.unit
              ? `${order.quantity} ${order.purchase_request_items.unit}`
              : null,
          ]
          const combined = normalizeTurkish(
            fields.filter(f => f && typeof f === 'string').join(' ')
          )
          return searchWords.every(word => combined.includes(word))
        })
        .map((o: any) => o.id)
    )

    console.log('✅ Arama sonucu:', searchMatchIds.size, 'sipariş eşleşti')
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 2: Şantiye filtresi → eşleşen order ID'leri (null = filtre yok)
  // ─────────────────────────────────────────────────────────────
  let siteMatchIds: Set<string> | null = null

  if (siteFilter && siteFilter.length > 0) {
    console.log('🏗️ Şantiye filtresi uygulanıyor:', siteFilter)

    // Tüm orderları paginated çek (site_name bilgisiyle)
    let allSiteOrders: any[] = []
    let from = 0
    const batchSize = 1000

    while (true) {
      const { data: batch, error } = await supabase
        .from('orders')
        .select('id, purchase_requests!orders_purchase_request_id_fkey(site_name)')
        .range(from, from + batchSize - 1)

      if (error) {
        console.error('❌ Şantiye batch hatası:', error)
        throw error
      }

      if (!batch || batch.length === 0) break
      allSiteOrders = allSiteOrders.concat(batch)
      if (batch.length < batchSize) break
      from += batchSize
    }

    siteMatchIds = new Set(
      allSiteOrders
        .filter((order: any) => {
          const siteName = order.purchase_requests?.site_name
          return siteName && siteFilter.includes(siteName)
        })
        .map((o: any) => o.id)
    )

    console.log('✅ Şantiye filtresi sonucu:', siteMatchIds.size, 'sipariş eşleşti')
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 3: Kesişim (intersection) - her iki filtre de aktifse
  // ─────────────────────────────────────────────────────────────
  let combinedIds: string[] | null = null

  if (searchMatchIds !== null && siteMatchIds !== null) {
    // Her iki filtre de aktif → kesişim al
    combinedIds = [...searchMatchIds].filter(id => siteMatchIds!.has(id))
    console.log(`🔀 Kesişim: ${combinedIds.length} sipariş (arama: ${searchMatchIds.size}, şantiye: ${siteMatchIds.size})`)
  } else if (searchMatchIds !== null) {
    combinedIds = [...searchMatchIds]
  } else if (siteMatchIds !== null) {
    combinedIds = [...siteMatchIds]
  }
  // combinedIds === null ise hiç ID filtresi yok, normal sayfalama yapılır

  // Hiç sonuç yoksa erken dön
  if (combinedIds !== null && combinedIds.length === 0) {
    return { orders: [], totalCount: 0, totalPages: 0 }
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 4: Ana sorguyu oluştur
  // ─────────────────────────────────────────────────────────────
  let query = supabase
    .from('orders')
    .select(`
      id,
      purchase_request_id,
      supplier_id,
      delivery_date,
      amount,
      currency,
      quantity,
      returned_quantity,
      return_notes,
      is_return_reorder,
      status,
      is_delivered,
      created_at,
      material_item_id,
      delivered_at,
      suppliers!orders_supplier_id_fkey (
        name,
        contact_person,
        phone,
        email
      ),
      purchase_requests!orders_purchase_request_id_fkey (
        title,
        request_number,
        site_name,
        status
      ),
      purchase_request_items!fk_orders_material_item_id (
        item_name,
        unit,
        brand,
        specifications
      ),
      invoices (
        id,
        amount,
        currency,
        invoice_photos,
        created_at,
        parent_invoice_id,
        is_master,
        subtotal,
        discount,
        tax,
        grand_total,
        invoice_group_id,
        notes
      ),
      order_deliveries (
        delivery_photos,
        delivered_at
      )
    `, { count: 'exact' })

  // ─────────────────────────────────────────────────────────────
  // ADIM 5: ID filtresi uygula (tek .in() çağrısı)
  // ─────────────────────────────────────────────────────────────
  if (combinedIds !== null) {
    // Pagination → sadece bu sayfanın ID'leri
    const totalCount = combinedIds.length
    const totalPages = Math.ceil(totalCount / pageSize)
    const from = (page - 1) * pageSize
    const pageIds = combinedIds.slice(from, from + pageSize)

    console.log(`📄 Sayfa ${page}: ${pageIds.length} sipariş (toplam ${totalCount})`)

    if (pageIds.length === 0) {
      return { orders: [], totalCount, totalPages }
    }

    query = query.in('id', pageIds)

    // Durum filtresi
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    // Tarih filtresi
    if (dateRange.from || dateRange.to) {
      if (dateRange.from && dateRange.to) {
        const start = new Date(dateRange.from)
        const end = new Date(dateRange.to)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        query = query.gte('delivery_date', start.toISOString().split('T')[0])
        query = query.lte('delivery_date', end.toISOString().split('T')[0])
      } else if (dateRange.from) {
        const start = new Date(dateRange.from)
        start.setHours(0, 0, 0, 0)
        query = query.gte('delivery_date', start.toISOString().split('T')[0])
      } else if (dateRange.to) {
        const end = new Date(dateRange.to)
        end.setHours(23, 59, 59, 999)
        query = query.lte('delivery_date', end.toISOString().split('T')[0])
      }
    }

    query = query.order('created_at', { ascending: false })

    console.log('🔍 Query çalıştırılıyor...')
    const { data, error } = await query

    if (error) {
      console.error('❌ Sipariş verisi alınırken hata:', error)
      throw new Error(`Sipariş verileri alınamadı: ${error.message}`)
    }

    console.log(`✅ Query başarılı: ${data?.length || 0} sipariş döndü`)

    const ordersWithInvoices = (data || []).map((order: any) => formatOrder(order))

    return { orders: ordersWithInvoices, totalCount, totalPages }
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 6: ID filtresi yok → normal sayfalama
  // ─────────────────────────────────────────────────────────────

  // Durum filtresi
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  // Tarih filtresi
  if (dateRange.from || dateRange.to) {
    if (dateRange.from && dateRange.to) {
      const start = new Date(dateRange.from)
      const end = new Date(dateRange.to)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      query = query.gte('delivery_date', start.toISOString().split('T')[0])
      query = query.lte('delivery_date', end.toISOString().split('T')[0])
    } else if (dateRange.from) {
      const start = new Date(dateRange.from)
      start.setHours(0, 0, 0, 0)
      query = query.gte('delivery_date', start.toISOString().split('T')[0])
    } else if (dateRange.to) {
      const end = new Date(dateRange.to)
      end.setHours(23, 59, 59, 999)
      query = query.lte('delivery_date', end.toISOString().split('T')[0])
    }
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)
  console.log(`📄 Normal pagination: ${from} - ${to}`)

  query = query.order('created_at', { ascending: false })

  console.log('🔍 Query çalıştırılıyor...')
  const { data, error, count } = await query

  if (error) {
    console.error('❌ Sipariş verisi alınırken hata:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      fullError: error
    })
    throw new Error(`Sipariş verileri alınamadı: ${error.message}`)
  }

  console.log(`✅ Query başarılı: ${data?.length || 0} sipariş döndü`)

  const ordersWithInvoices = (data || []).map((order: any) => formatOrder(order))

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  console.log(`📊 Toplam: ${totalCount} sipariş, ${totalPages} sayfa`)

  return { orders: ordersWithInvoices, totalCount, totalPages }
}

/**
 * Order verisini formatla (teslimat fotoğrafları vs.)
 */
function formatOrder(order: any): OrderData {
  const deliveryPhotosArrays: string[][] = (order.order_deliveries || [])
    .map((d: { delivery_photos?: string[] | null }) => d.delivery_photos || [])
  const flattenedDeliveryPhotos: string[] = deliveryPhotosArrays.flat().filter(Boolean)
  const lastDeliveredAt = order.order_deliveries?.[0]?.delivered_at || order.delivered_at

  return {
    ...order,
    suppliers: order.suppliers || null,
    purchase_requests: order.purchase_requests || null,
    purchase_request_items: order.purchase_request_items || null,
    invoices: order.invoices || [],
    delivery_image_urls: flattenedDeliveryPhotos,
    delivered_at: lastDeliveredAt,
    order_deliveries: undefined
  } as OrderData
}
