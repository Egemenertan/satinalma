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

  // ─────────────────────────────────────────────────────────────
  // Kullanıcı rolünü ve site yetkilerini al
  // ─────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id')
    .eq('id', user.id)
    .single()

  // Sadece purchasing_officer ve manager erişebilir
  const allowedRoles = ['purchasing_officer', 'manager']
  if (!allowedRoles.includes(profile?.role)) {
    throw new Error('Bu sayfaya erişim yetkiniz yoktur')
  }

  // Manager tüm siteleri görür; purchasing_officer yalnızca kendi sitelerini
  const isManager = profile?.role === 'manager'
  // site_id kolonu UUID[] (array) — manager'da null/boş olabilir
  const userSiteIds: string[] = isManager ? [] : (profile?.site_id ?? [])

  console.log(`👤 Rol: ${profile?.role} | Site ID'leri:`, isManager ? 'TÜMÜ' : userSiteIds)

  // purchasing_officer hiç siteye atanmamışsa hiç sipariş gösterme
  if (!isManager && userSiteIds.length === 0) {
    console.warn('⚠️ Kullanıcıya hiç site atanmamış, boş liste döndürülüyor')
    return { orders: [], totalCount: 0, totalPages: 0 }
  }

  // ─────────────────────────────────────────────────────────────
  // Yardımcı: purchase_requests üzerinden izin verilen order ID setini
  // oluştur. Manager → null (filtre yok), PO → site_id'ye göre filtreli.
  // ─────────────────────────────────────────────────────────────
  async function getAllowedOrderIds(): Promise<Set<string> | null> {
    if (isManager) return null // null = kısıt yok

    // Kullanıcının site_id'lerine ait purchase_request'leri bul,
    // oradan da order id'lerini çek
    let allowedOrderIds: string[] = []
    let from = 0
    const batchSize = 1000

    while (true) {
      const { data: batch, error } = await supabase
        .from('orders')
        .select('id, purchase_requests!orders_purchase_request_id_fkey(site_id)')
        .range(from, from + batchSize - 1)

      if (error) {
        console.error('❌ Site yetki batch hatası:', error)
        throw error
      }

      if (!batch || batch.length === 0) break

      const matchingIds = batch
        .filter((order: any) => {
          const siteid = order.purchase_requests?.site_id
          return siteid && userSiteIds.includes(siteid)
        })
        .map((o: any) => o.id)

      allowedOrderIds = allowedOrderIds.concat(matchingIds)

      if (batch.length < batchSize) break
      from += batchSize
    }

    console.log(`✅ Kullanıcının erişebildiği ${allowedOrderIds.length} order bulundu`)
    return new Set(allowedOrderIds)
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 1: Site yetki filtresi (en temel kısıt)
  // ─────────────────────────────────────────────────────────────
  const allowedOrderSet = await getAllowedOrderIds()

  // PO ise ama hiç order bulunamadıysa
  if (!isManager && allowedOrderSet !== null && allowedOrderSet.size === 0) {
    return { orders: [], totalCount: 0, totalPages: 0 }
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 2: Arama filtresi → eşleşen order ID'leri (null = filtre yok)
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

    // Sadece yetkili orderlar içinde ara
    let from = 0
    const batchSize = 1000
    let allOrders: any[] = []

    while (true) {
      let batchQuery = supabase
        .from('orders')
        .select(`
          id,
          quantity,
          purchase_request_id,
          suppliers!orders_supplier_id_fkey (name),
          purchase_requests!orders_purchase_request_id_fkey (title, request_number, site_id),
          purchase_request_items!fk_orders_material_item_id (item_name, brand, specifications, unit)
        `)
        .range(from, from + batchSize - 1)

      const { data: batch, error } = await batchQuery

      if (error) {
        console.error('❌ Arama batch hatası:', error)
        throw error
      }

      if (!batch || batch.length === 0) break

      // Yetki filtresi: PO ise sadece kendi sitelerine ait orderları tut
      const filtered = !isManager
        ? batch.filter((o: any) => {
          const siteid = o.purchase_requests?.site_id
          return siteid && userSiteIds.includes(siteid)
        })
        : batch

      allOrders = allOrders.concat(filtered)
      if (batch.length < batchSize) break
      from += batchSize
    }

    console.log(`✅ Arama için ${allOrders.length} order çekildi`)

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
  // ADIM 3: Şantiye filtresi → eşleşen order ID'leri (null = filtre yok)
  // ─────────────────────────────────────────────────────────────
  let siteMatchIds: Set<string> | null = null

  if (siteFilter && siteFilter.length > 0) {
    console.log('🏗️ Şantiye filtresi uygulanıyor:', siteFilter)

    let allSiteOrders: any[] = []
    let from = 0
    const batchSize = 1000

    while (true) {
      const { data: batch, error } = await supabase
        .from('orders')
        .select('id, purchase_requests!orders_purchase_request_id_fkey(site_name, site_id)')
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
          // Hem şantiye adı filtresine uysun hem de yetkili site olsun
          const siteId = order.purchase_requests?.site_id
          const isAllowed = isManager || (siteId && userSiteIds.includes(siteId))
          return siteName && siteFilter.includes(siteName) && isAllowed
        })
        .map((o: any) => o.id)
    )

    console.log('✅ Şantiye filtresi:', siteMatchIds.size, 'sipariş')
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 4: Tüm filtrelerin kesişimi
  // ─────────────────────────────────────────────────────────────
  // Başlangıç seti: site yetki seti (manager için null = sınırsız)
  let combinedIds: string[] | null = null

  // Aktif olan tüm ID setlerini listele (null olanlar "filtre yok" anlamına gelir)
  const activeSets: Set<string>[] = []
  if (allowedOrderSet !== null) activeSets.push(allowedOrderSet)
  if (searchMatchIds !== null) activeSets.push(searchMatchIds)
  if (siteMatchIds !== null) activeSets.push(siteMatchIds)

  if (activeSets.length > 0) {
    // En küçük setten başlayarak kesişim al (performans için)
    const sorted = [...activeSets].sort((a, b) => a.size - b.size)
    let intersection = [...sorted[0]]
    for (let i = 1; i < sorted.length; i++) {
      intersection = intersection.filter(id => sorted[i].has(id))
    }
    combinedIds = intersection
    console.log(`🔀 Kesişim sonucu: ${combinedIds.length} sipariş`)
  }

  // Hiç sonuç kalmadıysa erken dön
  if (combinedIds !== null && combinedIds.length === 0) {
    return { orders: [], totalCount: 0, totalPages: 0 }
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 5: Ana sorguyu oluştur
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
  // ADIM 6: ID filtresi + pagination uygula
  // ─────────────────────────────────────────────────────────────
  if (combinedIds !== null) {
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
    query = buildDateQuery(query, dateRange)

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('❌ Sipariş verisi alınırken hata:', error)
      throw new Error(`Sipariş verileri alınamadı: ${error.message}`)
    }

    console.log(`✅ Query başarılı: ${data?.length || 0} sipariş döndü`)

    return {
      orders: (data || []).map(formatOrder),
      totalCount,
      totalPages
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ADIM 7: ID filtresi yok (manager, tüm filtreler boş) → normal sayfalama
  // ─────────────────────────────────────────────────────────────

  // Durum filtresi
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  // Tarih filtresi
  query = buildDateQuery(query, dateRange)

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)
  console.log(`📄 Normal pagination: ${from} - ${to}`)

  query = query.order('created_at', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error('❌ Sipariş verisi alınırken hata:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw new Error(`Sipariş verileri alınamadı: ${error.message}`)
  }

  console.log(`✅ Query başarılı: ${data?.length || 0} sipariş döndü`)

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  console.log(`📊 Toplam: ${totalCount} sipariş, ${totalPages} sayfa`)

  return {
    orders: (data || []).map(formatOrder),
    totalCount,
    totalPages
  }
}

/**
 * Tarih filtresini sorguya uygula
 */
function buildDateQuery(query: any, dateRange: { from?: Date | null, to?: Date | null }): any {
  if (!dateRange.from && !dateRange.to) return query

  if (dateRange.from && dateRange.to) {
    const start = new Date(dateRange.from)
    const end = new Date(dateRange.to)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    query = query
      .gte('delivery_date', start.toISOString().split('T')[0])
      .lte('delivery_date', end.toISOString().split('T')[0])
  } else if (dateRange.from) {
    const start = new Date(dateRange.from)
    start.setHours(0, 0, 0, 0)
    query = query.gte('delivery_date', start.toISOString().split('T')[0])
  } else if (dateRange.to) {
    const end = new Date(dateRange.to)
    end.setHours(23, 59, 59, 999)
    query = query.lte('delivery_date', end.toISOString().split('T')[0])
  }

  return query
}

/**
 * Order verisini formatla
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
