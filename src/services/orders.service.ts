/**
 * Orders Service
 * Sipariş listesi tek RPC ile gelir: sayfa, filtre ve grafik özeti.
 * Fatura fotoğrafı gövdesi bu cevapta yoktur; modal açılınca ayrıca çekilir.
 */

import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { OrderData, OrdersResponse, OrderFilters } from '@/app/dashboard/orders/types'
import { snapshotFromOrderAggregates } from '@/app/dashboard/orders/utils/orderAnalytics'

type OrdersPagePayload = {
  orders?: OrderData[]
  totalCount?: number
  totalPages?: number
  analytics?: {
    delivered: number
    partiallyDelivered: number
    returned: number
    pending: number
    anchored: boolean
    daily: { dayKey: string; count: number; amount: number }[]
  } | null
}

function toDeliveryDateParam(value: Date | undefined | null, bound: 'start' | 'end'): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  if (bound === 'start') date.setHours(0, 0, 0, 0)
  else date.setHours(23, 59, 59, 999)
  return date.toISOString().split('T')[0] ?? null
}

function normalizeOrder(order: OrderData): OrderData {
  return {
    ...order,
    suppliers: order.suppliers || null,
    purchase_requests: order.purchase_requests || null,
    purchase_request_items: order.purchase_request_items || null,
    invoices: order.invoices || [],
    delivery_image_urls: order.delivery_image_urls || [],
  }
}

export async function fetchOrders(filters: OrderFilters): Promise<OrdersResponse> {
  const supabase = createClient()
  const { page, pageSize, searchTerm, statusFilter, siteFilter, dateRange } = filters

  const { data, error } = await supabase.rpc('get_orders_page', {
    p_page: page,
    p_page_size: pageSize,
    p_search: searchTerm?.trim() ? searchTerm.trim() : null,
    p_status: statusFilter || 'all',
    p_site_names: siteFilter.length > 0 ? siteFilter : null,
    p_date_from: toDeliveryDateParam(dateRange.from, 'start'),
    p_date_to: toDeliveryDateParam(dateRange.to, 'end'),
    p_today: format(new Date(), 'yyyy-MM-dd'),
  })

  if (error) {
    throw new Error(error.message || 'Sipariş verileri alınamadı')
  }

  const payload = (data ?? {}) as OrdersPagePayload
  const orders = (payload.orders || []).map(normalizeOrder)
  const totalCount = Number(payload.totalCount) || 0
  const totalPages = Number(payload.totalPages) || 0

  return {
    orders,
    totalCount,
    totalPages,
    analytics: snapshotFromOrderAggregates(totalCount, payload.analytics ?? null),
  }
}
