'use client'

import { useMemo, useState, useRef, useEffect, useId } from 'react'
import Link from 'next/link'
import { TrendingDown, TrendingUp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import type { DashboardBundle, DashboardDailyPoint } from '@/services/dashboard.service'

type ChartRange = 7 | 14 | 30

function trendPercent(series: number[]): number | null {
  if (series.length < 8) return null
  const prev = series.slice(-8, -4).reduce((a, b) => a + b, 0)
  const cur = series.slice(-4).reduce((a, b) => a + b, 0)
  if (prev <= 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

function sparkHeightsFromCounts(counts: number[]): number[] {
  if (!counts.length) return counts
  const max = Math.max(...counts, 1)
  return counts.map(c => Math.round((c / max) * 100))
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

function SparkBars({ heightsPct, accentClass }: { heightsPct: number[]; accentClass: string }) {
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

/** stats.md lojistik kartları — alan + çizgi + dolgu */
function LogisticsSparkline({
  values,
  gradientId,
}: {
  values: number[]
  gradientId: string
}) {
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
          <stop offset="0%" stopColor="#00E676" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${safeGid})`} />
      <path
        d={line}
        fill="none"
        stroke="#00E676"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 10px rgba(0, 230, 118, 0.38))' }}
      />
      <circle cx={lastCx} cy={lastCy} r={3.5} fill="#00E676" style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,118,0.6))' }} />
    </svg>
  )
}

function statusBadgeClass(status: string): string {
  const s = (status || '').toLowerCase()
  if (s.includes('red') || s.includes('iptal')) return 'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900 dark:text-red-400'
  if (s.includes('onay') || s.includes('approved')) return 'border-primary/30 bg-primary/10 text-primary'
  if (s.includes('pending') || s.includes('bekle') || s.includes('draft')) {
    return 'border-amber-200 bg-amber-500/10 text-amber-800 dark:border-amber-900 dark:text-amber-400'
  }
  return 'border-elegant-gray-200 bg-elegant-gray-100 text-elegant-gray-700 dark:border-elegant-gray-700 dark:bg-elegant-gray-800 dark:text-elegant-gray-200'
}

function statusLabel(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'pending') return 'Beklemede'
  if (s === 'approved') return 'Onaylandı'
  if (s === 'rejected') return 'Reddedildi'
  if (s === 'cancelled') return 'İptal'
  return status || '—'
}

interface DashboardInsightsProps {
  bundle: DashboardBundle | undefined
  loading: boolean
  error: Error | undefined
}

export function DashboardInsights({ bundle, loading, error }: DashboardInsightsProps) {
  const [chartRange, setChartRange] = useState<ChartRange>(14)
  const [chartTooltipIdx, setChartTooltipIdx] = useState<number | null>(null)
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const gidAmount = useId()
  const gidRequests = useId()

  const stats = bundle?.stats
  const dailyPoints = bundle?.dailyPoints ?? []

  const chartSlice = useMemo(() => {
    const n = dailyPoints.length
    const take = Math.min(chartRange, n)
    const slice = dailyPoints.slice(-take)
    return {
      points: slice,
      counts: slice.map(d => d.requests),
      amounts: slice.map(d => d.amount),
      labels: slice.map(d => d.label),
      keys: slice.map(d => d.dayKey),
    }
  }, [dailyPoints, chartRange])

  useEffect(() => {
    setChartTooltipIdx(null)
  }, [chartRange, bundle])

  useEffect(() => {
    if (chartTooltipIdx === null) return
    const onPointerDown = (e: PointerEvent) => {
      const el = chartAreaRef.current
      if (el && !el.contains(e.target as Node)) setChartTooltipIdx(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [chartTooltipIdx])

  useEffect(() => {
    if (chartTooltipIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChartTooltipIdx(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chartTooltipIdx])

  const sparkSeries = useMemo(() => dailyPoints.slice(-7).map(d => d.requests), [dailyPoints])
  const sparkHeights = useMemo(
    () => sparkHeightsFromCounts(sparkSeries.length ? sparkSeries : [0, 0, 0, 0, 0, 0, 1]),
    [sparkSeries]
  )

  const pendingSpark = useMemo(() => {
    const last7 = dailyPoints.slice(-7).map(d => d.requests)
    return sparkHeightsFromCounts(last7.length ? last7 : [1])
  }, [dailyPoints])

  const amountSparkRaw = useMemo(() => dailyPoints.slice(-7).map(d => d.amount), [dailyPoints])
  const amountSpark = useMemo(
    () => sparkHeightsFromCounts(amountSparkRaw.length ? amountSparkRaw : [0, 0, 1]),
    [amountSparkRaw]
  )

  const volumeTrend = trendPercent(dailyPoints.map(d => d.requests))
  const amountTrend = trendPercent(dailyPoints.map(d => d.amount))

  const rawBarMax = Math.max(...chartSlice.counts, 0)
  const barMax = rawBarMax === 0 ? 1 : rawBarMax
  const highlightedIdx =
    chartSlice.counts.length > 0 ? chartSlice.counts.lastIndexOf(Math.max(...chartSlice.counts)) : -1

  const trySliceSum = chartSlice.amounts.reduce((a, b) => a + b, 0)
  const requestSliceSum = chartSlice.counts.reduce((a, b) => a + b, 0)

  const logisticsAmountTrend = trendPercent(chartSlice.amounts)
  const logisticsRequestsTrend = trendPercent(chartSlice.counts)

  if (loading && !bundle) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <p className="font-medium">Özet yüklenemedi</p>
        <p className="mt-1 text-sm opacity-90">{error.message}</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-elegant-black dark:text-white md:text-3xl">
            Panel özeti
          </h1>
          <p className="mt-1 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
            Talepler, şantiyeler ve günlük operasyon trendleri — tek ekranda veri odaklı görünüm
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 border-elegant-gray-300 bg-white dark:bg-elegant-gray-900" asChild>
          <Link href="/dashboard/requests">
            Taleplere git
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Toplam talep
            </span>
            <DeltaPill value={volumeTrend} />
          </div>
          <span className="text-3xl font-bold tracking-tight text-elegant-black dark:text-white">{stats.totalRequests}</span>
          <p className="mt-1 text-xs text-elegant-gray-500">Kayıtlı satın alma talepleri</p>
          <SparkBars heightsPct={sparkHeights} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.35)]" />
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Bekleyen / taslak
            </span>
          </div>
          <span className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400">{stats.pendingRequests}</span>
          <p className="mt-1 text-xs text-elegant-gray-500">Onay veya teklif aşamasında</p>
          <SparkBars
            heightsPct={pendingSpark.map(h => Math.round(h * 0.9))}
            accentClass="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
          />
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Şantiye · Tedarikçi
            </span>
          </div>
          <p className="mb-4 text-xs text-elegant-gray-500">Kayıtlı lokasyon ve iş ortağı sayısı</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-elegant-gray-50 py-2 dark:bg-elegant-gray-800/80">
              <div className="text-lg font-bold text-elegant-black dark:text-white">{stats.totalSites}</div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-elegant-gray-500">Şantiye</div>
            </div>
            <div className="rounded-lg bg-elegant-gray-50 py-2 dark:bg-elegant-gray-800/80">
              <div className="text-lg font-bold text-elegant-black dark:text-white">{stats.totalSuppliers}</div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-elegant-gray-500">Tedarikçi</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Talep tutarı (toplam)
            </span>
            <DeltaPill value={amountTrend} />
          </div>
          <span className="font-mono text-2xl font-bold tracking-tight text-elegant-black dark:text-white">
            {formatCurrency(stats.totalAmount, 'TRY')}
          </span>
          <p className="mt-1 text-xs text-elegant-gray-500">Tüm taleplerdeki tutar alanları</p>
          <SparkBars heightsPct={amountSpark} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.3)]" />
        </div>
      </div>

      {/* Bento: bar chart + lojistik çizgi grafikleri */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 lg:col-span-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">Talep performansı</h3>
              <p className="mt-1 text-sm text-elegant-gray-500 dark:text-elegant-gray-400">
                Günlük oluşturulan talep adedi — son günler
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
            aria-label="Günlük talep grafiği"
          >
            {chartSlice.counts.map((c, i) => {
              const hPct = c === 0 ? 0 : Math.round((c / barMax) * 100)
              const visualPct = c === 0 ? 6 : Math.max(16, hPct)
              const isHi = i === highlightedIdx && c > 0
              const tipOpen = chartTooltipIdx === i
              const dayKey = chartSlice.keys[i]
              return (
                <button
                  key={dayKey ?? `db-bar-${i}`}
                  type="button"
                  className={cn(
                    'group relative flex h-full min-h-0 min-w-0 flex-1 cursor-pointer flex-col justify-end border-0 bg-transparent px-[1px] pt-1 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-elegant-gray-900'
                  )}
                  onClick={() => setChartTooltipIdx(prev => (prev === i ? null : i))}
                  aria-pressed={tipOpen}
                  aria-describedby={tipOpen ? `db-chart-tip-${i}` : undefined}
                  aria-label={`${chartSlice.labels[i]}: ${c} talep`}
                >
                  <div
                    className="relative w-full"
                    style={{ height: `${visualPct}%`, minHeight: c > 0 ? 12 : 8 }}
                  >
                    {tipOpen && (
                      <div
                        id={`db-chart-tip-${i}`}
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[min(220px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-elegant-gray-700 bg-elegant-black px-3 py-2 text-left shadow-xl dark:border-elegant-gray-300 dark:bg-white"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/70 dark:text-elegant-gray-600">
                          {chartSlice.labels[i]}
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
                        tipOpen && 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-elegant-gray-900',
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
            Günlük adedi görmek için çubuğa tıklayın · dışarı veya Esc ile kapanır
          </p>
          <div className="mt-4 flex justify-between border-t border-elegant-gray-100 pt-3 font-mono text-[10px] uppercase tracking-widest text-elegant-gray-400 dark:border-elegant-gray-800">
            <span>{chartSlice.labels[0] ?? '—'}</span>
            <span>{chartSlice.labels[Math.floor(chartSlice.labels.length / 2)] ?? ''}</span>
            <span>{chartSlice.labels[chartSlice.labels.length - 1] ?? '—'}</span>
          </div>
        </div>

        <div className="flex flex-col lg:col-span-4">
          <div className="flex flex-1 flex-col rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">
              Operasyon özeti
            </h4>
            <div className="space-y-10">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">
                    Günlük talep tutarı (TRY)
                  </span>
                  <DeltaPill value={logisticsAmountTrend} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">
                  {formatCurrency(trySliceSum, 'TRY')}
                </div>
                <p className="mt-1 text-xs text-elegant-gray-500">Seçili aralıkta toplam</p>
                <LogisticsSparkline values={chartSlice.amounts} gradientId={gidAmount} />
              </div>
              <div className="border-t border-elegant-gray-100 pt-8 dark:border-elegant-gray-800">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">
                    Günlük talep akışı
                  </span>
                  <DeltaPill value={logisticsRequestsTrend} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">{requestSliceSum} talep</div>
                <p className="mt-1 text-xs text-elegant-gray-500">Seçili aralıkta toplam adet</p>
                <LogisticsSparkline values={chartSlice.counts.map(Number)} gradientId={gidRequests} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Son talepler tablosu */}
      <div className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
        <div className="flex items-center justify-between border-b border-elegant-gray-100 px-6 py-5 dark:border-elegant-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-elegant-black dark:text-white">Son talepler</h3>
            <p className="text-sm text-elegant-gray-500">En güncel kayıtlar</p>
          </div>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/90" asChild>
            <Link href="/dashboard/requests">Tümünü gör</Link>
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
                  Şantiye
                </th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-elegant-gray-500">
                  Durum
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
              {(bundle?.recentRequests ?? []).map(row => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-800/40"
                >
                  <td className="max-w-[220px] truncate px-6 py-4 text-sm font-medium text-elegant-black dark:text-white">
                    {row.title}
                  </td>
                  <td className="px-6 py-4 text-sm text-elegant-gray-600 dark:text-elegant-gray-300">{row.site_name}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={cn('border font-semibold uppercase tracking-tight', statusBadgeClass(row.status))}>
                      {statusLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-semibold tabular-nums text-elegant-black dark:text-white">
                    {formatCurrency(row.total_amount, 'TRY')}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-elegant-gray-500">
                    {new Date(row.created_at).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!bundle?.recentRequests || bundle.recentRequests.length === 0) && (
            <div className="px-6 py-12 text-center text-sm text-elegant-gray-500">Henüz talep yok</div>
          )}
        </div>
      </div>
    </div>
  )
}
