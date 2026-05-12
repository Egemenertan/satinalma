import { NextResponse } from 'next/server'

/** ECB tabanlı kurlar; Frankfurter uç noktası (ücretsiz, anahtar yok). */
export const revalidate = 3600

export async function GET() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest', { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({ error: 'Upstream FX error', status: res.status }, { status: 502 })
    const data = (await res.json()) as { base?: string; date?: string; rates?: Record<string, number> }
    if (!data.rates || data.base !== 'EUR') return NextResponse.json({ error: 'Invalid FX payload' }, { status: 502 })
    return NextResponse.json({
      base: data.base,
      date: data.date,
      rates: data.rates,
    })
  } catch {
    return NextResponse.json({ error: 'FX fetch failed' }, { status: 500 })
  }
}
