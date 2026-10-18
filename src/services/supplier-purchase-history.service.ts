import { createClient } from '@/lib/supabase/client'
import type {
  SupplierPurchaseHistory,
  SupplierPurchaseProduct,
  SupplierPurchaseRequestRow,
} from '@/lib/supplier-purchase-history'

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function minDate(values: Array<string | null>): string | null {
  const dates = values.filter(Boolean) as string[]
  if (dates.length === 0) return null
  return dates.reduce((min, value) => (value < min ? value : min))
}

function maxDate(values: Array<string | null>): string | null {
  const dates = values.filter(Boolean) as string[]
  if (dates.length === 0) return null
  return dates.reduce((max, value) => (value > max ? value : max))
}

function requestSiteIds(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return typeof value === 'string' && value.length > 0 ? [value] : []
}

function belongsToSites(request: { site_id?: unknown } | null | undefined, siteIds: string[]): boolean {
  if (siteIds.length === 0) return true
  return requestSiteIds(request?.site_id).some((id) => siteIds.includes(id))
}

export async function fetchSupplierPurchaseHistory(
  supplierId: string,
  siteIds: string[] = []
): Promise<SupplierPurchaseHistory> {
  const supabase = createClient()

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(
      `
      id,
      quantity,
      created_at,
      delivery_date,
      currency,
      material_item_id,
      purchase_request_items!fk_orders_material_item_id (
        id,
        item_name,
        unit,
        material_item_name,
        quantity,
        original_quantity,
        purchase_request:purchase_requests (
          id,
          request_number,
          status,
          site_id,
          site_name,
          created_at
        )
      )
    `
    )
    .eq('supplier_id', supplierId)

  if (ordersError) throw ordersError

  const orderIds = (orders || []).map((order) => order.id)
  const invoicesByOrder = new Map<string, { amount: number; currency: string; created_at: string | null }[]>()

  if (orderIds.length > 0) {
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('order_id, amount, grand_total, currency, created_at')
      .in('order_id', orderIds)

    if (invoicesError) throw invoicesError

    for (const invoice of invoices || []) {
      const list = invoicesByOrder.get(invoice.order_id) || []
      list.push({
        amount: toNumber(invoice.grand_total ?? invoice.amount),
        currency: invoice.currency || 'TRY',
        created_at: invoice.created_at,
      })
      invoicesByOrder.set(invoice.order_id, list)
    }
  }

  const products = new Map<string, SupplierPurchaseProduct>()
  const requests = new Map<string, SupplierPurchaseRequestRow>()
  const invoiceDates: Array<string | null> = []
  const orderDates: Array<string | null> = []
  let invoiceCount = 0
  let totalAmount = 0
  let currency = 'TRY'

  for (const order of orders || []) {
    const item = Array.isArray(order.purchase_request_items)
      ? order.purchase_request_items[0]
      : order.purchase_request_items
    const requestRaw = item?.purchase_request
    const request = Array.isArray(requestRaw) ? requestRaw[0] : requestRaw
    if (!belongsToSites(request, siteIds)) continue

    orderDates.push(toDateKey(order.created_at), toDateKey(order.delivery_date))
    const name = (item?.material_item_name || item?.item_name || 'Malzeme').trim()
    const unit = (item?.unit || '').trim() || '—'
    const invoices = invoicesByOrder.get(order.id) || []
    invoiceCount += invoices.length
    const amount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    const invoiceCurrency = invoices[0]?.currency || order.currency || 'TRY'
    currency = invoiceCurrency
    totalAmount += amount
    invoices.forEach((invoice) => invoiceDates.push(toDateKey(invoice.created_at)))

    const siteId = requestSiteIds(request?.site_id)[0] || null
    const key = `${name.toLocaleLowerCase('tr-TR')}::${unit.toLocaleLowerCase('tr-TR')}::${siteId || 'none'}`
    const current = products.get(key)
    if (current) {
      current.quantity += toNumber(order.quantity)
      current.amount += amount
      current.orderCount += 1
    } else {
      products.set(key, {
        key,
        name,
        unit,
        quantity: toNumber(order.quantity),
        amount,
        currency: invoiceCurrency,
        orderCount: 1,
        siteId,
      })
    }

    const requestItemId = item?.id || order.material_item_id || order.id
    const requestId = request?.id || requestItemId
    const requestKey = `${requestId}::${requestItemId}`
    const existingRequest = requests.get(requestKey)
    if (existingRequest) {
      existingRequest.quantity += toNumber(order.quantity || item?.original_quantity || item?.quantity)
      existingRequest.amount += amount
    } else {
      requests.set(requestKey, {
        id: requestKey,
        requestId,
        requestNumber: request?.request_number || 'Talep',
        status: request?.status || null,
        siteId: requestSiteIds(request?.site_id)[0] || null,
        siteName: request?.site_name || null,
        createdAt: request?.created_at || order.created_at,
        itemName: name,
        quantity: toNumber(order.quantity || item?.original_quantity || item?.quantity),
        unit,
        amount,
        currency: invoiceCurrency,
      })
    }
  }

  return {
    firstDate: minDate(invoiceDates) || minDate(orderDates),
    lastDate: maxDate(invoiceDates) || maxDate(orderDates),
    invoiceCount,
    orderCount: (orders || []).length,
    totalAmount,
    currency,
    products: Array.from(products.values()).sort((a, b) => b.amount - a.amount || b.quantity - a.quantity),
    requests: Array.from(requests.values()).sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return right - left
    }),
  }
}
