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
  
  // Kullanıcı rolünü kontrol et
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Sadece purchasing_officer, admin ve manager erişebilir
  const allowedRoles = ['purchasing_officer', 'admin', 'manager']
  if (!allowedRoles.includes(profile?.role)) {
    throw new Error('Bu sayfaya erişim yetkiniz yoktur')
  }

  // Arama - Basit ve etkili yaklaşım
  let orderIdsFromSearch: string[] = []

  if (searchTerm && searchTerm.trim()) {
    const searchPattern = `%${searchTerm.trim()}%`
    
    try {
      // Tüm orders'ı çek ve ilişkili tablolarla birlikte ara
      const { data: searchResults, error: searchError } = await supabase
        .from('orders')
        .select(`
          id,
          suppliers!orders_supplier_id_fkey (name),
          purchase_requests!orders_purchase_request_id_fkey (title, request_number),
          purchase_request_items!fk_orders_material_item_id (item_name, brand, specifications)
        `)
      
      if (searchError) {
        console.error('Arama hatası:', searchError)
        throw searchError
      }

      // Client-side filtreleme - case-insensitive
      if (searchResults) {
        const lowerSearch = searchTerm.trim().toLowerCase()
        
        orderIdsFromSearch = searchResults
          .filter((order: any) => {
            // Tedarikçi adında ara
            const supplierName = order.suppliers?.name
            if (supplierName && typeof supplierName === 'string' && supplierName.toLowerCase().includes(lowerSearch)) return true
            
            // Talep başlığında ara
            const requestTitle = order.purchase_requests?.title
            if (requestTitle && typeof requestTitle === 'string' && requestTitle.toLowerCase().includes(lowerSearch)) return true
            
            // Talep numarasında ara
            const requestNumber = order.purchase_requests?.request_number
            if (requestNumber && typeof requestNumber === 'string' && requestNumber.toLowerCase().includes(lowerSearch)) return true
            
            // Malzeme adında ara
            const itemName = order.purchase_request_items?.item_name
            if (itemName && typeof itemName === 'string' && itemName.toLowerCase().includes(lowerSearch)) return true
            
            // Marka adında ara
            const brand = order.purchase_request_items?.brand
            if (brand && typeof brand === 'string' && brand.toLowerCase().includes(lowerSearch)) return true
            
            // Spesifikasyonda ara
            const specs = order.purchase_request_items?.specifications
            if (specs && typeof specs === 'string' && specs.toLowerCase().includes(lowerSearch)) return true
            
            return false
          })
          .map((order: any) => order.id)
      }

      console.log('🔍 Arama sonucu:', orderIdsFromSearch.length, 'sipariş bulundu')

      // Hiçbir sonuç bulunamadıysa boş döndür
      if (orderIdsFromSearch.length === 0) {
        return {
          orders: [],
          totalCount: 0,
          totalPages: 0
        }
      }
    } catch (error) {
      console.error('Arama işlemi başarısız:', error)
      throw error
    }
  }

  // Query builder oluştur - İLİŞKİLİ VERİLERİ TEK SORGUDA ÇEK
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

  // Arama filtresi - pagination'dan ÖNCE uygulanmalı
  if (orderIdsFromSearch.length > 0) {
    // Arama sonuçlarını pagination için böl
    const from = (page - 1) * pageSize
    const to = from + pageSize
    const paginatedSearchIds = orderIdsFromSearch.slice(from, to)
    
    console.log(`📄 Sayfa ${page}: ${paginatedSearchIds.length} sipariş gösteriliyor (toplam ${orderIdsFromSearch.length} sonuç)`)
    
    if (paginatedSearchIds.length === 0) {
      // Bu sayfada hiç sonuç yok
      return {
        orders: [],
        totalCount: orderIdsFromSearch.length,
        totalPages: Math.ceil(orderIdsFromSearch.length / pageSize)
      }
    }
    
    query = query.in('id', paginatedSearchIds)
  }

  // Durum filtresi
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  // Şantiye filtresi
  if (siteFilter && siteFilter.length > 0) {
    // purchase_requests.site_name ile filtreleme yapamayız çünkü ilişkili tablo
    // Önce site_name'leri olan order id'lerini bulalım
    const { data: siteOrders } = await supabase
      .from('orders')
      .select('id, purchase_requests!orders_purchase_request_id_fkey(site_name)')
    
    if (siteOrders) {
      const filteredOrderIds = siteOrders
        .filter((order: any) => {
          const siteName = order.purchase_requests?.site_name
          return siteName && siteFilter.includes(siteName)
        })
        .map((order: any) => order.id)
      
      if (filteredOrderIds.length > 0) {
        query = query.in('id', filteredOrderIds)
      } else {
        // Seçilen şantiyelerde hiç sipariş yok
        return {
          orders: [],
          totalCount: 0,
          totalPages: 0
        }
      }
    }
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

  // Pagination - sadece arama YAPILMADIYSA uygula
  if (orderIdsFromSearch.length === 0) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)
    console.log(`📄 Normal pagination: ${from} - ${to}`)
  } else {
    console.log(`📄 Arama aktif, pagination zaten uygulandı`)
  }
  
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

  // ✅ VERİLER ZATEN TEK SORGUDA GELDİ - Sadece formatla
  const ordersWithInvoices = (data || []).map((order: any) => {
    // Teslimat fotoğraflarını düzleştir
    const deliveryPhotosArrays: string[][] = (order.order_deliveries || [])
      .map((d: { delivery_photos?: string[] | null }) => d.delivery_photos || [])
    const flattenedDeliveryPhotos: string[] = deliveryPhotosArrays.flat().filter(Boolean)

    // En son teslimat tarihini al
    const lastDeliveredAt = order.order_deliveries?.[0]?.delivered_at || order.delivered_at

    return {
      ...order,
      suppliers: order.suppliers || null,
      purchase_requests: order.purchase_requests || null,
      purchase_request_items: order.purchase_request_items || null,
      invoices: order.invoices || [],
      delivery_image_urls: flattenedDeliveryPhotos,
      delivered_at: lastDeliveredAt,
      // order_deliveries field'ini kaldır (artık gerek yok)
      order_deliveries: undefined
    } as OrderData
  })

  // Arama yapıldıysa, toplam sayıyı arama sonuçlarından al
  const totalCount = orderIdsFromSearch.length > 0 ? orderIdsFromSearch.length : (count || 0)
  const totalPages = Math.ceil(totalCount / pageSize)

  console.log(`📊 Toplam: ${totalCount} sipariş, ${totalPages} sayfa`)

  return {
    orders: ordersWithInvoices,
    totalCount,
    totalPages
  }
}



