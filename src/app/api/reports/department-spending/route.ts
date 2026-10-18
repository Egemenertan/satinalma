import { NextRequest, NextResponse } from 'next/server'
import { requireReportsAdmin, type ReportsSupabase } from '@/lib/reports/requireAdmin'
import {
  emptySummary,
  effectiveInvoiceAmount,
  mergeCurrencyAmounts,
  resolveReportDateRange,
  buildItemDetailLines,
  buildSpendingInsights,
  titleCaseTr,
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
  site_id: string | null
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

type Supabase = ReportsSupabase

async function fetchRequests(
  supabase: Supabase,
  dateFrom: string,
  dateTo: string,
  department: string | null,
  siteId: string | null
): Promise<RequestRow[]> {
  const pageSize = 1000
  const all: RequestRow[] = []
  let from = 0
  for (;;) {
    let q = supabase
      .from('purchase_requests')
      .select('id, request_number, department, site_id, site_name, created_at')
      .is('deleted_at', null)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (department) {
      q = q.ilike('department', department)
    }
    if (siteId) {
      q = q.eq('site_id', siteId)
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

function groupKey(value: string | null | undefined, fallback: string) {
  const trimmed = (value || '').trim()
  return trimmed || fallback
}

function buildGroupedSummaries(
  requests: RequestRow[],
  items: ItemRow[],
  orders: OrderRow[],
  invoices: InvoiceRow[],
  keyOfRequest: (req: RequestRow) => string
): DepartmentSpendingSummary[] {
  const byKey = new Map<string, { requests: RequestRow[]; items: ItemRow[]; invoices: InvoiceRow[] }>()
  for (const req of requests) {
    const key = keyOfRequest(req)
    if (!byKey.has(key)) byKey.set(key, { requests: [], items: [], invoices: [] })
    byKey.get(key)!.requests.push(req)
  }
  const requestKey = new Map(requests.map((r) => [r.id, keyOfRequest(r)]))
  for (const item of items) {
    const key = requestKey.get(item.purchase_request_id) || 'Belirtilmemiş'
    if (!byKey.has(key)) byKey.set(key, { requests: [], items: [], invoices: [] })
    byKey.get(key)!.items.push(item)
  }
  const orderKey = new Map(
    orders.map((o) => [o.id, requestKey.get(o.purchase_request_id) || 'Belirtilmemiş'])
  )
  for (const inv of invoices) {
    const key = orderKey.get(inv.order_id) || 'Belirtilmemiş'
    if (!byKey.has(key)) byKey.set(key, { requests: [], items: [], invoices: [] })
    byKey.get(key)!.invoices.push(inv)
  }

  return [...byKey.entries()]
    .map(([label, bucket]) => buildSummary(label, bucket.requests, bucket.items, bucket.invoices))
    .sort((a, b) => {
      const aSum = a.totalsByCurrency.reduce((s, c) => s + c.amount, 0)
      const bSum = b.totalsByCurrency.reduce((s, c) => s + c.amount, 0)
      return bSum - aSum
    })
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
    const auth = await requireReportsAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { supabase } = auth as { supabase: Supabase }

    const sp = request.nextUrl.searchParams
    const filters: DepartmentSpendingFilters = {
      department: sp.get('department'),
      site: sp.get('site'),
      month: sp.get('month'),
      dateFrom: sp.get('dateFrom'),
      dateTo: sp.get('dateTo'),
    }
    const { dateFrom, dateTo } = resolveReportDateRange(filters)
    const department = filters.department?.trim() || null
    const siteId = filters.site?.trim() || null
    const dimension = (sp.get('dimension') || '').trim()

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

    if (sp.get('meta') === 'sites') {
      const { data: sites, error: siteErr } = await supabase
        .from('sites')
        .select('id, name')
        .order('name', { ascending: true })
      if (siteErr) throw siteErr
      return NextResponse.json({
        sites: (sites || []).map((s) => ({
          id: s.id,
          name: titleCaseTr(s.name),
        })),
      })
    }

    const requests = await fetchRequests(supabase, dateFrom, dateTo, department, siteId)
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

    const siteIds = [...new Set(requests.map((r) => r.site_id).filter((id): id is string => Boolean(id)))]
    const siteNameById = new Map<string, string>()
    if (siteIds.length > 0) {
      const { data: siteRows } = await supabase.from('sites').select('id, name').in('id', siteIds)
      for (const site of siteRows || []) {
        siteNameById.set(site.id, titleCaseTr(site.name))
      }
    }

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
        siteName: req?.site_name || (req?.site_id ? siteNameById.get(req.site_id) : null) || null,
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

    const departmentBreakdown = buildGroupedSummaries(requests, items, orders, invoices, (req) =>
      groupKey(req.department, 'Belirtilmemiş')
    )
    const siteBreakdown = buildGroupedSummaries(requests, items, orders, invoices, (req) =>
      groupKey(req.site_name || (req.site_id ? siteNameById.get(req.site_id) : null), 'Belirtilmemiş')
    )

    const selectedSiteName = siteId
      ? siteNameById.get(siteId) ||
        requests.find((r) => r.site_id === siteId)?.site_name ||
        'Seçili Şantiye'
      : null

    const summaryLabel = department
      ? department
      : selectedSiteName
        ? selectedSiteName
        : siteId
          ? 'Seçili Şantiye'
          : dimension === 'site'
            ? 'Tüm Şantiyeler'
            : 'Tüm Departmanlar'

    const summaryRaw = buildSummary(summaryLabel, requests, items, invoices)

    const summary = attachUsdTotals(summaryRaw || emptySummary(summaryLabel), fx)

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

    const siteBreakdownWithUsd = siteBreakdown.map((row) => attachUsdTotals(row, fx))

    const report: DepartmentSpendingReport = {
      filters: { department, site: siteId, dateFrom, dateTo },
      summary,
      departmentBreakdown: departmentBreakdownWithUsd,
      siteBreakdown: siteBreakdownWithUsd,
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
