'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Layers, Receipt } from 'lucide-react'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import { CurrencyTotalsStack } from '@/components/finance/currency-totals-display'
import { useSiteFinanceFx } from '@/contexts/site-finance-fx'
import { cn } from '@/lib/utils'
import { sumAllCurrenciesTotals } from '@/lib/site-invoice-aggregation'
import type { CurrencyTotals } from '@/lib/site-invoice-aggregation'

export type SiteMaterialGroupRow = {
  groupLabel: string
  requestItemCount: number
  orderCount: number
  invoiced: CurrencyTotals
}

/** Talep kalemi + sipariş sayısı — şantiye sayfasından doldurulur. */
export type SiteOrderedMaterialLine = {
  id: string
  itemName: string
  purpose: string | null
  unit: string | null
  quantityLabel: string | null
  orderCount: number
}

export function listFallbackCompareSiteMaterialRows(a: SiteMaterialGroupRow, b: SiteMaterialGroupRow): number {
  const bTry = b.invoiced.get('TRY') ?? 0
  const aTry = a.invoiced.get('TRY') ?? 0
  if (bTry !== aTry) return bTry - aTry
  const diff = sumAllCurrenciesTotals(b.invoiced) - sumAllCurrenciesTotals(a.invoiced)
  if (Math.abs(diff) > 1e-9) return diff
  return a.groupLabel.localeCompare(b.groupLabel, 'tr')
}

export type SiteFinanceFxForMaterialSort = Pick<
  ReturnType<typeof useSiteFinanceFx>,
  'loading' | 'rates' | 'error' | 'aggregateTo'
>

/** GBP sıralaması (rapor PDF ve kart tabanı ortak). */
export function sortSiteMaterialRowsByGbpDescending(
  rows: SiteMaterialGroupRow[],
  fx: SiteFinanceFxForMaterialSort
): SiteMaterialGroupRow[] {
  const withInv = rows.filter((r) => sumAllCurrenciesTotals(r.invoiced) > 1e-9)
  const noInv = rows.filter((r) => sumAllCurrenciesTotals(r.invoiced) <= 1e-9)

  if (fx.loading || !fx.rates || fx.error) {
    withInv.sort(listFallbackCompareSiteMaterialRows)
  } else {
    withInv.sort((a, b) => {
      const sb = fx.aggregateTo(b.invoiced, 'GBP').value
      const sa = fx.aggregateTo(a.invoiced, 'GBP').value
      if (Math.abs(sb - sa) > 1e-6) return sb - sa
      return a.groupLabel.localeCompare(b.groupLabel, 'tr')
    })
  }

  noInv.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, 'tr'))
  return [...withInv, ...noInv]
}

function MaterialGroupInvoicedWithGbpTotal({
  invoiced,
  fx,
}: {
  invoiced: CurrencyTotals
  fx: ReturnType<typeof useSiteFinanceFx>
}) {
  const hasLines = sumAllCurrenciesTotals(invoiced) > 1e-9
  if (!hasLines) {
    return <span className="text-sm font-mono text-elegant-gray-400 dark:text-elegant-gray-600">—</span>
  }

  const gbpReady = !fx.loading && !fx.error && fx.rates
  const gbpAgg = gbpReady ? fx.aggregateTo(invoiced, 'GBP') : null

  return (
    <div className="flex flex-col gap-2">
      <CurrencyTotalsStack
        totals={invoiced}
        className="text-amber-900 dark:text-amber-300"
        valueClassName="font-semibold text-amber-900 dark:text-amber-300"
      />
      <div className="border-t border-elegant-gray-200 pt-2 dark:border-elegant-gray-700">
        {fx.loading ? (
          <p className="text-[10px] leading-snug text-elegant-gray-500">Toplam ≈ GBP: kurlar yükleniyor…</p>
        ) : fx.error || !fx.rates ? (
          <p className="text-[10px] leading-snug text-amber-800/90 dark:text-amber-300/80">
            GBP toplamı için kurlar gerekli ({fx.error ?? 'veri yok'}).
          </p>
        ) : gbpAgg ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-elegant-gray-500 dark:text-elegant-gray-400">
              Toplam ≈ GBP
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-300">
              {formatCurrency(gbpAgg.value, 'GBP')}
            </p>
            {gbpAgg.incomplete ? (
              <p className="mt-1 max-w-[14rem] text-[9px] leading-tight text-amber-800/85 dark:text-amber-400/85">
                Bazı dövizler kur listesinde yok; GBP toplamına eklenmedi.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

export function SiteMaterialGroupsBreakdown({
  rows,
  orderedLinesByGroup,
  unlinkedLabel,
}: {
  rows: SiteMaterialGroupRow[]
  orderedLinesByGroup: Record<string, SiteOrderedMaterialLine[]>
  unlinkedLabel: string
}) {
  const fx = useSiteFinanceFx()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const ordered = useMemo(
    () => sortSiteMaterialRowsByGbpDescending(rows, fx),
    [rows, fx.loading, fx.rates, fx.error, fx.aggregateTo]
  )

  const toggle = (groupLabel: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(groupLabel)) next.delete(groupLabel)
      else next.add(groupLabel)
      return next
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-elegant-gray-500" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white sm:text-xl">
            En çok faturalanan malzeme grupları
          </h2>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-elegant-gray-500 dark:text-elegant-gray-400">
          Kart başlığına tıklayarak siparişe bağlı talep kalemlerini ve kullanım amaçlarını açabilirsiniz. Her kartta
          döviz kırılımı ve altta yaklaşık GBP toplamı vardır. Kart sırası GBP üzerinden çoktan aza.
          Sipariş kalem seçilmemiş faturalanan satırlar &quot;{unlinkedLabel}&quot; grubunda toplanır.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-elegant-gray-500">
          Henüz talep kalemi yok veya veri yok; malzeme grupları talep kalemlerinden, faturalar sipariş-fatura zincirinden
          oluşur.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((row, idx) => {
            const invSum = sumAllCurrenciesTotals(row.invoiced)
            const hasInvoice = invSum > 1e-9
            const showRank = idx < 3 && hasInvoice
            const lines = orderedLinesByGroup[row.groupLabel] ?? []
            const open = expanded.has(row.groupLabel)

            return (
              <div
                key={row.groupLabel}
                className={cn(
                  'flex flex-col rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md',
                  idx === 0 && hasInvoice
                    ? 'border-amber-300/90 bg-gradient-to-br from-amber-50 via-white to-white dark:border-amber-500/40 dark:from-amber-950/40 dark:via-elegant-gray-900 dark:to-elegant-gray-900'
                    : idx === 1 && hasInvoice
                      ? 'border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-transparent dark:border-amber-500/25 dark:from-amber-950/25'
                      : idx === 2 && hasInvoice
                        ? 'border-elegant-gray-200 bg-elegant-gray-50/60 dark:border-elegant-gray-700 dark:bg-elegant-black/30'
                        : 'border-elegant-gray-100 bg-white dark:border-elegant-gray-800 dark:bg-elegant-gray-900/80'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(row.groupLabel)}
                  className="-m-1 flex w-full cursor-pointer select-none items-start gap-2 rounded-xl p-1 text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-emerald-500/80 dark:ring-offset-elegant-gray-900"
                  aria-expanded={open}
                  aria-controls={`material-group-detail-${slugifyGroupKey(row.groupLabel)}`}
                >
                  <ChevronDown
                    className={cn(
                      'mt-1 h-4 w-4 shrink-0 text-elegant-gray-500 transition-transform duration-200 dark:text-elegant-gray-400',
                      open ? 'rotate-0' : '-rotate-90'
                    )}
                    aria-hidden
                  />
                  <h3 className="line-clamp-4 min-h-[3rem] min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-elegant-black dark:text-white">
                    {row.groupLabel}
                  </h3>
                  {showRank ? (
                    <span
                      className={cn(
                        'flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums',
                        idx === 0
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-elegant-gray-100 text-elegant-gray-600 dark:bg-elegant-gray-800 dark:text-elegant-gray-300'
                      )}
                      aria-label={`Sıra ${idx + 1}`}
                    >
                      #{idx + 1}
                    </span>
                  ) : null}
                </button>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-elegant-gray-100 bg-elegant-gray-50/90 px-3 py-2.5 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-elegant-gray-500">Talep kalemi</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-elegant-black dark:text-white">
                      {row.requestItemCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-elegant-gray-100 bg-elegant-gray-50/90 px-3 py-2.5 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-elegant-gray-500">Sipariş</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                      {row.orderCount}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-elegant-gray-100 pt-4 dark:border-elegant-gray-800">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                    <Receipt className="h-3 w-3" aria-hidden />
                    Faturalanan
                  </div>
                  <div className="mt-2 font-mono text-sm tabular-nums">
                    <MaterialGroupInvoicedWithGbpTotal invoiced={row.invoiced} fx={fx} />
                  </div>
                </div>

                {open ? (
                  <div
                    id={`material-group-detail-${slugifyGroupKey(row.groupLabel)}`}
                    className="mt-4 border-t border-elegant-gray-100 pt-3 dark:border-elegant-gray-800"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-elegant-gray-500 dark:text-elegant-gray-400">
                      Sipariş verilmiş kalemler
                    </p>
                    {lines.length === 0 ? (
                      <p className="mt-2 text-xs leading-relaxed text-elegant-gray-500 dark:text-elegant-gray-400">
                        {row.groupLabel === unlinkedLabel ? (
                          <>
                            Bu gruptaki faturalar, siparişte talep kalemi (
                            <code className="rounded bg-elegant-gray-100 px-0.5 text-[10px] dark:bg-black/40">
                              material_item_id
                            </code>
                            ) seçilmeyen satırlardan geliyor; kalem bazında liste çıkmıyor.
                          </>
                        ) : (
                          <>
                            Bu grupta henüz hangi kalemin siparişe bağlı olduğu (
                            <code className="rounded bg-elegant-gray-100 px-0.5 text-[10px] dark:bg-black/40">
                              material_item_id
                            </code>
                            ) eşleşmiyor.
                          </>
                        )}
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-[min(320px,50vh)] space-y-2.5 overflow-y-auto rounded-lg bg-elegant-gray-50/90 p-3 dark:bg-black/35">
                        {lines.map((line) => (
                          <li
                            key={line.id}
                            className="border-b border-elegant-gray-100 pb-2.5 text-sm last:border-b-0 last:pb-0 dark:border-elegant-gray-700"
                          >
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <span className="font-semibold text-elegant-black dark:text-white">{line.itemName}</span>
                              {line.quantityLabel != null ? (
                                <span className="inline-flex flex-wrap items-baseline gap-x-1 font-mono text-xs tabular-nums text-elegant-gray-600 dark:text-elegant-gray-400">
                                  <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-elegant-gray-500">
                                    İlk talep
                                  </span>
                                  <span>
                                    {line.quantityLabel}
                                    {line.unit ? ` ${line.unit}` : ''}
                                  </span>
                                </span>
                              ) : line.unit ? (
                                <span className="font-mono text-xs text-elegant-gray-600 dark:text-elegant-gray-400">
                                  {line.unit}
                                </span>
                              ) : null}
                              <span className="ml-auto shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                {line.orderCount} sipariş
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs leading-snug text-elegant-gray-600 dark:text-elegant-gray-400">
                              <span className="font-medium text-elegant-gray-700 dark:text-elegant-gray-300">
                                Kullanım amacı:
                              </span>{' '}
                              {line.purpose ?? (
                                <span className="italic text-elegant-gray-400 dark:text-elegant-gray-600">Belirtilmemiş</span>
                              )}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function slugifyGroupKey(label: string): string {
  if (!label.trim()) return 'empty'
  let h = 0
  for (let i = 0; i < label.length; i++) {
    h = (h << 5) - h + label.charCodeAt(i)
    h |= 0
  }
  return `g${Math.abs(h).toString(36)}`
}
