/**
 * useInvoices Hook
 * Fatura CRUD işlemleri için React Query mutations ve queries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createInvoice, updateInvoice, deleteInvoice } from '@/services'
import type { CreateInvoiceParams, UpdateInvoiceParams } from '@/services'
import { createClient } from '@/lib/supabase/client'

/**
 * Fatura oluşturma mutation
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (params: CreateInvoiceParams) => createInvoice(params),
    onSuccess: () => {
      // Siparişleri yeniden yükle
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Fatura güncelleme mutation
 */
export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (params: UpdateInvoiceParams) => updateInvoice(params),
    onSuccess: () => {
      // Siparişleri yeniden yükle
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Fatura silme mutation
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (invoiceId: string) => deleteInvoice(invoiceId),
    onSuccess: () => {
      // Siparişleri yeniden yükle
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

/**
 * Invoice groups query - Tüm fatura gruplarını çek (arama desteği ile)
 */
export function useInvoiceGroups(searchTerm: string = '') {
  return useQuery({
    queryKey: ['invoice-groups', searchTerm],
    queryFn: async () => {
      const supabase = createClient()
      
      // Invoice groups'ları çek
      let query = supabase
        .from('invoice_groups_with_orders')
        .select('*')
        .order('created_at', { ascending: false })
      
      // Arama terimi varsa filtrele (group_name veya notes içinde ara)
      if (searchTerm && searchTerm.trim()) {
        query = query.or(`group_name.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Invoice groups fetch error:', error)
        throw error
      }
      
      console.log('✅ Invoice Groups fetched:', data?.length, 'groups', searchTerm ? `(search: "${searchTerm}")` : '')
      
      return data || []
    },
    staleTime: 30000, // 30 saniye
  })
}

/**
 * Invoice groups ile ilişkili TÜM siparişleri çek (pagination yok, arama desteği ile)
 */
export function useInvoiceGroupOrders(searchTerm: string = '') {
  return useQuery({
    queryKey: ['invoice-group-orders', searchTerm],
    queryFn: async () => {
      const supabase = createClient()
      
      // Önce tüm invoice_group_id'leri al
      const { data: groups } = await supabase
        .from('invoice_groups')
        .select('id')
      
      if (!groups || groups.length === 0) {
        return []
      }
      
      // Tüm invoice'ları çek
      const { data: invoices } = await supabase
        .from('invoices')
        .select('order_id, invoice_group_id')
        .not('invoice_group_id', 'is', null)
      
      if (!invoices || invoices.length === 0) {
        return []
      }
      
      // Unique order_id'leri al
      const orderIds = [...new Set(invoices.map(inv => inv.order_id))]
      
      console.log('📦 Fetching orders for invoice groups:', orderIds.length, 'orders', searchTerm ? `(search: "${searchTerm}")` : '')
      
      // Tüm ilgili siparişleri çek (pagination YOK!)
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          order_number,
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
            status,
            sites!purchase_requests_site_id_fkey (
              name
            )
          ),
          purchase_request_items!fk_orders_material_item_id (
            item_name,
            unit,
            brand,
            specifications
          )
        `)
        .in('id', orderIds)
      
      const { data: orders, error } = await ordersQuery
      
      if (error) {
        console.error('Orders fetch error:', error)
        throw error
      }
      
      // Her sipariş için fatura ve teslimat verilerini çek
      let ordersWithInvoices = await Promise.all(
        (orders || []).map(async (order: any) => {
          // Fatura verilerini çek
          const { data: invoicesData } = await supabase
            .from('invoices')
            .select('id, amount, currency, invoice_photos, created_at, parent_invoice_id, is_master, subtotal, discount, tax, grand_total, invoice_group_id, notes')
            .eq('order_id', order.id)

          // İrsaliye fotoğraflarını order_deliveries tablosundan çek
          const { data: deliveriesData } = await supabase
            .from('order_deliveries')
            .select('delivery_photos, delivered_at')
            .eq('order_id', order.id)
            .order('delivered_at', { ascending: false })

          // Teslimat fotoğraflarını düzleştir
          const deliveryPhotosArrays: string[][] = (deliveriesData || [])
            .map((d: { delivery_photos?: string[] | null }) => d.delivery_photos || [])
          const flattenedDeliveryPhotos: string[] = deliveryPhotosArrays.flat().filter(Boolean)

          // En son teslimat tarihini al
          const lastDeliveredAt = deliveriesData?.[0]?.delivered_at || order.delivered_at

          return {
            ...order,
            suppliers: order.suppliers || null,
            purchase_requests: order.purchase_requests || null,
            purchase_request_items: order.purchase_request_items || null,
            invoices: invoicesData || [],
            delivery_image_urls: flattenedDeliveryPhotos,
            delivered_at: lastDeliveredAt
          }
        })
      )
      
      // Client-side arama filtresi (tedarikçi adı, malzeme adı, marka, şantiye adı)
      if (searchTerm && searchTerm.trim()) {
        const search = searchTerm.toLowerCase().trim()
        ordersWithInvoices = ordersWithInvoices.filter((order: any) => {
          const supplierName = order.suppliers?.name?.toLowerCase() || ''
          const itemName = order.purchase_request_items?.item_name?.toLowerCase() || ''
          const brand = order.purchase_request_items?.brand?.toLowerCase() || ''
          const siteName = order.purchase_requests?.sites?.name?.toLowerCase() || ''
          const siteNameAlt = order.purchase_requests?.site_name?.toLowerCase() || ''
          const orderNumber = order.order_number?.toLowerCase() || ''
          const requestNumber = order.purchase_requests?.request_number?.toLowerCase() || ''
          
          return (
            supplierName.includes(search) ||
            itemName.includes(search) ||
            brand.includes(search) ||
            siteName.includes(search) ||
            siteNameAlt.includes(search) ||
            orderNumber.includes(search) ||
            requestNumber.includes(search)
          )
        })
      }
      
      console.log('✅ Invoice group orders fetched:', ordersWithInvoices.length, 'orders')
      
      return ordersWithInvoices
    },
    staleTime: 30000, // 30 saniye
  })
}



