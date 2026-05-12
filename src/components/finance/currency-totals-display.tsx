'use client'

import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import { cn } from '@/lib/utils'
import { currencyTotalsSortedEntries, type CurrencyTotals } from '@/lib/site-invoice-aggregation'

export function CurrencyTotalsStack({
  totals,
  className,
  valueClassName,
}: {
  totals: CurrencyTotals
  className?: string
  valueClassName?: string
}) {
  const entries = currencyTotalsSortedEntries(totals)
  if (entries.length === 0) {
    return (
      <span className={cn('text-elegant-gray-400 dark:text-elegant-gray-600', valueClassName)}>—</span>
    )
  }
  return (
    <span className={cn('flex flex-col gap-0.5 tabular-nums leading-snug', className)}>
      {entries.map(([c, v]) => (
        <span key={c} className={cn('font-mono', valueClassName)}>
          {formatCurrency(v, c)}
        </span>
      ))}
    </span>
  )
}

export function CurrencyTotalsCardGrid({ totals, dense = false }: { totals: CurrencyTotals; dense?: boolean }) {
  const entries = currencyTotalsSortedEntries(totals)
  if (entries.length === 0) {
    return <span className="text-sm text-elegant-gray-400 dark:text-elegant-gray-600">—</span>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([code, amount]) => (
        <div
          key={code}
          className={cn(
            'rounded-xl border bg-white/95 px-3 py-2 shadow-sm dark:bg-elegant-gray-900/95',
            code === 'TRY'
              ? 'border-amber-200/90 dark:border-amber-500/35'
              : 'border-elegant-gray-200 dark:border-elegant-gray-700',
            dense ? 'min-w-[6.5rem]' : 'min-w-[7.5rem]'
          )}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-elegant-gray-500 dark:text-elegant-gray-400">
            {code}
          </p>
          <p
            className={cn(
              'mt-1 font-mono font-semibold tabular-nums leading-tight text-amber-900 dark:text-amber-300',
              dense ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            )}
          >
            {formatCurrency(amount, code)}
          </p>
        </div>
      ))}
    </div>
  )
}
