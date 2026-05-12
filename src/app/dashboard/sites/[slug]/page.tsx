'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Package,
  Receipt,
  Store,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import { ConvertedTotalsCards, ConvertedTotalsStack } from '@/components/finance/site-fx-converted-totals'
import { SiteMaterialGroupsBreakdown, type SiteOrderedMaterialLine } from '@/components/finance/site-material-groups-breakdown'
import { DateFilter } from '@/app/dashboard/orders/components/OrderFilters/DateFilter'
import {
  aggregateInvoicesByCurrency,
  countAttributedInvoiceRows,
  currencyTotalsSortedEntries,
  dailyInvoiceTotalsPerCurrencyByDayKey,
  filterInvoiceRowsByCreatedAtRange,
  formatCurrencyTotalsLine,
  invoicedByOrderIdPerCurrency,
  invoicedCurrencyTotalsByOrderGroup,
  mergeCurrencyTotals,
  normalizedMaterialGroupLabel,
  sumAllCurrenciesTotals,
  type InvoiceTotalsDateRange,
} from '@/lib/site-invoice-aggregation'
import { SiteFinanceFxProvider, SiteFinanceFxToolbar } from '@/contexts/site-finance-fx'
import { SiteDetailPdfReportButton } from '@/components/finance/site-detail-pdf-report-button'
import type { SiteDetailPdfOrderRow, SiteDetailPdfSupplierRow } from '@/lib/pdf/site-detail-summary-pdf'

function createSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function sparkHeightsFromCounts(counts: number[]): number[] {
  if (!counts.length) return counts
  const max = Math.max(...counts, 1)
  return counts.map((c) => Math.round((c / max) * 100))
}

function trendPercent(series: number[]): number | null {
  if (series.length < 8) return null
  const prev = series.slice(-8, -4).reduce((a, b) => a + b, 0)
  const cur = series.slice(-4).reduce((a, b) => a + b, 0)
  if (prev <= 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

function logisticsSpark(values: number[], gradientId: string) {
  const w = 100
  const h = 44
  const series = values.length === 1 ? [values[0], values[0]] : values.length === 0 ? [0, 0] : values
  const max = Math.max(...series, 1)
  let lastCx = w / 2
  let lastCy = h / 2
  const pts = series.map((v, i) => {
    const x = series.length <= 1 ? w / 2 : (i / (series.length - 1)) * w
    const y = h - (v / max) * (h - 10) - 5
    lastCx = x
    lastCy = y
    return `${x},${y}`
  })
  const line = `M ${pts.join(' L ')}`
  const fillPath = `${line} L ${w} ${h} L 0 ${h} Z`
  const safeGid = gradientId.replace(/:/g, '')

  return (
    <svg className="h-28 w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={safeGid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#00E676" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${safeGid})`} />
      <path
        d={line}
        fill="none"
        stroke="#00E676"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 10px rgba(0, 230, 118, 0.38))' }}
      />
      <circle cx={lastCx} cy={lastCy} r={3.5} fill="#00E676" style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,118,0.6))' }} />
    </svg>
  )
}

function DeltaPill({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <div
      className={cn(
        'flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
        up ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-600'
      )}
    >
      {up ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
      {up ? '+' : ''}
      {value}%
    </div>
  )
}

function SparkBars({
  heightsPct,
  accentClass,
}: {
  heightsPct: number[]
  accentClass: string
}) {
  return (
    <div className="mt-5 flex h-12 w-full items-end gap-[3px]">
      {heightsPct.map((h, i) => (
        <div
          key={i}
          className={cn(
            'flex-1 rounded-t-[3px] transition-all duration-300',
            i === heightsPct.length - 1 ? accentClass : 'bg-elegant-gray-400 dark:bg-elegant-gray-500'
          )}
          style={{ height: `${Math.max(18, h)}%` }}
        />
      ))}
    </div>
  )
}

function formatCompactTry(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 0)}K`
  return Math.round(value).toLocaleString('tr-TR')
}

const INVOICE_STROKE_PRESET: Record<string, string> = {
  TRY: '#f59e0b',
  USD: '#0ea5e9',
  EUR: '#a855f7',
  GBP: '#ec4899',
}
const INVOICE_STROKE_FALLBACK = ['#14b8a6', '#eab308', '#f97316', '#84cc16', '#64748b'] as const

function strokeForInvoiceCurrency(code: string, index: number): string {
  const c = code.trim().toUpperCase()
  return INVOICE_STROKE_PRESET[c] ?? INVOICE_STROKE_FALLBACK[index % INVOICE_STROKE_FALLBACK.length]
}

/** Günlük: döviz bazlı fatura çizgileri + günlük sipariş tutarı (ham). */
function FinanceInvoiceOrderChart({
  labels,
  invoiceSeries,
  orderDaily,
  gradientFillOrd,
}: {
  labels: string[]
  invoiceSeries: { code: string; daily: number[]; stroke: string }[]
  orderDaily: number[]
  gradientFillOrd: string
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const n = Math.max(labels.length, 2)
  const pad = (series: number[]) =>
    series.length < n ? [...series, ...Array(n - series.length).fill(0)] : series
  const ordPad = pad(orderDaily)
  const invoicedSeries = invoiceSeries.map((s) => ({
    code: s.code,
    stroke: s.stroke,
    padded: pad(s.daily),
  }))
  const labPad = labels.length < n ? [...labels, ...Array(n - labels.length).fill('')] : labels

  const flatInv = invoicedSeries.flatMap((s) => s.padded)
  const maxY = Math.max(1, ...ordPad, ...flatInv)

  const W = 1000
  const H = 280
  const pl = 78
  const pr = 28
  const pt = 36
  const pb = 52
  const iw = W - pl - pr
  const ih = H - pt - pb

  const pts = (_series: number[]) =>
    labPad.map((_, i) => {
      const x = n <= 1 ? pl + iw / 2 : pl + (i / (n - 1)) * iw
      const v = _series[i] ?? 0
      const y = pt + ih - (v / maxY) * ih
      return [x, y] as const
    })

  const anchorDaily = invoicedSeries[0]?.padded ?? ordPad
  const anchorPts = pts(anchorDaily)
  const ordPts = pts(ordPad)

  type PtSeries = typeof anchorPts
  const invPtsSeries: PtSeries[] = invoicedSeries.map((s) => pts(s.padded))

  const smoothPath = (series: PtSeries): string => {
    if (series.length === 0) return ''
    if (series.length === 1) return `M ${series[0][0]},${series[0][1]}`
    let d = `M ${series[0][0]},${series[0][1]}`
    for (let i = 0; i < series.length - 1; i++) {
      const [x0, y0] = series[i]
      const [x1, y1] = series[i + 1]
      const mx = (x0 + x1) / 2
      d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`
    }
    return d
  }

  const areaPath = (series: PtSeries): string => {
    const line = smoothPath(series)
    if (!line) return ''
    const firstX = series[0][0]
    const lastX = series[series.length - 1][0]
    const base = pt + ih
    return `${line} L ${lastX},${base} L ${firstX},${base} Z`
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = pt + ih - t * ih
    return { y, label: formatCompactTry(t * maxY) }
  })

  const onLeave = () => setHoverIdx(null)

  const onMove = (e: { currentTarget: SVGSVGElement; clientX: number }) => {
    if (n <= 1) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const gx = ((e.clientX - rect.left) / rect.width) * W
    const rel = (gx - pl) / iw
    const idx = Math.round(rel * (n - 1))
    const clamped = Math.max(0, Math.min(n - 1, idx))
    setHoverIdx(clamped)
  }

  const hx = hoverIdx != null ? anchorPts[hoverIdx]?.[0] : null

  const safeFillOrd = gradientFillOrd.replace(/:/g, '')

  return (
    <div className="w-full rounded-xl bg-gradient-to-b from-elegant-gray-50/90 to-transparent dark:from-elegant-black/40">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full min-h-[220px] w-full touch-none select-none"
        preserveAspectRatio="xMidYMid meet"
        onPointerLeave={onLeave}
        onPointerMove={onMove}
      >
        <defs>
          <linearGradient id={safeFillOrd} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="finance-grid" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#e5e7eb" stopOpacity={0} />
            <stop offset="8%" stopColor="#e5e7eb" stopOpacity={0.45} />
            <stop offset="92%" stopColor="#e5e7eb" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#e5e7eb" stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridLines.map(({ y, label }, gi) => (
          <g key={gi}>
            <line x1={pl} y1={y} x2={W - pr} y2={y} stroke="url(#finance-grid)" strokeWidth={gi === gridLines.length - 1 ? 1.25 : 0.85} opacity={gi === gridLines.length - 1 ? 0.85 : 0.45} vectorEffect="non-scaling-stroke" />
            <text x={pl - 12} y={y + 4} textAnchor="end" className="fill-elegant-gray-400 text-[11px]" style={{ fontFamily: 'ui-monospace, monospace' }}>
              {label}
            </text>
          </g>
        ))}

        <path d={areaPath(ordPts)} fill={`url(#${safeFillOrd})`} />

        {invoicedSeries.map((s, si) => (
          <path
            key={s.code}
            d={smoothPath(invPtsSeries[si]!)}
            fill="none"
            stroke={s.stroke}
            strokeWidth={si === 0 ? 2.6 : 2.35}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        <path
          d={smoothPath(ordPts)}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.25))' }}
        />

        {hoverIdx != null && hx != null && (
          <>
            <line x1={hx} y1={pt} x2={hx} y2={pt + ih} stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" opacity={0.55} vectorEffect="non-scaling-stroke" />
            {invoicedSeries.map((s, si) =>
              Math.abs(invoicedSeries[si]?.padded[hoverIdx] ?? 0) > 1e-9 ? (
                <circle
                  key={s.code}
                  cx={invPtsSeries[si]![hoverIdx]![0]}
                  cy={invPtsSeries[si]![hoverIdx]![1]}
                  r={5}
                  fill="#fff"
                  stroke={s.stroke}
                  strokeWidth={2}
                />
              ) : null
            )}
            <circle cx={ordPts[hoverIdx]![0]} cy={ordPts[hoverIdx]![1]} r={6} fill="#fff" stroke="#6366f1" strokeWidth={2} />
          </>
        )}

        {labPad.map((lbl, i) => {
          if (n > 14 && i % 2 !== 0 && i !== n - 1 && i !== 0) return null
          const x = anchorPts[i]![0]
          return (
            <text key={i} x={x} y={H - 12} textAnchor="middle" className="fill-elegant-gray-500 text-[10px] font-medium" style={{ fontFamily: 'system-ui' }}>
              {lbl}
            </text>
          )
        })}
      </svg>

      {hoverIdx != null && (
        <div className="-mt-3 flex justify-center px-2 pb-4">
          <div className="max-w-full rounded-2xl border border-elegant-gray-200 bg-white/95 px-4 py-3 text-[11px] shadow-sm backdrop-blur dark:border-elegant-gray-700 dark:bg-elegant-gray-900/95">
            <div className="text-center font-semibold text-elegant-gray-900 dark:text-white">{labPad[hoverIdx] || '—'}</div>
            <div className="mx-auto mt-2 flex max-w-sm flex-col items-stretch gap-1.5 text-left">
              {invoicedSeries.length === 0 ? (
                <p className="text-center text-[10px] text-elegant-gray-500 dark:text-elegant-gray-400">Bu şantiyede bağlı siparişlere atanmış faturalanan tutar yok.</p>
              ) : (
                invoicedSeries.map((s, si) => {
                  const v = s.padded[hoverIdx] ?? 0
                  return (
                    <div key={s.code} className="flex items-baseline justify-between gap-3 tabular-nums">
                      <span className="min-w-[2.75rem] font-semibold tracking-tight" style={{ color: s.stroke }}>
                        {s.code}
                      </span>
                      <span className="text-elegant-gray-800 dark:text-elegant-gray-200">
                        {Math.abs(v) < 1e-9 ? '—' : formatCurrency(v, s.code)}
                      </span>
                    </div>
                  )
                })
              )}
              <div className="mt-0.5 flex items-baseline justify-between gap-3 border-t border-elegant-gray-200 pt-2 text-indigo-600 dark:text-indigo-400">
                <span className="font-semibold tabular-nums">Sipariş gün*</span>
                <span className="tabular-nums text-elegant-gray-800 dark:text-elegant-gray-200">{formatCompactTry(ordPad[hoverIdx] ?? 0)}</span>
              </div>
            </div>
            <p className="mx-auto mt-2 max-w-sm text-[9px] leading-snug text-elegant-gray-500 dark:text-elegant-gray-400">
              Her fatura dövizi kendi ekseninde; sipariş gününde ise farklı para birimleri karışık toplanmış olabilir.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

type ChartRange = 7 | 14 | 30

type DailyPoint = { dayKey: string; label: string; requests: number; amount: number }

interface ProfileRef {
  full_name: string | null
  email: string | null
}

interface PurchaseRequestRow {
  id: string
  title: string
  request_number: string
  status: string
  workflow_status: string | null
  created_at: string
  total_amount: number | string | null
  currency: string | null
  urgency_level: string | null
  requested_by: string
  profiles?: ProfileRef | ProfileRef[] | null
}

interface SiteRow {
  id: string
  name: string
  created_at: string
  updated_at: string
  approved_expenses?: number | null
  total_budget?: number | null
  image_url?: string | null
}

interface OrderRow {
    id: string
  supplier_id: string
  amount: number | string | null
    currency: string
  status: string | null
    delivery_date: string
    created_at: string
    purchase_request_id: string
  material_item_id?: string | null
  suppliers?: { name: string | null } | { name: string | null }[] | null
  purchase_requests?: { title: string | null; request_number: string | null } | Array<{
    title: string | null
    request_number: string | null
  }> | null
}

interface PurchaseRequestMaterialItemRow {
  id: string
  material_group: string | null
  item_name: string | null
  purpose: string | null
  unit: string | null
  quantity: number | string | null
  /** Talep ilk oluşturulurken girilen miktar (güncel `quantity` değişmiş olsa bile) */
  original_quantity: number | string | null
}

interface SiteInvoiceRow {
  id: string
  order_id: string
  amount: number | string | null
  grand_total: number | string | null
  currency: string | null
  created_at: string | null
  parent_invoice_id: string | null
  is_master: boolean | null
}

interface ApprovedOfferRow {
    id: string
    supplier_name: string
    total_price: number
  currency: string | null
  delivery_days: number | null
    created_at: string
  offer_date: string | null
  purchase_request_id: string
}

const TERMINAL_WF = new Set(['completed', 'rejected', 'cancelled'])
/** Sipariş satırında material_item_id yok veya kaleme çözülmemişse fatura grubu */
const MATERIAL_GROUP_ORDER_UNLINKED_LABEL = 'Satır seçilmemiş sipariş'

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase()
  if (s.includes('red') || s.includes('cancel') || s.includes('iptal')) {
    return 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900 dark:text-red-400'
  }
  if (s.includes('tamam') || s.includes('complete')) {
    return 'border-primary/30 bg-primary/10 text-primary'
  }
  if (s.includes('bekle') || s.includes('draft') || s.includes('taslak')) {
    return 'border-amber-200 bg-amber-500/10 text-amber-800 dark:border-amber-900 dark:text-amber-400'
  }
  return 'border-elegant-gray-200 bg-elegant-gray-100 text-elegant-gray-700 dark:border-elegant-gray-700 dark:bg-elegant-gray-800 dark:text-elegant-gray-200'
}

function workflowLabel(wf: string | null): string {
  if (!wf) return '—'
  const map: Record<string, string> = {
    draft: 'Taslak',
    submitted_to_site_manager: 'Şantiye yöneticisi',
    approved_by_site_manager: 'Şantiye onayı',
    assigned_to_purchasing: 'Satın almaya atandı',
    in_progress: 'İşlemde',
    offers_requested: 'Teklif istendi',
    offers_received: 'Teklif alındı',
    supplier_assigned: 'Tedarikçi atandı',
    ordered: 'Sipariş',
    completed: 'Tamamlandı',
    rejected: 'Reddedildi',
    cancelled: 'İptal',
  }
  return map[wf] || wf.replace(/_/g, ' ')
}

function pickSupplierName(o: OrderRow): string {
  const s = o.suppliers
  if (!s) return 'Bilinmeyen tedarikçi'
  const one = Array.isArray(s) ? s[0] : s
  const n = one?.name
  return (n && String(n).trim()) || 'Bilinmeyen tedarikçi'
}

function linkedRequestLabel(o: OrderRow): { title: string; requestNo: string } {
  const p = o.purchase_requests
  if (!p) return { title: '—', requestNo: '' }
  const one = Array.isArray(p) ? p[0] : p
  const title = (one?.title && String(one.title).trim()) || '—'
  const requestNo = (one?.request_number && String(one.request_number).trim()) || ''
  return { title, requestNo }
}

function parseOrderAmount(o: OrderRow): number {
  const v = typeof o.amount === 'string' ? parseFloat(o.amount) : Number(o.amount ?? 0)
  return Number.isFinite(v) ? v : 0
}

export default function SiteDetailPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = typeof params?.slug === 'string' ? params.slug : ''

  const gidAmount = useId()
  const gidRequests = useId()
  const gidFinanceFillOrd = useId()
  const chartAreaRef = useRef<HTMLDivElement>(null)

  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [siteMeta, setSiteMeta] = useState<SiteRow | null>(null)
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestRow[]>([])
  const [lineItemCount, setLineItemCount] = useState(0)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [siteInvoices, setSiteInvoices] = useState<SiteInvoiceRow[]>([])
  const [approvedOffers, setApprovedOffers] = useState<ApprovedOfferRow[]>([])
  const [purchaseRequestMaterials, setPurchaseRequestMaterials] = useState<PurchaseRequestMaterialItemRow[]>([])

  const [chartRange, setChartRange] = useState<ChartRange>(14)
  const [chartTooltipIdx, setChartTooltipIdx] = useState<number | null>(null)
  const [invoiceTotalsDateRange, setInvoiceTotalsDateRange] = useState<InvoiceTotalsDateRange>({
    from: undefined,
    to: undefined,
  })

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)

    try {
      const { data: sitesData, error: sitesError } = await supabase.from('sites').select('*')
      if (sitesError) throw sitesError

      const siteRow = (sitesData || []).find((s) => createSlug(s.name) === slug)
      if (!siteRow) {
        setSiteMeta(null)
        setPurchaseRequests([])
        setOrders([])
        setApprovedOffers([])
        setSiteInvoices([])
        setLineItemCount(0)
        setPurchaseRequestMaterials([])
        return
      }

      const { data: prData, error: prError } = await supabase
        .from('purchase_requests')
        .select(
          `
          id,
          title,
          request_number,
          status,
          workflow_status,
          created_at,
          total_amount,
          currency,
          urgency_level,
          requested_by,
          profiles!purchase_requests_requested_by_fkey(full_name, email)
        `
        )
        .eq('site_id', siteRow.id)
        .order('created_at', { ascending: false })

      if (prError) throw prError
      const requests = (prData || []) as PurchaseRequestRow[]
      const prIds = requests.map((r) => r.id)

      let itemCount = 0
      let priFetched: PurchaseRequestMaterialItemRow[] = []
      if (prIds.length) {
        const { count, error: cErr } = await supabase
          .from('purchase_request_items')
          .select('*', { count: 'exact', head: true })
          .in('purchase_request_id', prIds)
        if (!cErr && count != null) itemCount = count

        const priChunkSize = 200
        for (let i = 0; i < prIds.length; i += priChunkSize) {
          const sliceIds = prIds.slice(i, i + priChunkSize)
          const { data: piData, error: piErr } = await supabase
            .from('purchase_request_items')
            .select('id, material_group, item_name, purpose, unit, quantity, original_quantity')
            .in('purchase_request_id', sliceIds)
          if (!piErr && piData) priFetched = priFetched.concat(piData as PurchaseRequestMaterialItemRow[])
        }
      }

      let ordersFetched: OrderRow[] = []
      if (prIds.length) {
        const { data: ord, error: oErr } = await supabase
          .from('orders')
          .select(
            `
            id,
          supplier_id,
            amount,
            currency,
            status,
            delivery_date,
            created_at,
          purchase_request_id,
          material_item_id,
          suppliers!orders_supplier_id_fkey(name),
          purchase_requests!orders_purchase_request_id_fkey(title, request_number)
        `
          )
          .in('purchase_request_id', prIds)
          .order('created_at', { ascending: false })

        if (!oErr && ord) ordersFetched = ord as unknown as OrderRow[]
      }

      let invoicesFetched: SiteInvoiceRow[] = []
      const orderIds = ordersFetched.map((o) => o.id).filter(Boolean)
      if (orderIds.length > 0) {
        const chunkSize = 100
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize)
          const { data: invData, error: invErr } = await supabase
            .from('invoices')
            .select(
              'id, order_id, amount, grand_total, currency, created_at, parent_invoice_id, is_master'
            )
            .in('order_id', chunk)
          if (!invErr && invData) {
            invoicesFetched = invoicesFetched.concat(invData as SiteInvoiceRow[])
          }
        }
      }

      let offersFetched: ApprovedOfferRow[] = []
      const { data: offData, error: offErr } = await supabase
        .from('offers')
        .select(
          'id, supplier_name, total_price, currency, delivery_days, created_at, offer_date, purchase_request_id'
        )
        .eq('site_id', siteRow.id)
        .eq('is_selected', true)
        .order('created_at', { ascending: false })

      if (!offErr && offData) {
        offersFetched = offData as ApprovedOfferRow[]
      }

      setSiteMeta(siteRow as SiteRow)
      setPurchaseRequests(requests)
      setLineItemCount(itemCount)
      setPurchaseRequestMaterials(priFetched)
      setOrders(ordersFetched)
      setSiteInvoices(invoicesFetched)
      setApprovedOffers(offersFetched)
    } catch (e) {
      console.error('Şantiye detayları:', e)
      setSiteMeta(null)
      setSiteInvoices([])
      setOrders([])
      setPurchaseRequests([])
      setPurchaseRequestMaterials([])
    } finally {
      setLoading(false)
    }
  }, [slug, supabase])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!siteMeta?.id) return
    const ch = supabase
      .channel(`site_${siteMeta.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_requests', filter: `site_id=eq.${siteMeta.id}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sites', filter: `id=eq.${siteMeta.id}` },
        () => load()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()
    return () => {
      ch.unsubscribe()
    }
  }, [siteMeta?.id, supabase, load])

  useEffect(() => setChartTooltipIdx(null), [
    chartRange,
    siteMeta?.id,
    purchaseRequests.length,
    invoiceTotalsDateRange.from?.getTime(),
    invoiceTotalsDateRange.to?.getTime(),
  ])

  useEffect(() => {
    if (chartTooltipIdx === null) return
    const fn = (e: PointerEvent) => {
      if (chartAreaRef.current && !chartAreaRef.current.contains(e.target as Node)) setChartTooltipIdx(null)
    }
    document.addEventListener('pointerdown', fn)
    return () => document.removeEventListener('pointerdown', fn)
  }, [chartTooltipIdx])

  const dailyPoints: DailyPoint[] = useMemo(() => {
    const map = new Map<string, DailyPoint>()
    for (const r of purchaseRequests) {
      const d = new Date(r.created_at)
      const dayKey = d.toISOString().slice(0, 10)
      if (!map.has(dayKey)) {
        map.set(dayKey, {
          dayKey,
          label: d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
          requests: 0,
          amount: 0,
        })
      }
      const cur = map.get(dayKey)!
      cur.requests += 1
      const amt = typeof r.total_amount === 'string' ? parseFloat(r.total_amount) : Number(r.total_amount ?? 0)
      cur.amount += Number.isFinite(amt) ? amt : 0
    }

    const keys = [...map.keys()].sort()
    return keys.map((k) => map.get(k)!)
  }, [purchaseRequests])

  const chartSlice = useMemo(() => {
    const n = dailyPoints.length
    const take = Math.min(chartRange, n || 30)
    const slice = dailyPoints.slice(-take)
    if (slice.length) return slice
    const today = new Date()
    const out: DailyPoint[] = []
    for (let i = take - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      out.push({
        dayKey: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
        requests: 0,
        amount: 0,
      })
    }
    return out
  }, [dailyPoints, chartRange])

  const siteInvoicesForTotals = useMemo(
    () => filterInvoiceRowsByCreatedAtRange(siteInvoices, invoiceTotalsDateRange),
    [siteInvoices, invoiceTotalsDateRange]
  )

  const totals = useMemo(() => {
    const total_requests = purchaseRequests.length
    const ordersAmount = orders.reduce((sum, o) => {
      const v = typeof o.amount === 'string' ? parseFloat(o.amount) : Number(o.amount ?? 0)
      return sum + (Number.isFinite(v) ? v : 0)
    }, 0)
    const inPipeline = purchaseRequests.filter(
      (r) => !TERMINAL_WF.has((r.workflow_status || 'draft').toLowerCase())
    ).length
    const legacyApproved = purchaseRequests.filter((r) => (r.status || '').toLowerCase() === 'approved').length

    const sparkCounts = dailyPoints.slice(-7).map((d) => d.requests)
    const logisticsReqTrend = trendPercent(dailyPoints.map((d) => d.requests))

    const orderIds = orders.map((o) => o.id).filter(Boolean)
    const invoicedByCurrency = aggregateInvoicesByCurrency(orderIds, siteInvoicesForTotals)
    const invoiceAttributedRows = countAttributedInvoiceRows(orderIds, siteInvoicesForTotals)

    return {
      total_requests,
      lineItemCount,
      orders_count: orders.length,
      ordersAmount,
      invoicedByCurrency,
      invoiceAttributedRows,
      inPipeline,
      legacyApproved,
      sparkCounts,
      logisticsReqTrend,
    }
  }, [purchaseRequests, orders, lineItemCount, dailyPoints, siteInvoicesForTotals])

  const chartSliceComputed = useMemo(() => ({
    counts: chartSlice.map((d) => d.requests),
    amounts: chartSlice.map((d) => d.amount),
    labels: chartSlice.map((d) => d.label),
    keys: chartSlice.map((d) => d.dayKey),
  }), [chartSlice])

  const rawBarMax = Math.max(...chartSliceComputed.counts, 0)
  const barMax = rawBarMax === 0 ? 1 : rawBarMax
  const highlightedIdx =
    chartSliceComputed.counts.length > 0 ? chartSliceComputed.counts.lastIndexOf(Math.max(...chartSliceComputed.counts)) : -1

  const trySliceSum = chartSliceComputed.amounts.reduce((a, b) => a + b, 0)
  const requestSliceSum = chartSliceComputed.counts.reduce((a, b) => a + b, 0)
  const logisticsAmountTrendSlice = trendPercent(chartSliceComputed.amounts)
  const logisticsRequestsTrendSlice = trendPercent(chartSliceComputed.counts)

  const financeDailySeries = useMemo(() => {
    const orderIds = orders.map((o) => o.id).filter(Boolean)
    const ordersByDay = new Map<string, number>()
    for (const o of orders) {
      const k = new Date(o.created_at).toISOString().slice(0, 10)
      const v = typeof o.amount === 'string' ? parseFloat(o.amount) : Number(o.amount ?? 0)
      if (!Number.isFinite(v)) continue
      ordersByDay.set(k, (ordersByDay.get(k) ?? 0) + v)
    }
    const byDayInvCur = dailyInvoiceTotalsPerCurrencyByDayKey(orderIds, siteInvoicesForTotals)
    const codesForChart = currencyTotalsSortedEntries(
      aggregateInvoicesByCurrency(orderIds, siteInvoicesForTotals)
    ).map(([c]) => c)
    const invoiceSeries = codesForChart.map((code, idx) => ({
      code,
      stroke: strokeForInvoiceCurrency(code, idx),
      daily: chartSlice.map((d) => byDayInvCur.get(d.dayKey)?.get(code) ?? 0),
    }))
    const labels = chartSlice.map((d) => d.label)
    const orderDaily = chartSlice.map((d) => ordersByDay.get(d.dayKey) ?? 0)
    return { labels, invoiceSeries, orderDaily }
  }, [chartSlice, orders, siteInvoicesForTotals])

  const invoicedByOrderPerCurrency = useMemo(
    () => invoicedByOrderIdPerCurrency(orders.map((o) => o.id), siteInvoicesForTotals),
    [orders, siteInvoicesForTotals]
  )

  const supplierBreakdown = useMemo(() => {
    type Agg = {
      supplierId: string
      name: string
      orderCount: number
      invoicedByCurrency: Map<string, number>
    }
    const m = new Map<string, Agg>()
    for (const o of orders) {
      const sid = o.supplier_id || '__none__'
      const name = pickSupplierName(o)
      const invMap = invoicedByOrderPerCurrency.get(o.id) ?? new Map()
      let row = m.get(sid)
      if (!row) {
        row = { supplierId: sid, name, orderCount: 0, invoicedByCurrency: new Map() }
        m.set(sid, row)
      }
      row.orderCount += 1
      row.invoicedByCurrency = mergeCurrencyTotals(row.invoicedByCurrency, invMap)
    }
    return [...m.values()].sort((a, b) => {
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount
      const bTry = b.invoicedByCurrency.get('TRY') ?? 0
      const aTry = a.invoicedByCurrency.get('TRY') ?? 0
      if (bTry !== aTry) return bTry - aTry
      return sumAllCurrenciesTotals(b.invoicedByCurrency) - sumAllCurrenciesTotals(a.invoicedByCurrency)
    })
  }, [orders, invoicedByOrderPerCurrency])

  const materialGroupBreakdownBase = useMemo(() => {
    const itemIdToGroupLabel = new Map<string, string>()
    for (const pi of purchaseRequestMaterials) {
      itemIdToGroupLabel.set(pi.id, normalizedMaterialGroupLabel(pi.material_group))
    }

    const orderIdToGroup = new Map<string, string>()
    for (const o of orders) {
      const mid = o.material_item_id
      if (mid && itemIdToGroupLabel.has(mid)) orderIdToGroup.set(o.id, itemIdToGroupLabel.get(mid)!)
    }

    const orderIds = orders.map((o) => o.id).filter(Boolean)
    const invoicedByGroup = invoicedCurrencyTotalsByOrderGroup(siteInvoicesForTotals, orderIdToGroup, new Set(orderIds), {
      unattributedLabel: MATERIAL_GROUP_ORDER_UNLINKED_LABEL,
    })

    const itemCountByLabel = new Map<string, number>()
    for (const pi of purchaseRequestMaterials) {
      const lb = normalizedMaterialGroupLabel(pi.material_group)
      itemCountByLabel.set(lb, (itemCountByLabel.get(lb) ?? 0) + 1)
    }

    const orderCountByLabel = new Map<string, number>()
    for (const o of orders) {
      const mid = o.material_item_id
      const lb =
        mid && itemIdToGroupLabel.has(mid)
          ? itemIdToGroupLabel.get(mid)!
          : MATERIAL_GROUP_ORDER_UNLINKED_LABEL
      orderCountByLabel.set(lb, (orderCountByLabel.get(lb) ?? 0) + 1)
    }

    const union = new Set<string>([
      ...itemCountByLabel.keys(),
      ...invoicedByGroup.keys(),
      ...orderCountByLabel.keys(),
    ])

    const rows = [...union].map((groupLabel) => ({
      groupLabel,
      requestItemCount: itemCountByLabel.get(groupLabel) ?? 0,
      orderCount: orderCountByLabel.get(groupLabel) ?? 0,
      invoiced: invoicedByGroup.get(groupLabel) ?? new Map<string, number>(),
    }))

    rows.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, 'tr'))
    return rows
  }, [orders, siteInvoicesForTotals, purchaseRequestMaterials])

  const orderedMaterialLinesByGroup = useMemo(() => {
    const ordersPerMaterial = new Map<string, number>()
    for (const o of orders) {
      const mid = o.material_item_id
      if (!mid) continue
      ordersPerMaterial.set(mid, (ordersPerMaterial.get(mid) ?? 0) + 1)
    }

    const itemById = new Map(purchaseRequestMaterials.map((p) => [p.id, p]))
    const byGroup: Record<string, SiteOrderedMaterialLine[]> = {}

    function formatTalepAdet(n: number): string {
      if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toLocaleString('tr-TR')
      return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
    }

    const fmtQty = (q: unknown): string | null => {
      if (q == null || q === '') return null
      if (typeof q === 'number') {
        if (!Number.isFinite(q)) return null
        return formatTalepAdet(q)
      }
      const s = String(q).trim()
      if (!s) return null
      const normalized = s.replace(/\s/g, '').replace(',', '.')
      const n = Number(normalized)
      if (Number.isFinite(n)) return formatTalepAdet(n)
      return s
    }

    /** İlk talep edilen adet: `original_quantity` doluysa o, değilse güncel `quantity`. */
    const talepAdetLabel = (pi: PurchaseRequestMaterialItemRow): string | null => {
      const hasOrig = pi.original_quantity != null && pi.original_quantity !== ''
      if (hasOrig) {
        const o = fmtQty(pi.original_quantity)
        if (o != null) return o
      }
      return fmtQty(pi.quantity)
    }

    for (const [materialId, orderCount] of ordersPerMaterial) {
      const pi = itemById.get(materialId)
      if (!pi) continue
      const groupLabel = normalizedMaterialGroupLabel(pi.material_group)
      const itemName = (pi.item_name && String(pi.item_name).trim()) || 'İsimsiz kalem'
      const purposeRaw = pi.purpose != null ? String(pi.purpose).trim() : ''
      const line: SiteOrderedMaterialLine = {
        id: pi.id,
        itemName,
        purpose: purposeRaw || null,
        unit: pi.unit != null ? String(pi.unit).trim() || null : null,
        quantityLabel: talepAdetLabel(pi),
        orderCount,
      }
      const arr = byGroup[groupLabel]
      if (arr) arr.push(line)
      else byGroup[groupLabel] = [line]
    }

    for (const key of Object.keys(byGroup)) {
      byGroup[key]!.sort((a, b) => a.itemName.localeCompare(b.itemName, 'tr'))
    }

    return byGroup
  }, [orders, purchaseRequestMaterials])

  const ordersSorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  )

  const pdfTotalsForReport = useMemo(
    () => ({
      total_requests: totals.total_requests,
      orders_count: totals.orders_count,
      ordersAmount: totals.ordersAmount,
      invoicedByCurrency: totals.invoicedByCurrency,
      invoiceAttributedRows: totals.invoiceAttributedRows,
      inPipeline: totals.inPipeline,
      legacyApproved: totals.legacyApproved,
      logisticsReqTrend: totals.logisticsReqTrend,
    }),
    [totals],
  )

  const pdfFinanceChartCurrencies = useMemo(
    () => financeDailySeries.invoiceSeries.map((s) => s.code).join(', ') || '—',
    [financeDailySeries.invoiceSeries],
  )

  const pdfSupplierRowsForReport = useMemo(
    (): SiteDetailPdfSupplierRow[] =>
      supplierBreakdown.map((row) => ({
        name: row.name,
        orderCount: row.orderCount,
        invoicedLine: formatCurrencyTotalsLine(row.invoicedByCurrency, formatCurrency),
      })),
    [supplierBreakdown],
  )

  const pdfOrderRowsForReport = useMemo(
    (): SiteDetailPdfOrderRow[] =>
      ordersSorted.map((o) => {
        const { title, requestNo } = linkedRequestLabel(o)
        const requestLabel =
          requestNo.trim() !== '' ? `${title} (${requestNo})` : title
        return {
          supplier: pickSupplierName(o),
          request: requestLabel,
          orderAmount: formatCurrency(parseOrderAmount(o), o.currency || 'TRY'),
          invoicedLine: formatCurrencyTotalsLine(
            invoicedByOrderPerCurrency.get(o.id) ?? new Map(),
            formatCurrency,
          ),
          date: new Date(o.created_at).toLocaleDateString('tr-TR'),
        }
      }),
    [ordersSorted, invoicedByOrderPerCurrency],
  )

  const topSupplier =
    supplierBreakdown.length > 0 && totals.orders_count > 0 ? supplierBreakdown[0] : null

  const sparkHeights = sparkHeightsFromCounts(
    totals.sparkCounts.length ? totals.sparkCounts : [0, 0, 0, 0, 0, 0, 1]
  )
  const pipelineSpark = sparkHeightsFromCounts(
    totals.total_requests > 0
      ? [
          Math.max(0, totals.inPipeline - 8),
          Math.max(1, totals.inPipeline - 4),
          Math.max(1, totals.inPipeline),
        ]
      : [0, 0, 1]
  )

  const recentRequesters = useMemo(() => {
    const names: string[] = []
    for (const r of purchaseRequests.slice(0, 15)) {
      const p = r.profiles as ProfileRef | ProfileRef[] | null | undefined
      const flat = Array.isArray(p) ? p[0] : p
      if (flat?.full_name) names.push(flat.full_name)
    }
    return [...new Set(names)].slice(0, 5)
  }, [purchaseRequests])

  const lastRequestDate =
    purchaseRequests.length > 0 ? purchaseRequests[0]?.created_at : undefined

  if (loading && !siteMeta) {
    return (
      <div className="space-y-6 px-4 pb-8 pt-4 sm:px-6">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
          </div>
        <Skeleton className="h-[260px] w-full rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  if (!loading && !siteMeta) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <Building2 className="mb-4 h-16 w-16 text-elegant-gray-400" />
        <h2 className="mb-2 text-2xl font-semibold text-elegant-black dark:text-white">Şantiye bulunamadı</h2>
        <p className="mb-6 text-center text-sm text-elegant-gray-600">Bu bağlantıdaki şantiye kaydı yok veya erişilemiyor.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/sites')}>
          Şantiyelere dön
        </Button>
      </div>
    )
  }

  if (!siteMeta) return null

  return (
    <SiteFinanceFxProvider>
      <div className="space-y-8 px-4 pb-8 pt-4 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Button 
            variant="outline" 
            size="icon"
            className="shrink-0 border-elegant-gray-300"
            onClick={() => router.push('/dashboard/sites')}
            aria-label="Geri"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="inline-block border-b-2 border-[#00E676] pb-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {siteMeta.name}
            </h1>
            <p className="mt-3 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
              Şantiye özeti — talepler, kalemler ve sipariş performansı (dashboard ile aynı veri dili)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="border-elegant-gray-300 bg-white dark:bg-elegant-gray-900" asChild>
            <Link href={`/dashboard/requests?site=${siteMeta.id}`}>
              Bu şantiyenin talepleri
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <SiteDetailPdfReportButton
            slug={slug}
            siteName={siteMeta.name}
            invoiceTotalsDateRange={invoiceTotalsDateRange}
            chartRangeDays={chartRange}
            totals={pdfTotalsForReport}
            lineItemCount={lineItemCount}
            financeChartCurrencyCodes={pdfFinanceChartCurrencies}
            supplierRows={pdfSupplierRowsForReport}
            orderRows={pdfOrderRowsForReport}
            materialGroupRowsBase={materialGroupBreakdownBase}
          />
        </div>
      </div>

      {/* KPI — ilk satır */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Toplam talep
            </span>
            <DeltaPill value={totals.logisticsReqTrend} />
                </div>
          <span className="text-3xl font-bold tracking-tight text-elegant-black dark:text-white">{totals.total_requests}</span>
          <p className="mt-1 text-xs text-elegant-gray-500">Bu şantiye için oluşturulan talepler</p>
          <SparkBars heightsPct={sparkHeights} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.35)]" />
                </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Talep kalemi
            </span>
              </div>
          <span className="text-3xl font-bold tracking-tight text-elegant-black dark:text-white">{lineItemCount}</span>
          <p className="mt-1 text-xs text-elegant-gray-500">
            Ortalama{' '}
            {totals.total_requests > 0 ? (lineItemCount / totals.total_requests).toFixed(1) : '—'} kalem / talep
          </p>
          <SparkBars
            heightsPct={sparkHeightsFromCounts([
              Math.max(0, lineItemCount - 40),
              lineItemCount,
              lineItemCount,
            ])}
            accentClass="bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.35)]"
          />
              </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 md:col-span-2 xl:col-span-1">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              İş akışında
            </span>
            </div>
          <span className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400">{totals.inPipeline}</span>
          <p className="mt-1 text-xs text-elegant-gray-500">
            Tamamlanmamış / iptal olmayan süreçler · Klasik onaylı talep (status):{' '}
            <span className="font-semibold">{totals.legacyApproved}</span>
          </p>
          <SparkBars
            heightsPct={pipelineSpark.map((h) => Math.round(h * 0.85))}
            accentClass="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
          />
        </div>
      </div>

      {/* Tam genişlik: günlük fatura / sipariş tutarı */}
      <section className="w-full rounded-2xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Günlük tutar eğrisi
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-elegant-black dark:text-white sm:text-2xl">
              Günlük fatura (döviz) · sipariş — seçilen aralıkta
            </h2>
            <p className="max-w-2xl text-sm text-elegant-gray-500 dark:text-elegant-gray-400">
              Her renk ilgili günde oluşmuş fatura satırlarında o para birimi (
              <code className="rounded bg-elegant-gray-100 px-1 py-0.5 text-[11px] dark:bg-elegant-black">currency</code>
              ): önce{' '}
              <code className="rounded bg-elegant-gray-100 px-1 py-0.5 text-[11px] dark:bg-elegant-black">grand_total</code>, yoksa{' '}
              <code className="rounded bg-elegant-gray-100 px-1 py-0.5 text-[11px] dark:bg-elegant-black">amount</code>
              — siparişler sayfasıyla uyumludur. Mor alanlı çizgi: aynı gün oluşturulan sipariş tutarı (farklı dövizler tek çizgide ham toplanabilir).
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end xl:flex-col xl:items-end">
            <div className="flex shrink-0 rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 p-1 dark:border-elegant-gray-700 dark:bg-elegant-black/50">
              {(
                [
                  [7, '7 gün'],
                  [14, '14 gün'],
                  [30, '30 gün'],
                ] as const
              ).map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setChartRange(d)}
                  className={cn(
                    'rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors',
                    chartRange === d
                      ? 'bg-white text-elegant-black shadow-sm dark:bg-elegant-gray-800 dark:text-white'
                      : 'text-elegant-gray-500 hover:text-elegant-black dark:hover:text-white'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-elegant-gray-50 px-4 py-3 dark:bg-elegant-black/40 sm:max-w-xl xl:justify-end">
              {financeDailySeries.invoiceSeries.length === 0 ? (
                <span className="text-xs text-elegant-gray-500">Henüz fatura satırında para birimi yok</span>
              ) : (
                financeDailySeries.invoiceSeries.map((s) => (
                  <div key={s.code} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-8 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.2)]" style={{ backgroundColor: s.stroke }} />
                    <span className="font-mono font-medium text-elegant-gray-700 dark:text-elegant-gray-300">{s.code}</span>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-8 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.35)]" />
                <span className="font-medium text-elegant-gray-700 dark:text-elegant-gray-300">Sipariş (gün)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-elegant-gray-100 pt-8 dark:border-elegant-gray-800">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <div className="rounded-xl border border-elegant-gray-200 bg-elegant-gray-50/80 px-4 py-3 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                    Faturalanan — tarih
                  </p>
                  <p className="mt-0.5 text-xs text-elegant-gray-500 dark:text-elegant-gray-400">
                    Köksüz fatura kalemlerinin oluşturulma tarihi — siparişler sayfasındaki tarih seçici ile aynı.
                  </p>
                </div>
                <DateFilter
                  dateRange={invoiceTotalsDateRange}
                  onChange={setInvoiceTotalsDateRange}
                  onClear={() => setInvoiceTotalsDateRange({ from: undefined, to: undefined })}
                  popoverModal
                />
              </div>
            </div>
            <SiteFinanceFxToolbar />
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Faturalanan (sipariş → fatura)</p>
              <div className="mt-3">
                <ConvertedTotalsCards totals={totals.invoicedByCurrency} />
              </div>
              <p className="mt-2 text-xs text-elegant-gray-500">
                Toplama dahil fatura satırı:{' '}
                <span className="font-semibold tabular-nums">{totals.invoiceAttributedRows}</span>
                {totals.invoiceAttributedRows === 0 && totals.orders_count > 0 && (
                  <span className="mt-1 block text-amber-800/90 dark:text-amber-300/90">
                    Bu şantiyenin siparişlerinde henüz fatura kaydı yok.
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Siparişler</p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{totals.orders_count}</p>
              {totals.ordersAmount > 1e-9 ? (
                <p className="mt-2 font-mono text-lg font-semibold text-elegant-black dark:text-white">
                  {formatCurrency(totals.ordersAmount, 'TRY')}
                </p>
              ) : null}
            </div>
          </div>
          <div className="w-full overflow-hidden rounded-xl border border-elegant-gray-100 dark:border-elegant-gray-800">
            <div className="min-h-[240px] w-full sm:min-h-[280px] md:min-h-[300px]">
              <FinanceInvoiceOrderChart
                gradientFillOrd={gidFinanceFillOrd}
                invoiceSeries={financeDailySeries.invoiceSeries}
                labels={financeDailySeries.labels}
                orderDaily={financeDailySeries.orderDaily}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full rounded-2xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 sm:p-8">
        <SiteMaterialGroupsBreakdown
          rows={materialGroupBreakdownBase}
          orderedLinesByGroup={orderedMaterialLinesByGroup}
          unlinkedLabel={MATERIAL_GROUP_ORDER_UNLINKED_LABEL}
        />
      </section>

      {/* Bu şantiyenin siparişleri + tedarikçi kırılımı */}
      <section className="w-full space-y-6">
        <div className="rounded-2xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-elegant-gray-500" aria-hidden />
                <h2 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white sm:text-xl">
                  Siparişler ve tedarikçiler
                </h2>
                </div>
              <p className="mt-2 max-w-3xl text-sm text-elegant-gray-500 dark:text-elegant-gray-400">
                Bu şantiyenin taleplerinden oluşturulan siparişler; faturalanan tutar siparişe bağlı fatura kalemlerinin toplamıdır
                (<span className="font-medium text-elegant-gray-700 dark:text-elegant-gray-300">grand_total</span>
                önceliği ile).
              </p>
                  </div>
            <Button variant="outline" size="sm" className="shrink-0 border-elegant-gray-300 bg-white dark:bg-elegant-gray-900" asChild>
              <Link href="/dashboard/orders">
                Siparişler sayfası
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
                </div>

          {supplierBreakdown.length === 0 && ordersSorted.length === 0 ? (
            <p className="mt-6 text-center text-sm text-elegant-gray-500">Henüz bu şantiye için sipariş kaydı yok.</p>
          ) : (
            <>
              {topSupplier && ordersSorted.length > 0 ? (
                <div className="mt-8 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 dark:border-primary/30 dark:bg-primary/10">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary dark:text-emerald-300">
                    En çok sipariş yapılan tedarikçi
                  </p>
                  <p className="mt-2 text-base font-semibold text-elegant-black dark:text-white">
                    <span>{topSupplier.name}</span>{' '}
                    <span className="font-normal text-elegant-gray-600 dark:text-elegant-gray-400">
                      ({topSupplier.orderCount} sipariş)
                    </span>
                  </p>
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-sm tabular-nums text-elegant-gray-800 dark:text-elegant-gray-200">
                    <span className="flex items-start gap-1.5 leading-snug">
                      <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      <span className="inline-flex flex-col gap-0.5 leading-snug">
                        <span className="font-sans font-normal normal-case tracking-normal text-elegant-gray-700 dark:text-elegant-gray-300">
                          Faturalanan
                        </span>
                        <ConvertedTotalsStack
                          totals={topSupplier.invoicedByCurrency}
                          valueClassName="font-semibold text-amber-800 dark:text-amber-300"
                        />
                      </span>
                    </span>
                  </p>
              </div>
              ) : null}

              <div className="mt-8 overflow-hidden rounded-xl border border-elegant-gray-100 dark:border-elegant-gray-800">
                <div className="border-b border-elegant-gray-100 bg-elegant-gray-50/80 px-4 py-4 dark:border-elegant-gray-800 dark:bg-elegant-gray-900/50 sm:px-6">
                  <h3 className="text-base font-semibold text-elegant-black dark:text-white">Tedarikçi özeti</h3>
                  <p className="text-xs text-elegant-gray-500">Şantiye siparişlerinde tedarikçi bazında toplamlar · sipariş adedine göre sıralı</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left">
                    <thead>
                      <tr className="border-b border-elegant-gray-100 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500 dark:border-elegant-gray-800">
                        <th className="px-4 py-3 sm:px-6">#</th>
                        <th className="px-4 py-3 sm:px-6">Tedarikçi</th>
                        <th className="px-4 py-3 text-right tabular-nums sm:px-6">Sipariş sayısı</th>
                        <th className="px-4 py-3 text-right tabular-nums sm:px-6">Faturalanan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                      {supplierBreakdown.map((row, idx) => (
                        <tr key={row.supplierId} className="hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-900/40">
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-elegant-gray-500 sm:px-6">{idx + 1}</td>
                          <td className="max-w-[280px] px-4 py-3 font-medium text-elegant-black dark:text-white sm:px-6">
                            {row.name}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-elegant-black dark:text-white sm:px-6">
                            {row.orderCount}
                          </td>
                          <td className="max-w-[320px] px-4 py-3 text-right align-top sm:px-6">
                            <div className="inline-flex flex-col items-end gap-0.5 font-mono text-sm tabular-nums text-amber-800 dark:text-amber-300">
                              <ConvertedTotalsStack totals={row.invoicedByCurrency} align="end" />
              </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {supplierBreakdown.length === 0 && ordersSorted.length > 0 ? (
                    <p className="px-6 py-6 text-center text-sm text-elegant-gray-500">
                      Tedarikçi kaydı çıkarılamadı — siparişlerde firma bağlantısı eksik olabilir.
                    </p>
                  ) : null}
            </div>
      </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-elegant-gray-100 dark:border-elegant-gray-800">
                <div className="border-b border-elegant-gray-100 bg-elegant-gray-50/80 px-4 py-4 dark:border-elegant-gray-800 dark:bg-elegant-gray-900/50 sm:px-6">
                  <h3 className="text-base font-semibold text-elegant-black dark:text-white">
                    Sipariş listesi <span className="font-normal text-elegant-gray-500">({ordersSorted.length})</span>
                  </h3>
                  <p className="text-xs text-elegant-gray-500">Her satırda tedarikçi ile birlikte girilen sipariş ve fatura toplamları listelenir.</p>
                </div>
                <div className="max-h-[min(560px,70vh)] overflow-y-auto overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm dark:bg-elegant-gray-900">
                      <tr className="border-b border-elegant-gray-100 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500 dark:border-elegant-gray-800">
                        <th className="px-4 py-3 sm:px-6">Tedarikçi</th>
                        <th className="px-4 py-3 sm:px-6">Talep</th>
                        <th className="px-4 py-3 text-right tabular-nums sm:px-6">Sipariş tutarı</th>
                        <th className="px-4 py-3 text-right tabular-nums sm:px-6">Faturalanan</th>
                        <th className="px-4 py-3 sm:px-6">Tarih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                      {ordersSorted.map((o) => {
                        const sup = pickSupplierName(o)
                        const { title, requestNo } = linkedRequestLabel(o)
                        const ordAmt = parseOrderAmount(o)
                        return (
                          <tr key={o.id} className="align-top hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-900/40">
                            <td className="px-4 py-3 sm:px-6">
                              <span className="font-medium leading-snug text-elegant-black dark:text-white">{sup}</span>
                            </td>
                            <td className="max-w-[240px] px-4 py-3 text-sm text-elegant-gray-700 dark:text-elegant-gray-300 sm:px-6">
                              <span className="block font-medium">{title}</span>
                              {requestNo ? (
                                <span className="mt-0.5 block font-mono text-[11px] text-elegant-gray-500">{requestNo}</span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums text-indigo-800 dark:text-indigo-300 sm:px-6">
                              {formatCurrency(ordAmt, o.currency || 'TRY')}
                            </td>
                            <td className="max-w-[220px] px-4 py-3 text-right align-top sm:px-6">
                              <div className="inline-flex flex-col items-end gap-0.5 font-mono text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                                <ConvertedTotalsStack
                                  totals={invoicedByOrderPerCurrency.get(o.id) ?? new Map()}
                                  align="end"
                                />
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-elegant-gray-500 sm:px-6">
                              {new Date(o.created_at).toLocaleDateString('tr-TR')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 lg:col-span-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                Günlük talep oluşturma
              </h3>
              <p className="mt-1 text-sm text-elegant-gray-500 dark:text-elegant-gray-400">
                Sadece bu şantiye — günlük yeni talep adedi
              </p>
            </div>
            <div className="flex shrink-0 rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 p-1 dark:border-elegant-gray-700 dark:bg-elegant-black/50">
              {(
                [
                  [7, '7 gün'],
                  [14, '14 gün'],
                  [30, '30 gün'],
                ] as const
              ).map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setChartRange(d)}
                  className={cn(
                    'rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors',
                    chartRange === d
                      ? 'bg-white text-elegant-black shadow-sm dark:bg-elegant-gray-800 dark:text-white'
                      : 'text-elegant-gray-500 hover:text-elegant-black dark:hover:text-white'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={chartAreaRef}
            className="relative flex h-[260px] w-full items-stretch gap-1.5 pt-6 sm:gap-2 md:h-[300px]"
            role="group"
            aria-label="Şantiye günlük talep grafiği"
          >
            {chartSliceComputed.counts.map((c, i) => {
              const hPct = c === 0 ? 0 : Math.round((c / barMax) * 100)
              const visualPct = c === 0 ? 6 : Math.max(16, hPct)
              const isHi = i === highlightedIdx && c > 0
              const tipOpen = chartTooltipIdx === i
              const dayKey = chartSliceComputed.keys[i]
              return (
                <button
                  key={dayKey ?? `bar-${i}`}
                  type="button"
                  className={cn(
                    'group relative flex h-full min-h-0 min-w-0 flex-1 cursor-pointer flex-col justify-end border-0 bg-transparent px-[1px] pt-1 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-elegant-gray-900'
                  )}
                  onClick={() => setChartTooltipIdx((prev) => (prev === i ? null : i))}
                  aria-pressed={tipOpen}
                  aria-label={`${chartSliceComputed.labels[i]}: ${c} talep`}
                >
                  <div className="relative w-full" style={{ height: `${visualPct}%`, minHeight: c > 0 ? 12 : 8 }}>
                    {tipOpen && (
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[min(220px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-elegant-gray-700 bg-elegant-black px-3 py-2 text-left shadow-xl dark:border-elegant-gray-300 dark:bg-white"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/70 dark:text-elegant-gray-600">
                          {chartSliceComputed.labels[i]}
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-white dark:text-elegant-black">
                          {c === 1 ? '1 talep' : `${c} talep`}
                        </p>
                        {dayKey && (
                          <p className="mt-1 font-mono text-[10px] text-white/50 dark:text-elegant-gray-500">{dayKey}</p>
                        )}
                        <span
                          className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border border-elegant-gray-700 bg-elegant-black dark:border-elegant-gray-300 dark:bg-white"
                          aria-hidden
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        'h-full w-full rounded-t-md transition-all duration-300',
                        tipOpen &&
                          'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-elegant-gray-900',
                        isHi
                          ? 'bg-primary shadow-[0_0_18px_rgba(0,230,118,0.28)] ring-1 ring-primary/25'
                          : 'bg-elegant-gray-400 hover:bg-elegant-gray-500 dark:bg-elegant-gray-500 dark:hover:bg-elegant-gray-400'
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-elegant-gray-500 dark:text-elegant-gray-400">
            Çubuğa tıklayarak günün özetini açın
          </p>
        </div>

        <div className="flex flex-col lg:col-span-4">
          <div className="flex flex-1 flex-col rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">
              Şantiye operasyon özeti
            </h4>
            <div className="space-y-10">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">
                    Seçili aralıkta talep tutarı
                  </span>
                  <DeltaPill value={logisticsAmountTrendSlice} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">
                  {formatCurrency(trySliceSum, 'TRY')}
                </div>
                <p className="mt-1 text-xs text-elegant-gray-500">Üst grafik zaman aralığı ile aynı</p>
                {logisticsSpark(chartSliceComputed.amounts, gidAmount)}
              </div>
              <div className="border-t border-elegant-gray-100 pt-8 dark:border-elegant-gray-800">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">
                    Seçili aralıkta talep adedi
                  </span>
                  <DeltaPill value={logisticsRequestsTrendSlice} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">{requestSliceSum} talep</div>
                <p className="mt-1 text-xs text-elegant-gray-500">Aynı gün içinde birden fazla talep olabilir</p>
                {logisticsSpark(chartSliceComputed.counts.map(Number), gidRequests)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Card className="border-elegant-gray-200 shadow-sm dark:border-elegant-gray-800">
            <CardHeader className="border-b border-elegant-gray-100 dark:border-elegant-gray-800">
              <CardTitle className="text-base font-semibold">Şantiye bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm text-elegant-gray-700 dark:text-elegant-gray-300">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-elegant-gray-400" />
                <span>Oluşturulma: {new Date(siteMeta.created_at).toLocaleDateString('tr-TR')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-elegant-gray-400" />
                <span>Güncelleme: {new Date(siteMeta.updated_at).toLocaleDateString('tr-TR')}</span>
              </div>
              {lastRequestDate && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-elegant-gray-400" />
                  <span>Son talep: {new Date(lastRequestDate).toLocaleDateString('tr-TR')}</span>
                </div>
              )}

              {(siteMeta.approved_expenses ?? 0) > 0 && (
                <div className="rounded-lg border border-elegant-gray-100 bg-elegant-gray-50 p-4 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-elegant-gray-500">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Bütçe
                  </div>
                  <p className="mt-2 font-mono text-lg font-semibold">
                    {formatCurrency(Number(siteMeta.approved_expenses ?? 0), 'TRY')} onaylı harcama
                  </p>
                  {siteMeta.total_budget != null && siteMeta.total_budget > 0 && (
                    <>
                      <p className="mt-1 text-xs text-elegant-gray-500">
                        Bütçe: {formatCurrency(Number(siteMeta.total_budget), 'TRY')} (
                        {(
                          (Number(siteMeta.approved_expenses ?? 0) / Number(siteMeta.total_budget)) *
                          100
                        ).toFixed(1)}
                        %)
                      </p>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-elegant-gray-200 dark:bg-elegant-gray-700">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(
                              (Number(siteMeta.approved_expenses ?? 0) / Number(siteMeta.total_budget)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {recentRequesters.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-elegant-gray-500">
                    <User className="h-3 w-3" />
                    Aktif talep edenler
                  </p>
                  <ul className="space-y-1">
                    {recentRequesters.map((n) => (
                      <li key={n} className="text-elegant-gray-800 dark:text-elegant-gray-200">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              </CardContent>
            </Card>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <div className="flex items-center justify-between border-b border-elegant-gray-100 px-6 py-5 dark:border-elegant-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-elegant-black dark:text-white">Son talepler</h3>
                <p className="text-sm text-elegant-gray-500">Şantiye kapsamında en güncel kayıtlar</p>
                      </div>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/90" asChild>
                <Link href={`/dashboard/requests?site=${siteMeta.id}`}>Tümünü gör</Link>
              </Button>
                        </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-elegant-gray-100 bg-elegant-gray-50/80 dark:border-elegant-gray-800 dark:bg-elegant-gray-800/40">
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500">
                      Talep
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500">
                      İş akışı
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500">
                      Durum (kayıt)
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500">
                      Tutar
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500">
                      Tarih
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                  {purchaseRequests.slice(0, 20).map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-800/40"
                      onClick={() => router.push(`/dashboard/requests/${row.id}`)}
                    >
                      <td className="max-w-[220px] truncate px-6 py-4 text-sm font-medium text-elegant-black dark:text-white">
                        {row.title}{' '}
                        <span className="block font-mono text-[11px] font-normal text-elegant-gray-500">
                          {row.request_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-elegant-gray-700 dark:text-elegant-gray-300">
                        {workflowLabel(row.workflow_status)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={cn('border font-semibold uppercase tracking-tight', statusBadgeClass(row.status))}>
                          {row.status || '—'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm font-semibold tabular-nums text-elegant-black dark:text-white">
                        {formatCurrency(
                          typeof row.total_amount === 'string'
                            ? parseFloat(row.total_amount)
                            : Number(row.total_amount ?? 0),
                          row.currency || 'TRY'
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-elegant-gray-500">
                        {new Date(row.created_at).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {purchaseRequests.length === 0 && (
                <div className="px-6 py-12 text-center text-sm text-elegant-gray-500">
                  Bu şantiye için henüz talep yok.
                          </div>
              )}
                          </div>
                        </div>

          <Card className="border-elegant-gray-200 shadow-sm dark:border-elegant-gray-800">
            <Tabs defaultValue="offers">
              <div className="border-b border-elegant-gray-100 dark:border-elegant-gray-800">
                <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0">
                  <TabsTrigger value="offers" className="rounded-none border-b-2 border-transparent px-6 py-4 data-[state=active]:border-primary">
                    <DollarSign className="mr-2 h-4 w-4" />
                    Onaylı teklifler
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent px-6 py-4 data-[state=active]:border-primary">
                    <Package className="mr-2 h-4 w-4" />
                    Siparişler ({orders.length})
                  </TabsTrigger>
                </TabsList>
                      </div>
              <TabsContent value="offers" className="mt-0 p-6 focus-visible:outline-none">
                {approvedOffers.length > 0 ? (
                  <ul className="space-y-3">
                    {approvedOffers.slice(0, 25).map((offer) => {
                      const pr = purchaseRequests.find((p) => p.id === offer.purchase_request_id)
                      const title = pr?.title || 'Bağlantılı talep'
                      const dateStr =
                        offer.offer_date || (offer.created_at ? String(offer.created_at).slice(0, 10) : '')
                      return (
                        <li
                          key={offer.id}
                          className="flex flex-col gap-2 rounded-xl border border-elegant-gray-100 p-4 transition-colors hover:border-elegant-gray-300 dark:border-elegant-gray-800 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-elegant-black dark:text-white">{title}</p>
                            <p className="text-sm text-elegant-gray-600">{offer.supplier_name}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-elegant-gray-500">
                              {offer.delivery_days != null && (
                        <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {offer.delivery_days} gün
                        </span>
                              )}
                              {dateStr && (
                        <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(dateStr).toLocaleDateString('tr-TR')}
                        </span>
                              )}
                      </div>
                    </div>
                          <div className="text-right">
                            <p className="font-mono text-lg font-bold">
                              {formatCurrency(Number(offer.total_price), offer.currency || 'TRY')}
                            </p>
                    </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="py-10 text-center text-sm text-elegant-gray-500">
                    Seçili teklif kaydı yok.
                    </div>
                  )}
                </TabsContent>
              <TabsContent value="orders" className="mt-0 p-6 focus-visible:outline-none">
                {orders.length > 0 ? (
                  <ul className="space-y-3">
                    {orders.slice(0, 30).map((order) => {
                      const pr = purchaseRequests.find((p) => p.id === order.purchase_request_id)
                        return (
                        <li
                          key={order.id}
                          className="flex flex-col gap-2 rounded-xl border border-elegant-gray-100 p-4 dark:border-elegant-gray-800 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">{pr?.title || 'Talep'}</p>
                            <p className="font-mono text-xs text-elegant-gray-500">{pr?.request_number}</p>
                            <p className="mt-1 text-xs text-elegant-gray-500">
                              Teslimat: {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                                </p>
                              </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-semibold">
                              {order.status}
                                </Badge>
                            <span className="font-mono font-bold">
                              {formatCurrency(
                                typeof order.amount === 'string' ? parseFloat(order.amount) : Number(order.amount ?? 0),
                                order.currency || 'TRY'
                              )}
                              </span>
                            </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="py-10 text-center text-sm text-elegant-gray-500">Sipariş yok.</div>
                  )}
                </TabsContent>
              </Tabs>
          </Card>
        </div>
      </div>
    </div>
    </SiteFinanceFxProvider>
  )
}
