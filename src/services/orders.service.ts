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

  // Purchasing officer için site ID'lerini al
  const userSiteIds = profile?.role === 'purchasing_officer' && profile?.site_id
    ? (Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id])
    : null

  // Arama - SQL bazlı, hızlı ve etkili
  let orderIdsFromSearch: string[] = []

  if (searchTerm && searchTerm.trim()) {
    try {
      const search = searchTerm.trim().toLowerCase()
      const searchPattern = `%${search}%`
      
      console.log('🔍 Arama yapılıyor:', search)
      
      // SQL ile doğrudan arama - ÇOK DAHA HIZLI!
      // Geçici olarak RPC'yi devre dışı bırak - fallback kullan
      const searchError = { message: 'Using fallback search' }
      let searchResults = null
      
      // const { data: searchResults, error: searchError } = await supabase.rpc(
      //   'search_orders',
      //   { search_term: search }
      // )
      
      if (searchError) {
        console.warn('⚠️ RPC arama hatası, fallback kullanılıyor:', searchError.message)
        
        // Fallback: Paginated sorgu ile TÜM orderları çek
        // Supabase default 1000 satır limit'i olduğu için pagination gerekli
        let fallbackResults: any[] = []
        let from = 0
        const fetchPageSize = 1000
        
        // Purchasing officer için site filtresi - kendi sitelerine ait veya kendi oluşturduğu talepler
        let allowedRequestIds: string[] | null = null
        if (userSiteIds && userSiteIds.length > 0) {
          const { data: allowedRequests } = await supabase
            .from('purchase_requests')
            .select('id')
            .or(`site_id.in.(${userSiteIds.join(',')}),requested_by.eq.${user.id}`)
          
          if (allowedRequests && allowedRequests.length > 0) {
            allowedRequestIds = allowedRequests.map(req => req.id)
          } else {
            allowedRequestIds = []
          }
        } else if (profile?.role === 'purchasing_officer') {
          // Site ID'si yoksa sadece kendi oluşturduğu talepler
          const { data: userRequests } = await supabase
            .from('purchase_requests')
            .select('id')
            .eq('requested_by', user.id)
          
          if (userRequests && userRequests.length > 0) {
            allowedRequestIds = userRequests.map(req => req.id)
          } else {
            allowedRequestIds = []
          }
        }
        
        while (true) {
          let pageQuery = supabase
            .from('orders')
            .select(`
              id,
              quantity,
              purchase_request_id,
              suppliers!orders_supplier_id_fkey (name),
              purchase_requests!orders_purchase_request_id_fkey (title, request_number),
              purchase_request_items!fk_orders_material_item_id (item_name, brand, specifications, unit)
            `)
          
          // Purchasing officer için site filtresi ekle
          if (allowedRequestIds !== null) {
            if (allowedRequestIds.length === 0) {
              break // Hiç izinli request yok
            }
            pageQuery = pageQuery.in('purchase_request_id', allowedRequestIds)
          }
          
          pageQuery = pageQuery.range(from, from + fetchPageSize - 1)
          
          const { data: pageData, error: pageError } = await pageQuery
          
          if (pageError) {
            console.error('❌ Fallback arama hatası:', pageError)
            throw pageError
          }
          
          if (!pageData || pageData.length === 0) break
          
          fallbackResults = fallbackResults.concat(pageData)
          
          // Son sayfa ise dur
          if (pageData.length < fetchPageSize) break
          
          from += fetchPageSize
        }
        
        console.log(`✅ Toplam ${fallbackResults.length} order çekildi (paginated)`)
        
        // Client-side filtreleme (fallback)
        if (fallbackResults) {
          // Türkçe karakterleri normalize et
          const normalizeTurkish = (text: string): string => {
            return text
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
          }
          
          const normalizedSearch = normalizeTurkish(search)
          const searchWords = normalizedSearch.split(/\s+/).filter(word => word.length > 0)
          
          orderIdsFromSearch = fallbackResults
            .filter((order: any) => {
              const searchableFields = [
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
              
              const combinedText = normalizeTurkish(
                searchableFields
                  .filter(field => field && typeof field === 'string')
                  .join(' ')
              )
              
              // Her kelime geçmeli
              return searchWords.every(word => combinedText.includes(word))
            })
            .map((order: any) => order.id)
        }
      } else {
        // RPC başarılı - sonuçları al
        orderIdsFromSearch = (searchResults || []).map((r: any) => r.order_id)
      }

      console.log('✅ Arama sonucu:', orderIdsFromSearch.length, 'sipariş bulundu')

      // Hiçbir sonuç bulunamadıysa boş döndür
      if (orderIdsFromSearch.length === 0) {
        return {
          orders: [],
          totalCount: 0,
          totalPages: 0
        }
      }
    } catch (error) {
      console.error('❌ Arama işlemi başarısız:', error)
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

  // Purchasing officer için site filtresi - kendi sitelerine ait veya kendi oluşturduğu taleplere ait siparişleri göster
  if (userSiteIds && userSiteIds.length > 0) {
    // Önce bu sitelere ait veya kullanıcının oluşturduğu purchase_request ID'lerini bul
    const { data: allowedRequests } = await supabase
      .from('purchase_requests')
      .select('id')
      .or(`site_id.in.(${userSiteIds.join(',')}),requested_by.eq.${user.id}`)
    
    if (allowedRequests && allowedRequests.length > 0) {
      const requestIds = allowedRequests.map(req => req.id)
      query = query.in('purchase_request_id', requestIds)
    } else {
      // Kullanıcının sitelerinde hiç talep/sipariş yok ve kendi oluşturduğu talep de yok
      return {
        orders: [],
        totalCount: 0,
        totalPages: 0
      }
    }
  } else if (profile?.role === 'purchasing_officer') {
    // Site ID'si yoksa sadece kendi oluşturduğu taleplere ait siparişleri göster
    const { data: userRequests } = await supabase
      .from('purchase_requests')
      .select('id')
      .eq('requested_by', user.id)
    
    if (userRequests && userRequests.length > 0) {
      const requestIds = userRequests.map(req => req.id)
      query = query.in('purchase_request_id', requestIds)
    } else {
      return {
        orders: [],
        totalCount: 0,
        totalPages: 0
      }
    }
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



