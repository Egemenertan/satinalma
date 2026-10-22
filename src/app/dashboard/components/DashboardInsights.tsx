'use client'

import { useMemo, useState, useRef, useEffect, useId } from 'react'
import Link from 'next/link'
import {
  TrendingDown,
  TrendingUp,
  ArrowRight,
  ArrowUpRight,
  Package,
  Gauge,
  Building2,
  Activity,
  Plus,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import type { DashboardBundle, DashboardRecentRequest } from '@/services/dashboard.service'
import { RequestProcessModal } from '@/components/requests/RequestProcessModal'

type ChartRange = 7 | 14 | 30
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

/* ------------------------------------------------------------------ */
/*  Yardımcı fonksiyonlar                                             */
/* ------------------------------------------------------------------ */

function trendPercent(series: number[]): number | null {
  if (series.length < 8) return null
  const prev = series.slice(-8, -4).reduce((a, b) => a + b, 0)
  const cur = series.slice(-4).reduce((a, b) => a + b, 0)
  if (prev <= 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

/** "97,2" biçiminde Türkçe ondalık gösterim */
function formatPercentTr(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',')
}

/** Yarım daire gösterge (gauge) üzerinde 0-100 arası bir yüzdeye karşılık gelen nokta */
function gaugePoint(pct: number) {
  const clamped = Math.max(0, Math.min(100, pct))
  const angleDeg = 180 - (clamped / 100) * 180
  const angleRad = (angleDeg * Math.PI) / 180
  return {
    x: 100 + 80 * Math.cos(angleRad),
    y: 100 - 80 * Math.sin(angleRad),
  }
}

function isPendingStatus(status: string): boolean {
  const s = (status || '').toLowerCase()
  return (
    s === 'pending' ||
    s === 'beklemede' ||
    s === 'draft' ||
    s === 'awaiting_offers' ||
    s.includes('bekliyor') ||
    s.includes('incelemesinde') ||
    s.includes('kontrolü yapılıyor')
  )
}

function isRejectedStatus(status: string): boolean {
  const s = (status || '').toLowerCase()
  return s.includes('red') || s.includes('iptal') || s === 'rejected' || s === 'cancelled'
}

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'beklemede') return 'border-[#EAB308] bg-[#FACC15] text-[#422006]'
  if (isRejectedStatus(s)) return 'border-red-200 bg-red-500/10 text-red-700'
  if (s.includes('onay') || s.includes('approved') || s.includes('gönderildi')) {
    return 'border-brand-green/30 bg-brand-green/10 text-brand-dark'
  }
  if (isPendingStatus(s)) return 'border-amber-200 bg-amber-500/10 text-amber-800'
  return 'border-brand-border bg-brand-grayBg text-brand-subtext'
}

function statusLabel(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'pending') return 'Beklemede'
  if (s === 'approved' || s === 'onaylandı') return 'Onaylandı'
  if (s === 'rejected' || s === 'reddedildi') return 'Reddedildi'
  if (s === 'cancelled' || s === 'iptal') return 'İptal'
  if (s === 'depoda mevcut değil') return 'Depoda mevcut değil'
  if (s === 'beklemede') return 'Ana depo kontrolü yapılıyor'
  if (s === 'gönderildi') return 'Ana depoda mevcut'
  if (s === 'ana depoda yok') return 'Ana depoda yok'
  if (s === 'satın almaya gönderildi') return 'Satın almaya gönderildi'
  if (s === 'departman_onayı_bekliyor') return 'Departman onayı'
  if (s === 'it_incelemesinde') return 'IT incelemesinde'
  if (s === 'it_onaylandi') return 'IT onaylandı'
  return status || '—'
}

function urgencyLabel(level: string | null | undefined): string | null {
  const s = (level || '').toLowerCase()
  if (s === 'critical') return 'Kritik'
  if (s === 'high') return 'Yüksek'
  if (s === 'medium') return 'Orta'
  if (s === 'low') return 'Düşük'
  return null
}

function urgencyBadgeClass(level: string | null | undefined): string {
  const s = (level || '').toLowerCase()
  if (s === 'critical') return 'border-red-200 bg-red-500/10 text-red-700'
  if (s === 'high') return 'border-amber-200 bg-amber-500/10 text-amber-800'
  return 'border-brand-border bg-brand-grayBg text-brand-subtext'
}

/** "3 Oca, 14:20" biçiminde kısa, okunaklı Türkçe tarih+saat */
function formatRelativeDateTime(iso: string): string {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  const timePart = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart}, ${timePart}`
}

/* ------------------------------------------------------------------ */
/*  Küçük, tekrar kullanılabilir alt bileşenler                       */
/* ------------------------------------------------------------------ */

function DeltaPill({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <div
      className={cn(
        'flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
        up ? 'bg-brand-green/15 text-brand-dark' : 'bg-red-500/10 text-red-600'
      )}
    >
      {up ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
      {up ? '+' : ''}
      {value}%
    </div>
  )
}

/** design.md'deki "barcode" segmentli ilerleme çubuğu — gerçek oranlarla beslenir */
function SegmentedBar({
  filledPct,
  filledClassName = 'bg-brand-neon',
}: {
  filledPct: number
  filledClassName?: string
}) {
  const filled = Math.max(0, Math.min(100, filledPct))
  const remaining = 100 - filled
  return (
    <div className="flex h-5 w-full items-center gap-0.5 overflow-hidden rounded-md bg-brand-grayBg p-0.5">
      {filled > 0 && (
        <div className={cn('h-full rounded-sm transition-all duration-300', filledClassName)} style={{ width: `${filled}%` }} />
      )}
      {remaining > 0 && (
        <div
          className="flex h-full flex-1 items-center gap-[2px] border-l border-brand-green/50 pl-1.5"
          style={{ width: `${remaining}%` }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-3 w-[1.5px] shrink-0 bg-brand-border" />
          ))}
        </div>
      )}
    </div>
  )
}

/** design.md'deki yarım daire gösterge — gerçek bir yüzdeye göre dinamik çizilir */
function GaugeMeter({ percent }: { percent: number }) {
  const end = gaugePoint(percent)
  return (
    <div className="relative flex w-full flex-col items-center justify-end">
      <svg className="h-28 w-56" viewBox="0 0 200 100">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#eaedf1" strokeLinecap="round" strokeWidth="8" />
        <path
          d={`M 20 100 A 80 80 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="#111315"
          strokeLinecap="round"
          strokeWidth="8"
        />
        <circle cx={end.x} cy={end.y} r={6} fill="#20e277" />
      </svg>
      <div className="absolute bottom-1 flex items-baseline">
        <span className="text-3xl font-bold tracking-tight text-brand-dark">{formatPercentTr(percent)}</span>
        <span className="ml-0.5 text-xs font-semibold text-brand-subtext">%</span>
      </div>
    </div>
  )
}

/** design.md'deki ince dalga/çubuk grafik — günlük gerçek veriyle, tıklanabilir tooltip'li */
function WaveformBarChart({
  values,
  labels,
  dayKeys,
  valueSuffix,
  formatValue,
}: {
  values: number[]
  labels: string[]
  dayKeys: string[]
  valueSuffix: string
  formatValue: (v: number) => string
}) {
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const max = Math.max(...values, 1)
  const peakIdx = values.length ? values.lastIndexOf(Math.max(...values)) : -1

  useEffect(() => {
    if (tooltipIdx === null) return
    const onPointerDown = (e: PointerEvent) => {
      if (areaRef.current && !areaRef.current.contains(e.target as Node)) setTooltipIdx(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [tooltipIdx])

  return (
    <div>
      <div
        ref={areaRef}
        className="relative flex h-28 w-full items-end gap-[2px]"
        role="group"
        aria-label="Günlük grafik"
      >
        {values.map((v, i) => {
          const hPct = v === 0 ? 4 : Math.max(10, Math.round((v / max) * 100))
          const isPeak = i === peakIdx && v > 0
          const open = tooltipIdx === i
          return (
            <button
              key={dayKeys[i] ?? i}
              type="button"
              className="group relative flex h-full flex-1 min-w-0 cursor-pointer flex-col justify-end border-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1"
              style={{ height: '100%' }}
              onClick={() => setTooltipIdx(prev => (prev === i ? null : i))}
              aria-label={`${labels[i]}: ${formatValue(v)}${valueSuffix}`}
            >
              {isPeak && (
                <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-10 w-[1.5px] -translate-x-1/2 bg-brand-green">
                  <div className="h-2 w-2 -translate-x-[3.5px] rounded-full bg-brand-green" />
                </div>
              )}
              {open && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max -translate-x-1/2 rounded-xl border border-brand-dark bg-brand-dark px-3 py-2 text-left shadow-xl"
                >
                  <p className="text-[10px] font-medium text-white/70">{labels[i]}</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-white">
                    {formatValue(v)}
                    {valueSuffix}
                  </p>
                  <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border border-brand-dark bg-brand-dark" />
                </div>
              )}
              <div
                className="mx-auto w-full max-w-[6px] rounded-t-[2px] transition-all duration-300"
                style={{
                  height: `${hPct}%`,
                  minHeight: 3,
                  backgroundColor: isPeak ? '#111315' : '#20e277',
                  opacity: isPeak ? 1 : 0.55,
                }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-brand-subtext">
        <span>{labels[0] ?? '—'}</span>
        <span>{labels[labels.length - 1] ?? '—'}</span>
      </div>
    </div>
  )
}

/** design.md'deki yumuşak alan/çizgi grafik (tutar trendleri için) */
function LogisticsSparkline({ values, gradientId }: { values: number[]; gradientId: string }) {
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
          <stop offset="0%" stopColor="#20e277" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#20e277" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${safeGid})`} />
      <path
        d={line}
        fill="none"
        stroke="#20e277"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 10px rgba(32, 226, 119, 0.38))' }}
      />
      <circle cx={lastCx} cy={lastCy} r={3.5} fill="#20e277" style={{ filter: 'drop-shadow(0 0 6px rgba(32,226,119,0.6))' }} />
    </svg>
  )
}

/** design.md'deki "müşteri hızlı kartı" — artık gerçek son talepleri gösterir */
function QuickRequestCard({ request, onOpen }: { request: DashboardRecentRequest; onOpen: () => void }) {
  const initial = (request.site_name || request.title || '?').trim().charAt(0).toUpperCase()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center justify-between rounded-3xl bg-white p-5 text-left shadow-card transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3.5 overflow-hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-grayBg text-xs font-semibold text-brand-subtext">
          {initial}
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold leading-tight text-brand-dark">{request.title}</h4>
          <p className="truncate text-xs text-brand-subtext">{request.site_name || 'Şantiye belirtilmemiş'}</p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-subtext transition-colors group-hover:text-brand-dark" />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Ana bileşen                                                        */
/* ------------------------------------------------------------------ */

interface DashboardInsightsProps {
  bundle: DashboardBundle | undefined
  loading: boolean
  error: Error | undefined
}

export function DashboardInsights({ bundle, loading, error }: DashboardInsightsProps) {
  const [chartRange, setChartRange] = useState<ChartRange>(14)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState<StatusFilter>('all')
  const [activitySearch, setActivitySearch] = useState('')
  const gidAmount = useId()

  const stats = bundle?.stats
  const dailyPoints = bundle?.dailyPoints ?? []
  const recentRequests = bundle?.recentRequests ?? []

  const chartSlice = useMemo(() => {
    const n = dailyPoints.length
    const take = Math.min(chartRange, n)
    const slice = dailyPoints.slice(-take)
    return {
      counts: slice.map(d => d.requests),
      amounts: slice.map(d => d.amount),
      labels: slice.map(d => d.label),
      keys: slice.map(d => d.dayKey),
    }
  }, [dailyPoints, chartRange])

  const requestsTrend = trendPercent(chartSlice.counts)
  const amountsTrend = trendPercent(chartSlice.amounts)
  const amountSliceSum = chartSlice.amounts.reduce((a, b) => a + b, 0)
  const topAmountDay = chartSlice.amounts.length ? Math.max(...chartSlice.amounts) : 0
  const avgDailyRequests = chartSlice.counts.length
    ? chartSlice.counts.reduce((a, b) => a + b, 0) / chartSlice.counts.length
    : 0

  const processedCount = stats ? Math.max(stats.totalRequests - stats.pendingRequests, 0) : 0
  const processedPct = stats && stats.totalRequests > 0 ? (processedCount / stats.totalRequests) * 100 : 0

  const networkTotal = stats ? stats.totalSites + stats.totalSuppliers : 0
  const sitesRatioPct = networkTotal > 0 ? (stats!.totalSites / networkTotal) * 100 : 50

  const filteredActivity = useMemo(() => {
    return recentRequests.filter(row => {
      const matchesFilter =
        activityFilter === 'all' ||
        (activityFilter === 'pending' && isPendingStatus(row.status)) ||
        (activityFilter === 'rejected' && isRejectedStatus(row.status)) ||
        (activityFilter === 'approved' && !isPendingStatus(row.status) && !isRejectedStatus(row.status))
      if (!matchesFilter) return false
      if (!activitySearch.trim()) return true
      const q = activitySearch.trim().toLowerCase()
      return (row.title || '').toLowerCase().includes(q) || (row.site_name || '').toLowerCase().includes(q)
    })
  }, [recentRequests, activityFilter, activitySearch])

  if (loading && !bundle) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-3xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-800">
        <p className="font-medium">Özet yüklenemedi</p>
        <p className="mt-1 text-sm opacity-90">{error.message}</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6 selection:bg-brand-green selection:text-black">
      {/* ---------------------------------------------------------- */}
      {/* Hero                                                       */}
      {/* ---------------------------------------------------------- */}
      <section className="relative flex flex-col items-start justify-between gap-6 pb-2 pt-3 lg:flex-row lg:items-center">
        <div className="z-10 flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-brand-subtext">Tüm şantiyelere göre veri</span>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-brand-dark sm:text-5xl">Panel Özeti</h1>
            <div className="mt-2 flex items-center gap-1.5 rounded-full bg-brand-grayBg px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
              </span>
              <span className="text-xs font-semibold text-brand-dark">Canlı</span>
            </div>
          </div>
        </div>

        <div className="z-10 flex flex-wrap items-center gap-2.5 self-end lg:self-center">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-0 bg-white/80 px-4 py-2.5 text-sm font-medium text-brand-dark shadow-sm hover:bg-white"
            asChild
          >
            <Link href="/dashboard/requests/create">
              <Plus className="mr-1.5 h-4 w-4" />
              Talep Oluştur
            </Link>
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-brand-dark px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-black"
            asChild
          >
            <Link href="/dashboard/requests">
              Taleplere git
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Satır 1 — 3 metrik kartı                                   */}
      {/* ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Kart 1: Talep Hacmi */}
        <div className="flex h-56 flex-col justify-between rounded-3xl bg-white p-6 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
            <Package className="h-4 w-4" />
            <span>Talep Hacmi</span>
          </div>
          <div className="flex items-start">
            <span className="text-4xl font-extrabold tracking-tight text-brand-dark">
              {stats.totalRequests.toLocaleString('tr-TR')}
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs font-medium text-brand-subtext">
              <div>
                <span className="block text-sm font-semibold text-brand-dark">{processedCount.toLocaleString('tr-TR')}</span>
                İşlenen
              </div>
              <div className="text-right">
                <span className="block text-sm font-semibold text-brand-dark">{stats.pendingRequests.toLocaleString('tr-TR')}</span>
                Bekleyen
              </div>
            </div>
            <SegmentedBar filledPct={processedPct} />
          </div>
        </div>

        {/* Kart 2: İşlenme Oranı (gauge) */}
        <div className="relative flex h-56 flex-col justify-between overflow-hidden rounded-3xl bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
              <Gauge className="h-4 w-4" />
              <span>İşlenme Oranı</span>
            </div>
            <DeltaPill value={stats.requestGrowth} />
          </div>
          <div className="flex justify-between text-xs">
            <div>
              <span className="block text-base font-bold text-brand-dark">{processedCount.toLocaleString('tr-TR')}</span>
              <span className="text-brand-subtext">İşlenen</span>
            </div>
            <div className="text-right">
              <span className="block text-base font-bold text-brand-dark">{stats.pendingRequests.toLocaleString('tr-TR')}</span>
              <span className="text-brand-subtext">Bekleyen</span>
            </div>
          </div>
          <GaugeMeter percent={processedPct} />
        </div>

        {/* Kart 3: Ağ Büyüklüğü */}
        <div className="flex h-56 flex-col justify-between rounded-3xl bg-white p-6 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
            <Building2 className="h-4 w-4" />
            <span>Ağ Büyüklüğü</span>
          </div>
          <div className="flex items-start justify-end">
            <span className="text-4xl font-extrabold tracking-tight text-brand-dark">{networkTotal.toLocaleString('tr-TR')}</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs font-medium text-brand-subtext">
              <div>
                <span className="block text-sm font-semibold text-brand-dark">{stats.totalSites}</span>
                Şantiye
              </div>
              <div className="text-right">
                <span className="block text-sm font-semibold text-brand-dark">{stats.totalSuppliers}</span>
                Tedarikçi
              </div>
            </div>
            <div className="flex h-5 w-full items-center overflow-hidden rounded-md bg-brand-grayBg p-0.5">
              <div className="h-full rounded-sm bg-brand-dark transition-all duration-300" style={{ width: `${sitesRatioPct}%` }} />
              <div
                className="h-full rounded-sm bg-brand-neon transition-all duration-300"
                style={{ width: `${100 - sitesRatioPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Satır 2 — 2 büyük dalga grafiği                             */}
      {/* ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Kart 4: Talep Hacmi Trendi */}
        <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
              <Activity className="h-4 w-4" />
              <span>Talep Hacmi Trendi</span>
            </div>
            <div className="flex shrink-0 rounded-xl bg-brand-grayBg p-1">
              {([7, 14, 30] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setChartRange(d)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                    chartRange === d ? 'bg-brand-dark text-white shadow-sm' : 'text-brand-subtext hover:text-brand-dark'
                  )}
                >
                  {d} gün
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 pt-4">
            <div>
              <span className="block text-xl font-bold tracking-tight text-brand-dark">
                {formatPercentTr(avgDailyRequests, 1)}
              </span>
              <span className="text-xs text-brand-subtext">Günlük ortalama talep</span>
            </div>
            <DeltaPill value={requestsTrend} />
          </div>

          <div className="border-t border-brand-border pt-4">
            <WaveformBarChart
              values={chartSlice.counts}
              labels={chartSlice.labels}
              dayKeys={chartSlice.keys}
              valueSuffix=" talep"
              formatValue={v => v.toLocaleString('tr-TR')}
            />
          </div>
        </div>

        {/* Kart 5: Talep Tutarı Trendi */}
        <div className="flex flex-col justify-between rounded-3xl bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
              <TrendingUp className="h-4 w-4" />
              <span>Talep Tutarı Trendi</span>
            </div>
            <DeltaPill value={amountsTrend} />
          </div>

          <div className="flex items-center justify-between pb-2 pt-4">
            <div>
              <span className="block text-xl font-bold tracking-tight text-brand-dark">
                {formatCurrency(amountSliceSum, 'TRY')}
              </span>
              <span className="text-xs text-brand-subtext">Seçili aralıkta toplam</span>
            </div>
            <div className="text-right">
              <span className="block text-sm font-bold text-brand-dark">{formatCurrency(topAmountDay, 'TRY')}</span>
              <span className="text-xs text-brand-subtext">En yüksek gün</span>
            </div>
          </div>

          <div className="border-t border-brand-border pt-4">
            <LogisticsSparkline values={chartSlice.amounts} gradientId={gidAmount} />
            <div className="mt-2 flex justify-between text-[11px] font-medium text-brand-subtext">
              <span>{chartSlice.labels[0] ?? '—'}</span>
              <span>{chartSlice.labels[chartSlice.labels.length - 1] ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Satır 3 — Son taleplerden 3 hızlı kart                      */}
      {/* ---------------------------------------------------------- */}
      {recentRequests.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {recentRequests.slice(0, 3).map(row => (
            <QuickRequestCard key={row.id} request={row} onOpen={() => setSelectedRequestId(row.id)} />
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Son Hareketler paneli                                       */}
      {/* ---------------------------------------------------------- */}
      <div className="flex min-h-[420px] flex-col rounded-3xl bg-white p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-dark" />
            <span className="text-base font-bold text-brand-dark">Son Hareketler</span>
          </div>
          <Link href="/dashboard/requests" className="p-1 text-brand-subtext transition-colors hover:text-brand-dark">
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Durum filtreleri */}
        <div className="flex items-center gap-2 pt-4">
          {(
            [
              ['all', 'Tümü'],
              ['pending', 'Bekleyen'],
              ['approved', 'Onaylı'],
              ['rejected', 'Reddedildi'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActivityFilter(value)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                activityFilter === value ? 'bg-brand-dark text-white' : 'bg-brand-grayBg text-brand-subtext hover:bg-brand-border'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Hareket listesi */}
        <div className="flex-1 space-y-1 overflow-y-auto py-4">
          {filteredActivity.length === 0 && (
            <div className="py-10 text-center text-sm text-brand-subtext">Eşleşen hareket bulunamadı</div>
          )}
          {filteredActivity.map(row => {
            const urgency = urgencyLabel(row.urgency_level)
            const itemCount = row.item_count ?? 0
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedRequestId(row.id)}
                className="flex w-full items-start gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-brand-grayBg/70"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-grayBg text-xs font-semibold text-brand-subtext">
                  {(row.requester_name || row.site_name || row.title || '?').trim().charAt(0).toUpperCase()}
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto] items-center gap-3">
                  {/* Kolon 1: başlık/durum, talep eden/departman, talep no/kalem — sol blok */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-bold text-brand-dark">{row.title}</span>
                      <Badge variant="outline" className={cn('shrink-0 border text-[10px] font-semibold', statusBadgeClass(row.status))}>
                        {statusLabel(row.status)}
                      </Badge>
                      {urgency && (
                        <Badge variant="outline" className={cn('hidden shrink-0 border text-[10px] font-semibold sm:inline-flex', urgencyBadgeClass(row.urgency_level))}>
                          {urgency}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-brand-subtext">
                      {row.requester_name && <span className="font-medium text-brand-dark/80">{row.requester_name}</span>}
                      {row.requester_name && row.department && <span className="text-brand-border">•</span>}
                      {row.department && <span>{row.department}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-brand-subtext">
                      {row.request_number && (
                        <span className="rounded-md bg-brand-grayBg px-1.5 py-0.5 font-mono text-[10px] text-brand-dark/70">
                          #{row.request_number}
                        </span>
                      )}
                      <span>
                        {itemCount > 0 ? `${itemCount.toLocaleString('tr-TR')} kalem` : 'Kalem bilgisi yok'}
                      </span>
                    </div>
                  </div>

                  {/* Kolon 2: şantiye — kendi başına ayrı, ortada bir kolon */}
                  <div className="flex h-full shrink-0 items-center justify-center px-2">
                    {row.site_name && (
                      <span className="flex items-center gap-1 whitespace-nowrap text-xs font-bold text-blue-600">
                        <Building2 className="h-3.5 w-3.5" />
                        {row.site_name}
                      </span>
                    )}
                  </div>

                  {/* Kolon 3: tarih + tutar — en sağ */}
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="text-[11px] text-brand-subtext">{formatRelativeDateTime(row.created_at)}</span>
                    {row.total_amount > 0 && (
                      <span className="font-mono text-xs font-semibold text-brand-dark">
                        {formatCurrency(row.total_amount, 'TRY')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Arama çubuğu */}
        <div className="flex items-center gap-1.5 rounded-full bg-brand-grayBg p-1.5 pr-2">
          <Search className="ml-3 h-4 w-4 shrink-0 text-brand-subtext" />
          <input
            value={activitySearch}
            onChange={e => setActivitySearch(e.target.value)}
            placeholder="Talep veya şantiye adına göre filtrele"
            className="w-full rounded-full bg-transparent px-2 py-2 text-sm text-brand-dark placeholder-brand-subtext outline-none"
          />
          <Link
            href="/dashboard/requests/create"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white shadow-sm transition-colors hover:bg-black"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <RequestProcessModal
        requestId={selectedRequestId}
        open={Boolean(selectedRequestId)}
        onOpenChange={nextOpen => {
          if (!nextOpen) setSelectedRequestId(null)
        }}
      />
    </div>
  )
}
