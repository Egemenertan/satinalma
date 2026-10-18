export type CurrencyAmount = {
  currency: string
  amount: number
}

export type SupplierScoreLabel = 'Mükemmel' | 'İyi' | 'Orta' | 'Riskli' | 'Yetersiz veri'

export type SupplierLiveMetrics = {
  supplierId: string
  orderCount: number
  requestCount: number
  invoiceCount: number
  invoiceTotals: CurrencyAmount[]
  thisMonthRequestCount: number
  monthlyRequestAvg: number
  onTimeCount: number
  lateCount: number
  incompleteCount: number
  problemCount: number
  scoredOrderCount: number
  onTimeRate: number | null
  score: number | null
  scoreLabel: SupplierScoreLabel
}

export const EMPTY_SUPPLIER_METRICS: Omit<SupplierLiveMetrics, 'supplierId'> = {
  orderCount: 0,
  requestCount: 0,
  invoiceCount: 0,
  invoiceTotals: [],
  thisMonthRequestCount: 0,
  monthlyRequestAvg: 0,
  onTimeCount: 0,
  lateCount: 0,
  incompleteCount: 0,
  problemCount: 0,
  scoredOrderCount: 0,
  onTimeRate: null,
  score: null,
  scoreLabel: 'Yetersiz veri',
}

export function emptySupplierMetrics(supplierId: string): SupplierLiveMetrics {
  return { supplierId, ...EMPTY_SUPPLIER_METRICS }
}

export function scoreLabelFromValue(score: number | null): SupplierScoreLabel {
  if (score == null) return 'Yetersiz veri'
  if (score >= 85) return 'Mükemmel'
  if (score >= 70) return 'İyi'
  if (score >= 50) return 'Orta'
  return 'Riskli'
}

export function computeSupplierScore(input: {
  onTimeCount: number
  lateCount: number
  incompleteCount: number
  problemCount: number
  scoredOrderCount: number
}): Pick<SupplierLiveMetrics, 'score' | 'scoreLabel' | 'onTimeRate'> {
  const scored = input.scoredOrderCount
  if (scored <= 0) {
    return { score: null, scoreLabel: 'Yetersiz veri', onTimeRate: null }
  }

  const onTimeRate = input.onTimeCount / scored
  const completeRate = Math.max(0, 1 - input.incompleteCount / scored)
  const cleanRate = Math.max(0, 1 - input.problemCount / scored)
  const score = Math.round(onTimeRate * 55 + completeRate * 30 + cleanRate * 15)

  return {
    score: Math.min(100, Math.max(0, score)),
    scoreLabel: scoreLabelFromValue(score),
    onTimeRate,
  }
}

export function formatInvoiceTotals(totals: CurrencyAmount[]): string {
  if (totals.length === 0) return '—'
  return totals
    .map((row) =>
      `${row.amount.toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} ${row.currency}`
    )
    .join(' · ')
}

export function primaryInvoiceAmount(totals: CurrencyAmount[]): number {
  const tryRow = totals.find((row) => row.currency === 'TRY')
  return (tryRow ?? totals[0])?.amount ?? 0
}

export function formatMonthlyAvg(value: number): string {
  if (value <= 0) return '—'
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}
