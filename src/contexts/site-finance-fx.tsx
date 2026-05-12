'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { aggregateCurrencyTotalsViaEurCross, type EurCrossRates } from '@/lib/fx/convertViaEurRates'
import type { CurrencyTotals } from '@/lib/site-invoice-aggregation'

export type FxView = 'LIST' | 'TRY' | 'EUR' | 'USD' | 'GBP'

export type FxAggregateTarget = Exclude<FxView, 'LIST'>

type Ctx = {
  view: FxView
  setView: (v: FxView) => void
  rates: EurCrossRates | null
  rateDate: string | null
  loading: boolean
  error: string | null
  aggregateTo: (totals: CurrencyTotals, target: FxAggregateTarget) => { value: number; incomplete: boolean }
}

const SiteFinanceFxContext = createContext<Ctx | null>(null)

export function useSiteFinanceFx(): Ctx {
  const v = useContext(SiteFinanceFxContext)
  if (!v) throw new Error('useSiteFinanceFx: SiteFinanceFxProvider gerekli')
  return v
}

export function SiteFinanceFxProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<FxView>('LIST')
  const [rates, setRates] = useState<EurCrossRates | null>(null)
  const [rateDate, setRateDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        setLoading(true)
        const r = await fetch('/api/fx/latest')
        const j = (await r.json()) as { date?: string; rates?: EurCrossRates; error?: string }
        if (!r.ok || !j.rates) throw new Error(j.error || 'Kur servisi yanıt vermedi')
        if (!live) return
        setRates(j.rates)
        setRateDate(typeof j.date === 'string' ? j.date : null)
        setError(null)
      } catch (e) {
        if (!live) return
        setError(e instanceof Error ? e.message : 'Kur yüklenemedi')
        setRates(null)
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const aggregateTo = useCallback(
    (totals: CurrencyTotals, target: FxAggregateTarget) => {
      if (!rates) return { value: 0, incomplete: true }
      return aggregateCurrencyTotalsViaEurCross(totals, target, rates)
    },
    [rates]
  )

  const value = useMemo(
    () => ({ view, setView, rates, rateDate, loading, error, aggregateTo }),
    [view, rates, rateDate, loading, error, aggregateTo]
  )

  return <SiteFinanceFxContext.Provider value={value}>{children}</SiteFinanceFxContext.Provider>
}

const FX_UNITS: { id: FxView; label: string }[] = [
  { id: 'LIST', label: 'Orijinal' },
  { id: 'TRY', label: 'TRY' },
  { id: 'EUR', label: 'EUR' },
  { id: 'USD', label: 'USD' },
  { id: 'GBP', label: 'GBP' },
]

export function SiteFinanceFxToolbar({ className }: { className?: string }) {
  const { view, setView, loading, error, rateDate } = useSiteFinanceFx()
  return (
    <div
      className={cn(
        'rounded-xl border border-elegant-gray-200 bg-elegant-gray-50/80 px-4 py-3 dark:border-elegant-gray-800 dark:bg-elegant-black/40',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">Görüntü birimi</p>
          <p className="mt-0.5 text-xs text-elegant-gray-500 dark:text-elegant-gray-400">
            Orijinal: her döviz ayrı kart / satır. TRY·EUR·USD·GBP: Frankfurter (ECB) günlük kuru ile yaklaşık tek toplam.
            {rateDate ? ` · Kur günü: ${rateDate}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FX_UNITS.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setView(u.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold tabular-nums transition-colors',
                view === u.id
                  ? 'bg-amber-500 text-white shadow-sm dark:bg-amber-600'
                  : 'bg-white text-elegant-gray-600 hover:bg-elegant-gray-100 dark:bg-elegant-gray-900 dark:text-elegant-gray-300 dark:hover:bg-elegant-gray-800',
                loading && u.id !== 'LIST' && 'opacity-70'
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}
