import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  emptySummary,
  effectiveInvoiceAmount,
  mergeCurrencyAmounts,
  resolveReportDateRange,
  buildItemDetailLines,
  buildSpendingInsights,
  type DepartmentSpendingFilters,
  type DepartmentSpendingLine,
  type DepartmentSpendingReport,
  type DepartmentSpendingSummary,
  type DepartmentManagerInfo,
} from '@/lib/reports/departmentSpending'
import {
  aggregateCurrencyTotalsViaEurCross,
  type EurCrossRates,
} from '@/lib/fx/convertViaEurRates'

export const dynamic = 'force-dynamic'

type RequestRow = {
  id: string
  request_number: string | null
  department: string | null
  site_name: string | null
  created_at: string
}

type ItemRow = {
  id: string
  purchase_request_id: string
  item_name: string | null
  quantity: number | string | null
  original_quantity: number | string | null
  unit: string | null
  brand: string | null
  description: string | null
  specifications: string | null
  purpose: string | null
}

function itemQty(item: Pick<ItemRow, 'original_quantity' | 'quantity'>): number {
  const original = Number(item.original_quantity)
  if (Number.isFinite(original) && original > 0) return original
  const qty = Number(item.quantity)
  return Number.isFinite(qty) ? qty : 0
}

async function fetchEurFx(): Promise<{ date: string; rates: EurCrossRates } | null> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { base?: string; date?: string; rates?: EurCrossRates }
    if (!data.rates || data.base !== 'EUR' || !data.date) return null
    return { date: data.date, rates: data.rates }
  } catch {
    return null
  }
}

function attachUsdTotals(
  summary: DepartmentSpendingSummary,
  fx: { date: string; rates: EurCrossRates } | null
): DepartmentSpendingSummary {
  if (!fx) {
    return { ...summary, totalUsd: null, fxDate: null, fxIncomplete: true }
  }
  const map = new Map(summary.totalsByCurrency.map((t) => [t.currency, t.amount]))
  const { value, incomplete } = aggregateCurrencyTotalsViaEurCross(map, 'USD', fx.rates)
  return {
    ...summary,
    totalUsd: value,
    fxDate: fx.date,
    fxIncomplete: incomplete,
  }
}

type OrderRow = {
  id: string
  purchase_request_id: string
  material_item_id: string | null
}

type InvoiceRow = {
  id: string
  order_id: string
  amount: number | string | null
  grand_total: number | string | null
  currency: string | null
  created_at: string
  parent_invoice_id: string | null
}

type Supabase = ReturnType<typeof createClient>

async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Bu rapor yalnızca admin içindir' }, { status: 403 }) }
  }
  return { supabase }
}

async function fetchRequests(
  supabase: Supabase,
  dateFrom: string,
  dateTo: string,
  department: string | null
): Promise<RequestRow[]> {
  const pageSize = 1000
  const all: RequestRow[] = []
  let from = 0
  for (;;) {
    let q = supabase
      .from('purchase_requests')
      .select('id, request_number, department, site_name, created_at')
      .is('deleted_at', null)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (department) {
      q = q.ilike('department', department)
    }

    const { data, error } = await q
    if (error) throw error
    const chunk = (data || []) as RequestRow[]
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return all
}

function buildSummary(
  departmentLabel: string,
  requests: RequestRow[],
  items: ItemRow[],
  invoices: InvoiceRow[]
): DepartmentSpendingSummary {
  return {
    department: departmentLabel,
    requestCount: requests.length,
    materialLineCount: items.length,
    materialQuantitySum: items.reduce((s, i) => s + itemQty(i), 0),
    invoiceCount: invoices.length,
    totalsByCurrency: mergeCurrencyAmounts(
      invoices.map((inv) => ({
        currency: inv.currency,
        amount: effectiveInvoiceAmount(inv),
      }))
    ),
    totalUsd: null,
    fxDate: null,
    fxIncomplete: false,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { supabase } = auth as { supabase: Supabase }

    const sp = request.nextUrl.searchParams
    const filters: DepartmentSpendingFilters = {
      department: sp.get('department'),
      month: sp.get('month'),
      dateFrom: sp.get('dateFrom'),
      dateTo: sp.get('dateTo'),
    }
    const { dateFrom, dateTo } = resolveReportDateRange(filters)
    const department = filters.department?.trim() || null

    if (sp.get('meta') === 'departments') {
      const { data: deps, error: depErr } = await supabase
        .from('purchase_requests')
        .select('department')
        .not('department', 'is', null)
        .is('deleted_at', null)

      if (depErr) throw depErr
      const unique = [
        ...new Set(
          (deps || [])
            .map((d) => (d.department || '').trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, 'tr'))
      return NextResponse.json({ departments: unique })
    }

    const requests = await fetchRequests(supabase, dateFrom, dateTo, department)
    const requestIds = requests.map((r) => r.id)
    const items: ItemRow[] = []
    const orders: OrderRow[] = []
    const invoices: InvoiceRow[] = []

    if (requestIds.length > 0) {
      const chunkSize = 200
      for (let i = 0; i < requestIds.length; i += chunkSize) {
        const chunk = requestIds.slice(i, i + chunkSize)
        const [itemsRes, ordersRes] = await Promise.all([
          supabase
            .from('purchase_request_items')
            .select(
              'id, purchase_request_id, item_name, quantity, original_quantity, unit, brand, description, specifications, purpose'
            )
            .in('purchase_request_id', chunk),
          supabase
            .from('orders')
            .select('id, purchase_request_id, material_item_id')
            .in('purchase_request_id', chunk),
        ])
        if (itemsRes.error) throw itemsRes.error
        if (ordersRes.error) throw ordersRes.error
        items.push(...((itemsRes.data || []) as ItemRow[]))
        orders.push(...((ordersRes.data || []) as OrderRow[]))
      }

      const orderIds = orders.map((o) => o.id)
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize)
        if (chunk.length === 0) continue
        const invRes = await supabase
          .from('invoices')
          .select('id, order_id, amount, grand_total, currency, created_at, parent_invoice_id')
          .in('order_id', chunk)
          .is('parent_invoice_id', null)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
        if (invRes.error) throw invRes.error
        invoices.push(...((invRes.data || []) as InvoiceRow[]))
      }
    }

    const invoicesByOrder = new Map<string, InvoiceRow[]>()
    for (const inv of invoices) {
      const list = invoicesByOrder.get(inv.order_id) || []
      list.push(inv)
      invoicesByOrder.set(inv.order_id, list)
    }

    const ordersByItem = new Map<string, OrderRow[]>()
    for (const ord of orders) {
      if (!ord.material_item_id) continue
      const list = ordersByItem.get(ord.material_item_id) || []
      list.push(ord)
      ordersByItem.set(ord.material_item_id, list)
    }

    const requestById = new Map(requests.map((r) => [r.id, r]))

    const fx = await fetchEurFx()

    const lines: DepartmentSpendingLine[] = items.map((item) => {
      const req = requestById.get(item.purchase_request_id)
      const itemOrders = ordersByItem.get(item.id) || []
      const itemInvoices = itemOrders.flatMap((o) => invoicesByOrder.get(o.id) || [])
      const invoiceTotalsByCurrency = mergeCurrencyAmounts(
        itemInvoices.map((inv) => ({
          currency: inv.currency,
          amount: effectiveInvoiceAmount(inv),
        }))
      )
      let totalUsd: number | null = null
      if (fx && invoiceTotalsByCurrency.length > 0) {
        const map = new Map(invoiceTotalsByCurrency.map((t) => [t.currency, t.amount]))
        const { value } = aggregateCurrencyTotalsViaEurCross(map, 'USD', fx.rates)
        totalUsd = value
      }
      return {
        requestId: item.purchase_request_id,
        requestNumber: req?.request_number || item.purchase_request_id.slice(0, 8),
        requestCreatedAt: req?.created_at || '',
        department: req?.department || '—',
        siteName: req?.site_name || null,
        itemId: item.id,
        itemName: item.item_name || 'İsimsiz kalem',
        purpose: (item.purpose || '').trim() || null,
        description: (item.description || '').trim() || null,
        itemDetails: buildItemDetailLines(item),
        quantity: itemQty(item),
        unit: item.unit,
        invoiceCount: itemInvoices.length,
        invoiceTotalsByCurrency,
        totalUsd,
      }
    })

    const byDept = new Map<string, { requests: RequestRow[]; items: ItemRow[]; invoices: InvoiceRow[] }>()
    for (const req of requests) {
      const key = (req.department || 'Belirtilmemiş').trim() || 'Belirtilmemiş'
      if (!byDept.has(key)) byDept.set(key, { requests: [], items: [], invoices: [] })
      byDept.get(key)!.requests.push(req)
    }
    const requestDept = new Map(
      requests.map((r) => [r.id, (r.department || 'Belirtilmemiş').trim() || 'Belirtilmemiş'])
    )
    for (const item of items) {
      const key = requestDept.get(item.purchase_request_id) || 'Belirtilmemiş'
      if (!byDept.has(key)) byDept.set(key, { requests: [], items: [], invoices: [] })
      byDept.get(key)!.items.push(item)
    }
    const orderDept = new Map(
      orders.map((o) => [o.id, requestDept.get(o.purchase_request_id) || 'Belirtilmemiş'])
    )
    for (const inv of invoices) {
      const key = orderDept.get(inv.order_id) || 'Belirtilmemiş'
      if (!byDept.has(key)) byDept.set(key, { requests: [], items: [], invoices: [] })
      byDept.get(key)!.invoices.push(inv)
    }

    const departmentBreakdown = [...byDept.entries()]
      .map(([dept, bucket]) => buildSummary(dept, bucket.requests, bucket.items, bucket.invoices))
      .sort((a, b) => {
        const aSum = a.totalsByCurrency.reduce((s, c) => s + c.amount, 0)
        const bSum = b.totalsByCurrency.reduce((s, c) => s + c.amount, 0)
        return bSum - aSum
      })

    const summaryRaw = department
      ? buildSummary(department, requests, items, invoices)
      : buildSummary('Tüm departmanlar', requests, items, invoices)

    const summary = attachUsdTotals(
      summaryRaw || emptySummary(department || 'Tüm departmanlar'),
      fx
    )

    const departmentBreakdownWithUsd = departmentBreakdown.map((row) =>
      attachUsdTotals(row, fx)
    )

    const insights = buildSpendingInsights(lines, fx, summary.totalUsd)

    // Departman site_manager → PDF'de "Departman yöneticisi"
    const managerDepts = department
      ? [department]
      : [
          ...new Set(
            departmentBreakdownWithUsd
              .map((d) => d.department)
              .filter((d) => d && d !== 'Belirtilmemiş')
          ),
        ]

    let departmentManagers: DepartmentManagerInfo[] = []
    if (managerDepts.length > 0) {
      const { data: managerRows, error: managerErr } = await supabase
        .from('profiles')
        .select('full_name, email, department, role, is_active')
        .eq('role', 'site_manager')
        .eq('is_active', true)

      if (managerErr) {
        console.warn('department managers fetch:', managerErr.message)
      } else {
        const want = new Set(managerDepts.map((d) => d.trim().toLowerCase()))
        departmentManagers = (managerRows || [])
          .filter((p) => want.has((p.department || '').trim().toLowerCase()))
          .map((p) => ({
            fullName: (p.full_name || '').trim() || p.email || 'İsimsiz',
            email: p.email || null,
            department: (p.department || '').trim(),
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'))
      }
    }

    const report: DepartmentSpendingReport = {
      filters: { department, dateFrom, dateTo },
      summary,
      departmentBreakdown: departmentBreakdownWithUsd,
      departmentManagers,
      insights,
      lines,
    }

    return NextResponse.json(report)
  } catch (e: any) {
    console.error('department-spending report error:', e)
    return NextResponse.json({ error: e?.message || 'Rapor oluşturulamadı' }, { status: 500 })
  }
}
