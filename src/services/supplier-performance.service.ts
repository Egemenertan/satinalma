import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/reports/fetchAll'
import { effectiveInvoiceAmount } from '@/lib/site-invoice-aggregation'
import {
  computeSupplierScore,
  emptySupplierMetrics,
  type CurrencyAmount,
  type SupplierLiveMetrics,
} from '@/lib/supplier-performance'

type OrderRow = {
  id: string
  supplier_id: string | null
  purchase_request_id: string | null
  delivery_date: string | null
  created_at: string | null
  quantity: number | string | null
  delivered_quantity: number | string | null
  returned_quantity: number | string | null
  is_delivered: boolean | null
  delivered_at: string | null
  delivery_confirmed_at: string | null
}

type InvoiceRow = {
  order_id: string | null
  amount: number | string | null
  grand_total: number | string | null
  currency: string | null
  parent_invoice_id: string | null
}

type SummaryRow = {
  order_id: string
  delivery_status: string | null
  remaining_quantity: number | string | null
  total_delivered_quantity: number | string | null
  total_ordered_quantity: number | string | null
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function endOfDay(value: string): Date | null {
  const date = parseDate(value)
  if (!date) return null
  date.setHours(23, 59, 59, 999)
  return date
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
  return Math.max(1, months)
}

function buildTotals(map: Map<string, number>): CurrencyAmount[] {
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => {
      if (a.currency === 'TRY') return -1
      if (b.currency === 'TRY') return 1
      return b.amount - a.amount
    })
}

export async function fetchSupplierLiveMetricsMap(): Promise<Record<string, SupplierLiveMetrics>> {
  const supabase = createClient()

  const [orders, invoices, summaries] = await Promise.all([
    fetchAllRows<OrderRow>((from, to) =>
      supabase
        .from('orders')
        .select(
          'id, supplier_id, purchase_request_id, delivery_date, created_at, quantity, delivered_quantity, returned_quantity, is_delivered, delivered_at, delivery_confirmed_at'
        )
        .not('supplier_id', 'is', null)
        .range(from, to)
    ),
    fetchAllRows<InvoiceRow>((from, to) =>
      supabase
        .from('invoices')
        .select('order_id, amount, grand_total, currency, parent_invoice_id')
        .range(from, to)
    ),
    fetchAllRows<SummaryRow>((from, to) =>
      supabase
        .from('order_delivery_summary')
        .select('order_id, delivery_status, remaining_quantity, total_delivered_quantity, total_ordered_quantity')
        .range(from, to)
    ),
  ])

  return aggregateSupplierMetrics(orders, invoices, summaries)
}

export async function fetchSupplierLiveMetrics(supplierId: string): Promise<SupplierLiveMetrics> {
  const supabase = createClient()

  const [orders, summaries] = await Promise.all([
    fetchAllRows<OrderRow>((from, to) =>
      supabase
        .from('orders')
        .select(
          'id, supplier_id, purchase_request_id, delivery_date, created_at, quantity, delivered_quantity, returned_quantity, is_delivered, delivered_at, delivery_confirmed_at'
        )
        .eq('supplier_id', supplierId)
        .range(from, to)
    ),
    fetchAllRows<SummaryRow>((from, to) =>
      supabase
        .from('order_delivery_summary')
        .select('order_id, delivery_status, remaining_quantity, total_delivered_quantity, total_ordered_quantity')
        .eq('supplier_id', supplierId)
        .range(from, to)
    ),
  ])

  const orderIds = orders.map((order) => order.id)
  const invoices: InvoiceRow[] = []
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200)
    const rows = await fetchAllRows<InvoiceRow>((from, to) =>
      supabase
        .from('invoices')
        .select('order_id, amount, grand_total, currency, parent_invoice_id')
        .in('order_id', chunk)
        .range(from, to)
    )
    invoices.push(...rows)
  }

  const map = aggregateSupplierMetrics(orders, invoices, summaries)
  return map[supplierId] ?? emptySupplierMetrics(supplierId)
}

function aggregateSupplierMetrics(
  orders: OrderRow[],
  invoices: InvoiceRow[],
  summaries: SummaryRow[]
): Record<string, SupplierLiveMetrics> {
  const summaryByOrder = new Map(summaries.map((row) => [row.order_id, row]))
  const now = new Date()
  const thisMonth = monthKey(now)

  type Acc = {
    orderCount: number
    requestIds: Set<string>
    invoiceCount: number
    invoiceTotals: Map<string, number>
    fulfilledByMonth: Map<string, Set<string>>
    onTimeCount: number
    lateCount: number
    incompleteCount: number
    problemCount: number
    scoredOrderCount: number
    firstOrderAt: Date | null
  }

  const bySupplier = new Map<string, Acc>()

  const ensure = (supplierId: string): Acc => {
    const existing = bySupplier.get(supplierId)
    if (existing) return existing
    const created: Acc = {
      orderCount: 0,
      requestIds: new Set(),
      invoiceCount: 0,
      invoiceTotals: new Map(),
      fulfilledByMonth: new Map(),
      onTimeCount: 0,
      lateCount: 0,
      incompleteCount: 0,
      problemCount: 0,
      scoredOrderCount: 0,
      firstOrderAt: null,
    }
    bySupplier.set(supplierId, created)
    return created
  }

  const invoiceByOrder = new Map<string, InvoiceRow[]>()
  for (const invoice of invoices) {
    if (!invoice.order_id || invoice.parent_invoice_id) continue
    const list = invoiceByOrder.get(invoice.order_id) || []
    list.push(invoice)
    invoiceByOrder.set(invoice.order_id, list)
  }

  for (const order of orders) {
    if (!order.supplier_id) continue
    const acc = ensure(order.supplier_id)
    acc.orderCount += 1

    const createdAt = parseDate(order.created_at)
    if (createdAt && (!acc.firstOrderAt || createdAt < acc.firstOrderAt)) {
      acc.firstOrderAt = createdAt
    }

    if (order.purchase_request_id) acc.requestIds.add(order.purchase_request_id)

    const summary = summaryByOrder.get(order.id)
    const orderedQty = toNumber(summary?.total_ordered_quantity ?? order.quantity)
    const deliveredQty = toNumber(summary?.total_delivered_quantity ?? order.delivered_quantity)
    const remainingQty = toNumber(summary?.remaining_quantity ?? Math.max(0, orderedQty - deliveredQty))
    const returnedQty = toNumber(order.returned_quantity)
    const status = (summary?.delivery_status || '').toLowerCase()
    const fullyDelivered =
      order.is_delivered === true ||
      status === 'completed' ||
      (orderedQty > 0 && remainingQty <= 0.001 && deliveredQty > 0)

    const completionAt =
      parseDate(order.delivery_confirmed_at) || parseDate(order.delivered_at) || (fullyDelivered ? createdAt : null)
    const dueAt = order.delivery_date ? endOfDay(order.delivery_date) : null
    const overdue = Boolean(dueAt && now > dueAt && !fullyDelivered)
    const incomplete = overdue || (fullyDelivered === false && remainingQty > 0.001 && deliveredQty > 0 && Boolean(dueAt && now > dueAt))
    const problem = returnedQty > 0.001

    if (fullyDelivered && order.purchase_request_id && completionAt) {
      const key = monthKey(completionAt)
      const bucket = acc.fulfilledByMonth.get(key) || new Set<string>()
      bucket.add(order.purchase_request_id)
      acc.fulfilledByMonth.set(key, bucket)
    }

    if (fullyDelivered || overdue) {
      acc.scoredOrderCount += 1
      if (fullyDelivered && dueAt && completionAt && completionAt.getTime() <= dueAt.getTime()) {
        acc.onTimeCount += 1
      } else if (fullyDelivered && dueAt && completionAt && completionAt.getTime() > dueAt.getTime()) {
        acc.lateCount += 1
      } else if (fullyDelivered && !dueAt) {
        acc.onTimeCount += 1
      } else {
        acc.lateCount += 1
      }
      if (incomplete || overdue) acc.incompleteCount += 1
      if (problem) acc.problemCount += 1
    } else if (problem) {
      acc.problemCount += 1
    }

    const orderInvoices = invoiceByOrder.get(order.id) || []
    for (const invoice of orderInvoices) {
      const amount = effectiveInvoiceAmount(invoice)
      if (amount <= 0) continue
      acc.invoiceCount += 1
      const currency = (invoice.currency || 'TRY').trim() || 'TRY'
      acc.invoiceTotals.set(currency, (acc.invoiceTotals.get(currency) || 0) + amount)
    }
  }

  const result: Record<string, SupplierLiveMetrics> = {}

  for (const [supplierId, acc] of bySupplier.entries()) {
    const thisMonthRequestCount = acc.fulfilledByMonth.get(thisMonth)?.size ?? 0
    const activeMonths = acc.firstOrderAt ? monthsBetween(acc.firstOrderAt, now) : 1
    const fulfilledTotal = [...acc.fulfilledByMonth.values()].reduce((sum, set) => sum + set.size, 0)
    const score = computeSupplierScore(acc)

    result[supplierId] = {
      supplierId,
      orderCount: acc.orderCount,
      requestCount: acc.requestIds.size,
      invoiceCount: acc.invoiceCount,
      invoiceTotals: buildTotals(acc.invoiceTotals),
      thisMonthRequestCount,
      monthlyRequestAvg: fulfilledTotal / activeMonths,
      ...score,
      onTimeCount: acc.onTimeCount,
      lateCount: acc.lateCount,
      incompleteCount: acc.incompleteCount,
      problemCount: acc.problemCount,
      scoredOrderCount: acc.scoredOrderCount,
    }
  }

  return result
}
