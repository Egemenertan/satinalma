/** Frankfurter/ECB: `rates[c]` = bir EUR kaç birim `c` (EUR tabanı için). */

export type EurCrossRates = Record<string, number>

function norm(c: string): string {
  return (c?.trim()?.toUpperCase() || 'TRY') as string
}

/** 1 EUR = rates[from] birim.from ve 1 EUR = rates[to] birim.to (rates EUR hariç tüm kodlar). */
export function convertAmountViaEurCross(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: EurCrossRates
): number | null {
  const from = norm(fromCurrency)
  const to = norm(toCurrency)
  if (!Number.isFinite(amount)) return null
  if (from === to) return amount
  if (Math.abs(amount) < 1e-15) return 0

  const rFrom = from === 'EUR' ? 1 : rates[from]
  const rTo = to === 'EUR' ? 1 : rates[to]
  if (!(typeof rFrom === 'number' && rFrom > 0 && Number.isFinite(rFrom))) return null
  if (!(typeof rTo === 'number' && rTo > 0 && Number.isFinite(rTo))) return null

  const inEur = from === 'EUR' ? amount : amount / rFrom
  const out = to === 'EUR' ? inEur : inEur * rTo
  return Number.isFinite(out) ? out : null
}

export function aggregateCurrencyTotalsViaEurCross(
  totals: Map<string, number>,
  targetCurrency: string,
  rates: EurCrossRates
): { value: number; incomplete: boolean } {
  const target = norm(targetCurrency)
  let sum = 0
  let incomplete = false
  for (const [code, amt] of totals.entries()) {
    if (Math.abs(amt ?? 0) < 1e-12) continue
    const cnv = convertAmountViaEurCross(Number(amt), code, target, rates)
    if (cnv === null) {
      incomplete = true
      continue
    }
    sum += cnv
  }
  return { value: sum, incomplete }
}
