'use client'

import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import { cn } from '@/lib/utils'
import type { CurrencyTotals } from '@/lib/site-invoice-aggregation'
import { useSiteFinanceFx, type FxAggregateTarget } from '@/contexts/site-finance-fx'
import { CurrencyTotalsCardGrid, CurrencyTotalsStack } from '@/components/finance/currency-totals-display'

export function ConvertedTotalsCards({ totals, dense = false }: { totals: CurrencyTotals; dense?: boolean }) {
  const fx = useSiteFinanceFx()
  if (fx.view === 'LIST') return <CurrencyTotalsCardGrid totals={totals} dense={dense} />

  if (fx.loading) {
    return <span className="text-sm text-elegant-gray-400">Kurlar yükleniyor…</span>
  }

  if (!fx.rates || fx.error) {
    return <CurrencyTotalsCardGrid totals={totals} dense={dense} />
  }

  const target = fx.view
  const { value, incomplete } = fx.aggregateTo(totals, target)

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'inline-block rounded-xl border bg-white/95 px-4 py-3 shadow-sm dark:bg-elegant-gray-900/95',
          target === 'TRY'
            ? 'border-amber-200/90 dark:border-amber-500/35'
            : 'border-elegant-gray-200 dark:border-elegant-gray-700'
        )}
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-elegant-gray-500 dark:text-elegant-gray-400">
          Toplam ≈ {target}
        </p>
        <p
          className={cn(
            'mt-1 font-mono font-bold tabular-nums text-amber-900 dark:text-amber-300',
            dense ? 'text-sm sm:text-base' : 'text-base sm:text-xl'
          )}
        >
          {formatCurrency(value, target)}
        </p>
      </div>
      {incomplete ? (
        <p className="text-[10px] leading-snug text-amber-800/90 dark:text-amber-300/80">
          Bazı para birimleri ECB kuru listesinde yok; toplama dahil edilmedi.
        </p>
      ) : null}
    </div>
  )
}

export function ConvertedTotalsStack({
  totals,
  className,
  valueClassName,
  align = 'start',
  pinnedTarget,
}: {
  totals: CurrencyTotals
  className?: string
  valueClassName?: string
  align?: 'start' | 'end'
  /** Toolbar LIST olsa bile bu para birimine çevirip göster */
  pinnedTarget?: FxAggregateTarget
}) {
  const fx = useSiteFinanceFx()
  const target: FxAggregateTarget | null = pinnedTarget ?? (fx.view === 'LIST' ? null : fx.view)

  if (target === null) {
    return (
      <span className={cn(align === 'end' && 'flex flex-col items-end', 'inline-block text-left')}>
        <CurrencyTotalsStack totals={totals} className={className} valueClassName={valueClassName} />
      </span>
    )
  }

  if (fx.loading) {
    return <span className={cn('text-xs text-elegant-gray-400', valueClassName)}>…</span>
  }

  if (!fx.rates || fx.error) {
    return <CurrencyTotalsStack totals={totals} className={className} valueClassName={valueClassName} />
  }

  const { value, incomplete } = fx.aggregateTo(totals, target)

  return (
    <span className={cn('inline-flex flex-col gap-0.5', align === 'end' && 'items-end')}>
      <span className={cn('font-mono tabular-nums', valueClassName)}>{formatCurrency(value, target)}</span>
      {incomplete ? (
        <span className="max-w-[14rem] text-[9px] leading-tight text-amber-800/80 dark:text-amber-400/80">
          Kısmi: bilinmeyen döviz
        </span>
      ) : null}
    </span>
  )
}
