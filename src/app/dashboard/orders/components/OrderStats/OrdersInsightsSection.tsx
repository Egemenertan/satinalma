'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { OrderAnalyticsSnapshot, OrderData } from '../../types'
import { buildOrderAnalyticsSnapshot, sparkHeightsFromCounts } from '../../utils'
import { formatCurrency } from '../../utils/numberFormatting'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type ChartRange = 7 | 14 | 30

interface OrdersInsightsSectionProps {
  analytics: OrderAnalyticsSnapshot | null
  orders: OrderData[]
  totalCount: number
  isLoading?: boolean
}

function ordersToMinimal(rows: OrderData[]) {
  return rows.map(o => ({
    created_at: o.created_at,
    status: o.status,
    amount: o.amount,
    currency: o.currency,
    is_delivered: o.is_delivered,
  }))
}

function trendPercent(series: number[]): number | null {
  if (series.length < 8) return null
  const prev = series.slice(-8, -4).reduce((a, b) => a + b, 0)
  const cur = series.slice(-4).reduce((a, b) => a + b, 0)
  if (prev <= 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
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
            i === heightsPct.length - 1
              ? accentClass
              : 'bg-elegant-gray-400 dark:bg-elegant-gray-500'
          )}
          style={{ height: `${Math.max(18, h)}%` }}
        />
      ))}
    </div>
  )
}

function MiniArea({
  variant,
  amounts,
}: {
  variant: 'a' | 'b'
  amounts: number[]
}) {
  const w = 100
  const h = 40
  const series = amounts.length === 1 ? [amounts[0], amounts[0]] : amounts
  const max = Math.max(...series, 1)
  const pts = series.map((v, i) => {
    const x = series.length <= 1 ? w / 2 : (i / (series.length - 1)) * w
    const y = h - (v / max) * (h - 8) - 4
    return `${x},${y}`
  })
  const line = `M ${pts.join(' L ')}`
  const fillPath = `${line} L ${w} ${h} L 0 ${h} Z`
  const gid = variant === 'a' ? 'orderGlowA' : 'orderGlowB'

  return (
    <svg className="h-24 w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#00E676" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="#00E676"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 6px rgba(0, 230, 118, 0.35))' }}
      />
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

export function OrdersInsightsSection({
  analytics,
  orders,
  totalCount,
  isLoading,
}: OrdersInsightsSectionProps) {
  const [chartRange, setChartRange] = useState<ChartRange>(14)
  const [chartTooltipIdx, setChartTooltipIdx] = useState<number | null>(null)
  const chartAreaRef = useRef<HTMLDivElement>(null)

  const snapshot = useMemo(() => {
    if (analytics) return analytics
    if (!orders.length && totalCount === 0) return null
    return buildOrderAnalyticsSnapshot(ordersToMinimal(orders), totalCount)
  }, [analytics, orders, totalCount])

  useEffect(() => {
    setChartTooltipIdx(null)
  }, [chartRange, snapshot])

  useEffect(() => {
    if (chartTooltipIdx === null) return
    const onPointerDown = (e: PointerEvent) => {
      const el = chartAreaRef.current
      if (el && !el.contains(e.target as Node)) {
        setChartTooltipIdx(null)
      }
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

  const chartSlice = useMemo(() => {
    if (!snapshot)
      return {
        counts: [] as number[],
        labels: [] as string[],
        tryVals: [] as number[],
        dayKeys: [] as string[],
      }
    const n = snapshot.dailyOrderCounts.length
    const take = Math.min(chartRange, n)
    const slice = snapshot.dailyOrderCounts.slice(-take)
    const counts = slice.map(d => d.count)
    const labels = slice.map(d => d.label)
    const dayKeys = slice.map(d => d.dayKey)
    const tryVals = snapshot.dailyTryAmounts.slice(-take).map(d => d.amount)
    return { counts, labels, tryVals, dayKeys }
  }, [snapshot, chartRange])

  const sparkSeries = useMemo(() => {
    if (!snapshot) return []
    return snapshot.dailyOrderCounts.slice(-7).map(d => d.count)
  }, [snapshot])

  const sparkHeights = useMemo(() => sparkHeightsFromCounts(sparkSeries.length ? sparkSeries : [0, 0, 0, 0, 0, 0, 1]), [sparkSeries])

  const volumeTrend = trendPercent(snapshot?.dailyOrderCounts.map(d => d.count) ?? [])
  const tryTrend = trendPercent(snapshot?.dailyTryAmounts.map(d => d.amount) ?? [])

  const rawBarMax = Math.max(...chartSlice.counts, 0)
  const barMax = rawBarMax === 0 ? 1 : rawBarMax
  const highlightedIdx =
    chartSlice.counts.length > 0 ? chartSlice.counts.lastIndexOf(Math.max(...chartSlice.counts)) : -1

  const trySumSlice = chartSlice.tryVals.reduce((a, b) => a + b, 0)
  const orderSumSlice = chartSlice.counts.reduce((a, b) => a + b, 0)

  const areaA = chartSlice.tryVals.length ? chartSlice.tryVals : [0]
  const areaB = chartSlice.counts.length ? chartSlice.counts : [0]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[380px] w-full rounded-xl" />
      </div>
    )
  }

  if (!snapshot || snapshot.totalCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-elegant-gray-300 bg-white/60 px-6 py-10 text-center dark:border-elegant-gray-700 dark:bg-elegant-black/40">
        <p className="text-sm font-medium text-elegant-gray-700 dark:text-elegant-gray-300">
          Filtrelere uyan sipariş bulunmuyor; grafik ve özet kartları burada görünecek.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {snapshot.isSampled && (
        <p className="text-xs text-elegant-gray-500 dark:text-elegant-gray-400">
          Büyük veri setlerinde özet, son kayıtlara göre ölçeklenir; grafikler seçili filtrelerle uyumludur.
        </p>
      )}

      {/* KPI grid — stats.md yapısı, açık tema + yeşil vurgu */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Teslim edildi
            </span>
            <DeltaPill value={volumeTrend} />
          </div>
          <span className="text-3xl font-bold tracking-tight text-elegant-black dark:text-white">{snapshot.delivered}</span>
          <SparkBars heightsPct={sparkHeights} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.35)]" />
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Kısmi teslim
            </span>
          </div>
          <span className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
            {snapshot.partiallyDelivered}
          </span>
          <SparkBars
            heightsPct={sparkHeights.map(h => Math.round(h * 0.85))}
            accentClass="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
          />
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              İade edildi
            </span>
          </div>
          <span className="text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">{snapshot.returned}</span>
          <SparkBars heightsPct={sparkHeights.map(h => Math.round(h * 0.55))} accentClass="bg-red-500/90" />
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Toplam (filtreli)
            </span>
            <DeltaPill value={volumeTrend} />
          </div>
          <span className="font-mono text-3xl font-bold tracking-tight text-elegant-black dark:text-white">
            {snapshot.totalCount}
          </span>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elegant-gray-200 dark:bg-elegant-gray-800">
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.45)]"
                style={{
                  width: `${Math.min(100, snapshot.totalCount === 0 ? 0 : (snapshot.delivered / snapshot.totalCount) * 100)}%`,
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-elegant-gray-500">
              {snapshot.totalCount === 0
                ? '0%'
                : `${Math.round((snapshot.delivered / snapshot.totalCount) * 100)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Bento: ana grafik + yan özet */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 lg:col-span-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                Sipariş performansı
              </h3>
              <p className="mt-1 text-sm text-elegant-gray-500 dark:text-elegant-gray-400">
                Günlük oluşturulan sipariş adedi (liste ile aynı sipariş kümesi; tablo tarih filtresi teslim tarihine göredir).
              </p>
              {snapshot.performanceChartAnchoredToNewestCreation && (
                <p className="mt-1.5 text-xs leading-snug text-amber-800/90 dark:text-amber-400/95">
                  Grafik ekseni bugüne sabitlenmedi: seçili kayıtların oluşturulma günleri son {chartRange} günlük pencerenin dışındaydı,
                  eksen en yeni oluşturma tarihine göre hizalandı.
                </p>
              )}
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
            aria-label="Günlük oluşturulan sipariş grafiği — çubuğa tıklayarak detay"
          >
            {chartSlice.counts.map((c, i) => {
              const hPct = c === 0 ? 0 : Math.round((c / barMax) * 100)
              const visualPct = c === 0 ? 6 : Math.max(16, hPct)
              const isHi = i === highlightedIdx && c > 0
              const tipOpen = chartTooltipIdx === i
              const dayKey = chartSlice.dayKeys[i]
              return (
                <button
                  key={dayKey ?? `bar-${i}`}
                  type="button"
                  className={cn(
                    'group relative flex h-full min-h-0 min-w-0 flex-1 cursor-pointer flex-col justify-end border-0 bg-transparent px-[1px] pt-1 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-elegant-gray-900'
                  )}
                  onClick={() => setChartTooltipIdx(prev => (prev === i ? null : i))}
                  aria-pressed={tipOpen}
                  aria-describedby={tipOpen ? `order-chart-tip-${i}` : undefined}
                  aria-label={`${chartSlice.labels[i] ?? 'Gün'}: ${c} sipariş, detay için tıklayın`}
                >
                  <div
                    className="relative w-full"
                    style={{
                      height: `${visualPct}%`,
                      minHeight: c > 0 ? 12 : 8,
                    }}
                  >
                    {tipOpen && (
                      <div
                        id={`order-chart-tip-${i}`}
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[min(220px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-elegant-gray-700 bg-elegant-black px-3 py-2 text-left shadow-xl dark:border-elegant-gray-300 dark:bg-white"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/70 dark:text-elegant-gray-600">
                          {chartSlice.labels[i]}
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-white dark:text-elegant-black">
                          {c === 1 ? '1 sipariş' : `${c} sipariş`}
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
                          ? 'bg-primary shadow-[0_0_18px_rgba(0,230,118,0.32)] ring-1 ring-primary/30'
                          : 'bg-elegant-gray-400 hover:bg-elegant-gray-500 dark:bg-elegant-gray-500 dark:hover:bg-elegant-gray-400'
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-elegant-gray-500 dark:text-elegant-gray-400">
            Günlük adedi görmek için çubuğa tıklayın · dışarı tıklayınca veya Esc ile kapanır
          </p>
          <div className="mt-4 flex justify-between border-t border-elegant-gray-100 pt-3 font-mono text-[10px] uppercase tracking-widest text-elegant-gray-400 dark:border-elegant-gray-800">
            <span>{chartSlice.labels[0] ?? '—'}</span>
            <span>{chartSlice.labels[Math.floor(chartSlice.labels.length / 2)] ?? ''}</span>
            <span>{chartSlice.labels[chartSlice.labels.length - 1] ?? '—'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className="flex flex-1 flex-col rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">
              Tutar özeti (TRY)
            </h4>
            <div className="space-y-8">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">
                    Dönem içi TRY hacmi
                  </span>
                  <DeltaPill value={tryTrend} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">
                  {formatCurrency(trySumSlice, 'TRY')}
                </div>
                <MiniArea variant="a" amounts={areaA} />
              </div>
              <div className="border-t border-elegant-gray-100 pt-6 dark:border-elegant-gray-800">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">
                    Günlük sipariş akışı
                  </span>
                  <DeltaPill value={volumeTrend} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">{orderSumSlice} sipariş</div>
                <MiniArea variant="b" amounts={areaB} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
