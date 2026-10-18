import { titleCaseTr } from '@/lib/reports/titleCase'

export function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

export function formatTotals(rows: { currency: string; amount: number }[] | undefined) {
  if (!rows || rows.length === 0) return '—'
  return rows.map((r) => formatMoney(r.amount, r.currency)).join(' · ')
}

export function formatDateRangeLabel(fromIso: string, toIso: string) {
  const from = new Date(fromIso).toLocaleDateString('tr-TR')
  const to = new Date(toIso).toLocaleDateString('tr-TR')
  return `${from} — ${to}`
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR')
}

export function tc(value: string | null | undefined) {
  return titleCaseTr(value)
}
