'use client'

import { useMemo, useState, useRef, useEffect, useId } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import type { ProductsInsightsBundle } from '@/services/products.service'

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

export interface ProductsInsightsProps {
  bundle: ProductsInsightsBundle | undefined
  loading: boolean
  error: Error | undefined
  /** Seçili depo adı (alt başlıkta) */
  warehouseName?: string
}

export function ProductsInsights({ bundle, loading, error, warehouseName }: ProductsInsightsProps) {
  const [chartRange, setChartRange] = useState<ChartRange>(14)
  const [chartTooltipIdx, setChartTooltipIdx] = useState<number | null>(null)
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const gidStockIn = useId()
  const gidNewProducts = useId()

  const stats = bundle?.stats
  const dailyPoints = bundle?.dailyPoints ?? []

  const chartSlice = useMemo(() => {
    const n = dailyPoints.length
    const take = Math.min(chartRange, n)
    const slice = dailyPoints.slice(-take)
    return {
      newCounts: slice.map(d => d.newProducts),
      stockIn: slice.map(d => d.stockInQty),
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

  const newProductTrend = trendPercent(dailyPoints.map(d => d.newProducts))
  const stockInTrend = trendPercent(dailyPoints.map(d => d.stockInQty))

  const sparkNew = useMemo(
    () =>
      sparkHeightsFromCounts(
        dailyPoints.slice(-7).map(d => d.newProducts).length
          ? dailyPoints.slice(-7).map(d => d.newProducts)
          : [0, 0, 0, 0, 0, 0, 1]
      ),
    [dailyPoints]
  )

  const sparkStockIn = useMemo(
    () =>
      sparkHeightsFromCounts(
        dailyPoints.slice(-7).map(d => d.stockInQty).length
          ? dailyPoints.slice(-7).map(d => d.stockInQty)
          : [0, 0, 1]
      ),
    [dailyPoints]
  )

  const rawBarMax = Math.max(...chartSlice.newCounts, 0)
  const barMax = rawBarMax === 0 ? 1 : rawBarMax
  const highlightedIdx =
    chartSlice.newCounts.length > 0 ? chartSlice.newCounts.lastIndexOf(Math.max(...chartSlice.newCounts)) : -1

  const stockInSliceSum = chartSlice.stockIn.reduce((a, b) => a + b, 0)
  const newProductSliceSum = chartSlice.newCounts.reduce((a, b) => a + b, 0)

  const logisticsStockInTrend = trendPercent(chartSlice.stockIn)
  const logisticsNewTrend = trendPercent(chartSlice.newCounts)

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
        <p className="font-medium">Ürün özeti yüklenemedi</p>
        <p className="mt-1 text-sm opacity-90">{error.message}</p>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-elegant-black dark:text-white md:text-3xl">Ürün özeti</h2>
        <p className="text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
          {warehouseName
            ? `${warehouseName} • Stok, yeni kayıt ve depo giriş trendleri`
            : 'Tüm depolar • Stok, yeni kayıt ve depo giriş trendleri'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Toplam ürün</span>
            <DeltaPill value={newProductTrend} />
          </div>
          <span className="text-3xl font-bold tracking-tight text-elegant-black dark:text-white">{stats.totalProducts}</span>
          <p className="mt-1 text-xs text-elegant-gray-500">Aktif katalog kalemi</p>
          <SparkBars heightsPct={sparkNew} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.35)]" />
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Düşük stok</span>
          </div>
          <span className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400">{stats.lowStockCount}</span>
          <p className="mt-1 text-xs text-elegant-gray-500">Minimum seviyenin altındaki satırlar</p>
          <SparkBars
            heightsPct={sparkStockIn.map(h => Math.round(h * 0.92))}
            accentClass="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
          />
          <p className="mt-2 text-[10px] text-elegant-gray-400">Mini grafik: son günlerdeki depo giriş hareketi</p>
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Toplam stok adedi</span>
            <DeltaPill value={stockInTrend} />
          </div>
          <span className="font-mono text-3xl font-bold tracking-tight text-elegant-black dark:text-white">
            {stats.totalStockUnits.toLocaleString('tr-TR')}
          </span>
          <p className="mt-1 text-xs text-elegant-gray-500">Seçili kapsamda warehouse_stock toplamı</p>
        </div>

        <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Stok değeri</span>
            <DeltaPill value={stockInTrend} />
          </div>
          <span className="font-mono text-2xl font-bold tracking-tight text-elegant-black dark:text-white">
            {formatCurrency(stats.totalValue, 'TRY')}
          </span>
          <p className="mt-1 text-xs text-elegant-gray-500">Birim fiyat × miktar (seçili depo / tümü)</p>
          <SparkBars heightsPct={sparkStockIn} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.3)]" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900 lg:col-span-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">Yeni ürün kaydı</h3>
              <p className="mt-1 text-sm text-elegant-gray-500 dark:text-elegant-gray-400">
                Günlük oluşturulan aktif ürün sayısı
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
            aria-label="Günlük yeni ürün grafiği"
          >
            {chartSlice.newCounts.map((c, i) => {
              const hPct = c === 0 ? 0 : Math.round((c / barMax) * 100)
              const visualPct = c === 0 ? 6 : Math.max(16, hPct)
              const isHi = i === highlightedIdx && c > 0
              const tipOpen = chartTooltipIdx === i
              const dayKey = chartSlice.keys[i]
              const stockInDay = chartSlice.stockIn[i] ?? 0
              return (
                <button
                  key={dayKey ?? `prod-bar-${i}`}
                  type="button"
                  className={cn(
                    'group relative flex h-full min-h-0 min-w-0 flex-1 cursor-pointer flex-col justify-end border-0 bg-transparent px-[1px] pt-1 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-elegant-gray-900'
                  )}
                  onClick={() => setChartTooltipIdx(prev => (prev === i ? null : i))}
                  aria-pressed={tipOpen}
                  aria-describedby={tipOpen ? `prod-chart-tip-${i}` : undefined}
                  aria-label={`${chartSlice.labels[i]}: ${c} yeni ürün`}
                >
                  <div
                    className="relative w-full"
                    style={{ height: `${visualPct}%`, minHeight: c > 0 ? 12 : 8 }}
                  >
                    {tipOpen && (
                      <div
                        id={`prod-chart-tip-${i}`}
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[min(240px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-elegant-gray-700 bg-elegant-black px-3 py-2 text-left shadow-xl dark:border-elegant-gray-300 dark:bg-white"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/70 dark:text-elegant-gray-600">
                          {chartSlice.labels[i]}
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-white dark:text-elegant-black">
                          {c === 1 ? '1 yeni ürün' : `${c} yeni ürün`}
                        </p>
                        <p className="mt-1 text-[11px] tabular-nums text-white/75 dark:text-elegant-gray-600">
                          Depo girişi: {stockInDay === 1 ? '1 adet' : `${Math.round(stockInDay)} adet`}
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
            Günlük değeri görmek için çubuğa tıklayın · dışarı veya Esc ile kapanır
          </p>
          <div className="mt-4 flex justify-between border-t border-elegant-gray-100 pt-3 font-mono text-[10px] uppercase tracking-widest text-elegant-gray-400 dark:border-elegant-gray-800">
            <span>{chartSlice.labels[0] ?? '—'}</span>
            <span>{chartSlice.labels[Math.floor(chartSlice.labels.length / 2)] ?? ''}</span>
            <span>{chartSlice.labels[chartSlice.labels.length - 1] ?? '—'}</span>
          </div>
        </div>

        <div className="flex flex-col lg:col-span-4">
          <div className="flex flex-1 flex-col rounded-xl border border-elegant-gray-200 bg-white p-6 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">Stok hareket özeti</h4>
            <div className="space-y-10">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">
                    Günlük depo girişi (adet)
                  </span>
                  <DeltaPill value={logisticsStockInTrend} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">
                  {Math.round(stockInSliceSum).toLocaleString('tr-TR')} adet
                </div>
                <p className="mt-1 text-xs text-elegant-gray-500">Seçili aralıkta toplam giriş miktarı</p>
                <LogisticsSparkline values={chartSlice.stockIn} gradientId={gidStockIn} />
              </div>
              <div className="border-t border-elegant-gray-100 pt-8 dark:border-elegant-gray-800">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-elegant-gray-600 dark:text-elegant-gray-300">Yeni ürün akışı</span>
                  <DeltaPill value={logisticsNewTrend} />
                </div>
                <div className="text-xl font-bold tracking-tight text-elegant-black dark:text-white">{newProductSliceSum} kayıt</div>
                <p className="mt-1 text-xs text-elegant-gray-500">Seçili aralıkta toplam</p>
                <LogisticsSparkline values={chartSlice.newCounts.map(Number)} gradientId={gidNewProducts} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
