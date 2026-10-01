export type OrderDeliverySlice = {
  purchase_request_id?: string
  delivery_date?: string | null
  status?: string | null
  quantity?: number | null
  delivered_quantity?: number | null
}

export type DeliveryCountdown =
  | { kind: 'remaining'; days: number; label: string }
  | { kind: 'today'; label: string }
  | { kind: 'overdue'; days: number; label: string }

const ORDERED_STATUSES = ['sipariş verildi', 'ordered']

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function calendarDaysUntil(date: Date, today = startOfToday()): number {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function isOrderStillOpen(order: OrderDeliverySlice): boolean {
  if (order.status === 'teslim alındı') return false
  const quantity = Number(order.quantity || 0)
  const delivered = Number(order.delivered_quantity || 0)
  if (quantity > 0 && delivered >= quantity) return false
  return true
}

/** Henüz teslim alınmamış kalemler arasındaki en erken teslimat tarihi. */
export function earliestOpenDeliveryDate(orders: OrderDeliverySlice[]): Date | null {
  let earliest: Date | null = null
  for (const order of orders) {
    if (!isOrderStillOpen(order) || !order.delivery_date) continue
    const date = parseLocalDate(order.delivery_date)
    if (!date) continue
    if (!earliest || date.getTime() < earliest.getTime()) earliest = date
  }
  return earliest
}

export function deliveryCountdown(orders: OrderDeliverySlice[]): DeliveryCountdown | null {
  const date = earliestOpenDeliveryDate(orders)
  if (!date) return null
  const days = calendarDaysUntil(date)
  if (days > 0) return { kind: 'remaining', days, label: `${days} gün kaldı` }
  if (days === 0) return { kind: 'today', label: 'Bugün teslim' }
  const passed = Math.abs(days)
  return {
    kind: 'overdue',
    days: passed,
    label: `Teslimat tarihi ${passed} gün geçti, şantiye ile iletişime geç`,
  }
}

type SupabaseLike = {
  from: (table: string) => any
}

const HEAD_OFFICE_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
const HEAD_OFFICE_SITE_NAME = 'Genel Merkez Ofisi'

export function isHeadOfficeRequest(siteId?: string | null, siteName?: string | null): boolean {
  return siteId === HEAD_OFFICE_SITE_ID || siteName === HEAD_OFFICE_SITE_NAME
}

/** Satın alma sorumlusunun görebileceği, teslimat tarihi geçmiş sipariş talepleri. */
export async function fetchLateDeliveryRequestIds(
  supabase: SupabaseLike,
  userId: string,
  siteId: string | string[] | null | undefined
): Promise<string[]> {
  const userSiteIds = Array.isArray(siteId) ? siteId : siteId ? [siteId] : []
  const requestIds: string[] = []
  const pageSize = 500

  for (let from = 0; from < 5000; from += pageSize) {
    let query = supabase
      .from('purchase_requests')
      .select('id, site_id, site_name')
      .is('deleted_at', null)
      .in('status', ORDERED_STATUSES)

    if (userSiteIds.length > 0) {
      query = query.or(`site_id.in.(${userSiteIds.join(',')}),requested_by.eq.${userId}`)
    } else {
      query = query.eq('requested_by', userId)
    }

    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error || !data?.length) break
    requestIds.push(
      ...data
        .filter((row: { site_id?: string | null; site_name?: string | null }) =>
          !isHeadOfficeRequest(row.site_id, row.site_name)
        )
        .map((row: { id: string }) => row.id)
    )
    if (data.length < pageSize) break
  }

  if (requestIds.length === 0) return []

  const orders: OrderDeliverySlice[] = []
  const chunkSize = 40
  for (let index = 0; index < requestIds.length; index += chunkSize) {
    const chunk = requestIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('orders')
      .select('purchase_request_id, delivery_date, status, quantity, delivered_quantity')
      .in('purchase_request_id', chunk)

    if (error) {
      console.warn('Teslimat tarihi sorgusu başarısız:', error)
      continue
    }
    if (data) orders.push(...data)
  }

  const byRequest = new Map<string, OrderDeliverySlice[]>()
  for (const order of orders) {
    if (!order.purchase_request_id) continue
    const list = byRequest.get(order.purchase_request_id) || []
    list.push(order)
    byRequest.set(order.purchase_request_id, list)
  }

  return requestIds.filter((id) => deliveryCountdown(byRequest.get(id) || [])?.kind === 'overdue')
}
