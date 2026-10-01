/**
 * Order Utilities
 * Sipariş işlemleri yardımcı fonksiyonları
 */

import type { OrderData, GroupedOrder } from '../types'

export interface OrderNumberCluster {
  orderNumber: string
  orders: OrderData[]
}

/**
 * Aynı sipariş numarasını paylaşan malzeme satırlarını tek sipariş olarak gruplar.
 * Numarası olmayan satırlar kendi başlarına kalır.
 */
export function clusterOrdersByNumber(orders: OrderData[]): OrderNumberCluster[] {
  const clusters: OrderNumberCluster[] = []
  const indexByNumber = new Map<string, number>()

  for (const order of orders) {
    const orderNumber = order.order_number?.trim() || order.id
    const existingIndex = indexByNumber.get(orderNumber)
    if (existingIndex === undefined) {
      indexByNumber.set(orderNumber, clusters.length)
      clusters.push({ orderNumber, orders: [order] })
    } else {
      clusters[existingIndex].orders.push(order)
    }
  }

  return clusters
}

/**
 * Talep ve sipariş numaralarının listede görünen kısa hali.
 * Tam numaranın son 7 karakteri: örn. ORD-20260928-AB12CD-3246 → CD-3246
 */
export function formatShortDocumentNumber(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  return trimmed.length > 7 ? trimmed.slice(-7) : trimmed
}

/**
 * Siparişleri talep bazında gruplandır
 * @param orders - Sipariş listesi
 * @returns Talep ID'sine göre gruplandırılmış siparişler
 */
export function groupOrdersByRequest(orders: OrderData[]): Record<string, GroupedOrder> {
  return orders.reduce((groups, order) => {
    const requestId = order.purchase_request_id
    if (!groups[requestId]) {
      groups[requestId] = {
        request: order.purchase_requests,
        orders: []
      }
    }
    groups[requestId].orders.push(order)
    return groups
  }, {} as Record<string, GroupedOrder>)
}

/**
 * Gruplandırılmış siparişleri sıralı listeye çevir
 * @param groupedOrders - Gruplandırılmış siparişler
 * @returns Sıralı grup listesi (en yeni önce)
 */
export function sortGroupedOrders(groupedOrders: Record<string, GroupedOrder>): GroupedOrder[] {
  return Object.values(groupedOrders).sort((a, b) => {
    // En son oluşturulan siparişe göre sırala
    const aLatest = Math.max(...a.orders.map(o => new Date(o.created_at).getTime()))
    const bLatest = Math.max(...b.orders.map(o => new Date(o.created_at).getTime()))
    return bLatest - aLatest
  })
}

/**
 * Sipariş durumuna göre badge rengi belirle
 * @param status - Sipariş durumu
 * @param isDelivered - Teslim edildi mi
 * @returns Badge class name
 */
export function getOrderStatusBadgeClass(status: string, isDelivered: boolean): string {
  if (status === 'delivered' || isDelivered) {
    return 'bg-green-100 text-green-700 border-0 text-xs'
  } else if (status === 'partially_delivered' || status === 'kısmen teslim alındı') {
    return 'bg-orange-100 text-orange-700 border-0 text-xs'
  } else if (status === 'iade edildi') {
    return 'bg-red-100 text-red-700 border-0 text-xs'
  } else {
    return 'bg-gray-100 text-gray-700 border-0 text-xs'
  }
}

/**
 * Sipariş durumunu Türkçe metne çevir
 * @param status - Sipariş durumu
 * @param isDelivered - Teslim edildi mi
 * @returns Türkçe durum metni
 */
export function getOrderStatusText(status: string, isDelivered: boolean): string {
  if (status === 'delivered' || isDelivered) {
    return 'Teslim Edildi'
  } else if (status === 'partially_delivered' || status === 'kısmen teslim alındı') {
    return 'Kısmi Teslim'
  } else if (status === 'iade edildi') {
    return 'İade Edildi'
  } else {
    return 'Bekliyor'
  }
}

/**
 * Durum filtrelerini yapılandır
 * @param statusFilter - Seçili durum filtresi
 * @param orders - Sipariş listesi
 * @returns Filtrelenmiş siparişler
 */
export function filterOrdersByStatus(orders: OrderData[], statusFilter: string): OrderData[] {
  if (statusFilter === 'all') {
    return orders
  }
  
  // Hem İngilizce hem Türkçe status değerlerini destekle
  if (statusFilter === 'partially_delivered') {
    return orders.filter(o => 
      o.status === 'partially_delivered' || 
      o.status === 'kısmen teslim alındı'
    )
  }
  
  return orders.filter(o => o.status === statusFilter)
}

/**
 * Siparişlerin istatistiklerini hesapla
 * @param orders - Sipariş listesi
 * @returns İstatistikler
 */
export function calculateOrderStats(orders: OrderData[]) {
  return {
    total: orders.length,
    delivered: orders.filter(o => o.status === 'delivered' || o.is_delivered).length,
    partiallyDelivered: orders.filter(o => 
      o.status === 'partially_delivered' || 
      o.status === 'kısmen teslim alındı'
    ).length,
    returned: orders.filter(o => o.status === 'iade edildi').length,
  }
}






















