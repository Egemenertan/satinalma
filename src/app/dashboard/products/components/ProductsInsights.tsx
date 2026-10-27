'use client'

import { useMemo } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import type { ProductsInsightsBundle } from '@/services/products.service'
import { Button } from '@/components/ui/button'
import { isAuthExpiredError } from '@/lib/auth/session'
import { signOutAndRedirect } from '@/lib/auth/sign-out'

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
  return counts.map((c) => Math.round((c / max) * 100))
}

function DeltaPill({ value }: { value: number | null }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <div
      className={cn(
        'flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
        up ? 'bg-navy/10 text-navy' : 'bg-coral/15 text-coral-700'
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

export interface ProductsInsightsProps {
  bundle: ProductsInsightsBundle | undefined
  loading: boolean
  error: Error | undefined
  warehouseName?: string
}

export function ProductsInsights({ bundle, loading, error }: ProductsInsightsProps) {
  const stats = bundle?.stats
  const dailyPoints = bundle?.dailyPoints ?? []

  const newProductTrend = trendPercent(dailyPoints.map((d) => d.newProducts))
  const stockInTrend = trendPercent(dailyPoints.map((d) => d.stockInQty))

  const sparkNew = useMemo(
    () =>
      sparkHeightsFromCounts(
        dailyPoints.slice(-7).map((d) => d.newProducts).length
          ? dailyPoints.slice(-7).map((d) => d.newProducts)
          : [0, 0, 0, 0, 0, 0, 1]
      ),
    [dailyPoints]
  )

  const sparkStockIn = useMemo(
    () =>
      sparkHeightsFromCounts(
        dailyPoints.slice(-7).map((d) => d.stockInQty).length
          ? dailyPoints.slice(-7).map((d) => d.stockInQty)
          : [0, 0, 1]
      ),
    [dailyPoints]
  )

  if (loading && !bundle) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    const expired = isAuthExpiredError(error) || /oturumunuzun süresi doldu/i.test(error.message || '')
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <p className="font-medium">{expired ? 'Oturumunuzun süresi doldu' : 'Ürün özeti yüklenemedi'}</p>
        <p className="mt-1 text-sm opacity-90">
          {expired ? 'Tekrar giriş yapmanız gerekiyor.' : error.message}
        </p>
        {expired && (
          <Button
            type="button"
            onClick={() => void signOutAndRedirect()}
            className="mt-4 rounded-xl bg-red-800 text-white hover:bg-red-900"
          >
            Tekrar giriş yap
          </Button>
        )}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-elegant-gray-500">
            Toplam ürün
          </span>
          <DeltaPill value={newProductTrend} />
        </div>
        <span className="text-4xl font-bold tracking-tight text-elegant-black dark:text-white">
          {stats.totalProducts}
        </span>
        <p className="mt-1 text-sm text-elegant-gray-500">Aktif katalog kalemi</p>
        <SparkBars heightsPct={sparkNew} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.35)]" />
      </div>

      <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-elegant-gray-500">
            Düşük stok
          </span>
        </div>
        <span className="text-4xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
          {stats.lowStockCount}
        </span>
        <p className="mt-1 text-sm text-elegant-gray-500">Minimum seviyenin altındaki satırlar</p>
        <SparkBars
          heightsPct={sparkStockIn.map((h) => Math.round(h * 0.92))}
          accentClass="bg-amber-500 shadow-[0_0_10px_rgba(83,19,30,0.35)]"
        />
      </div>

      <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-elegant-gray-500">
            Toplam stok adedi
          </span>
          <DeltaPill value={stockInTrend} />
        </div>
        <span className="font-mono text-4xl font-bold tracking-tight text-elegant-black dark:text-white">
          {stats.totalStockUnits.toLocaleString('tr-TR')}
        </span>
        <p className="mt-1 text-sm text-elegant-gray-500">Seçili kapsamda warehouse_stock toplamı</p>
      </div>

      <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-elegant-gray-500">
            Stok değeri
          </span>
          <DeltaPill value={stockInTrend} />
        </div>
        <span className="font-mono text-3xl font-bold tracking-tight text-elegant-black dark:text-white">
          {formatCurrency(stats.totalValue, 'TRY')}
        </span>
        <p className="mt-1 text-sm text-elegant-gray-500">Birim fiyat × miktar (seçili depo / tümü)</p>
        <SparkBars heightsPct={sparkStockIn} accentClass="bg-primary shadow-[0_0_12px_rgba(0,230,118,0.3)]" />
      </div>
    </div>
  )
}
