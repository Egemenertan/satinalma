/**
 * Tedarikçi / taşeron listesi raporu — PDF ve Excel export'unun ortak verisi.
 * Sıralama: ortak para birimine çevrilmiş fatura toplamı, çoktan aza.
 * Tutarlar yalnızca sıralamada kullanılır; rapora yazılmaz.
 */

import { convertAmountViaEurCross, type EurCrossRates } from '@/lib/fx/convertViaEurRates'
import type { SupplierLiveMetrics } from '@/lib/supplier-performance'
import { fetchSupplierLiveMetricsMap } from '@/services/supplier-performance.service'

/** Farklı para birimlerindeki faturaları karşılaştırmak için ortak birim. */
export const SUPPLIER_REPORT_BASE_CURRENCY = 'TRY'

export type SupplierReportKind = 'supplier' | 'subcontractor'
export type SupplierReportFormat = 'pdf' | 'xlsx'

export interface SupplierReportParty {
  id: string
  name: string
  code: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  tax_number: string | null
}

export interface SupplierReportRow {
  rank: number
  name: string
  code: string
  contactPerson: string
  phone: string
  email: string
  address: string
  taxNumber: string
}

export interface SupplierReport {
  kindLabel: string
  title: string
  generatedAt: Date
  baseCurrency: string
  /** Çevrimde kullanılan kurun tarihi. Yabancı para yoksa null. */
  rateDate: string | null
  rows: SupplierReportRow[]
  partiesWithSpend: number
  /** Kuru bulunamayan para birimi sıralamaya katılamamıştır. */
  hasIncomplete: boolean
}

export interface SupplierReportLogo {
  dataUrl: string
  width: number
  height: number
}

function clean(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

/** Denemek için açılmış kayıtlar rapora girmez. Yalnızca tam ad eşleşir; "Testo Ltd." kalır. */
const EXCLUDED_PARTY_NAMES = new Set(['test', 'test2'])

function isExcludedParty(party: SupplierReportParty): boolean {
  return EXCLUDED_PARTY_NAMES.has((party.name || '').replace(/\s+/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i'))
}

export function buildSupplierReport(
  kind: SupplierReportKind,
  parties: SupplierReportParty[],
  metricsMap: Record<string, SupplierLiveMetrics>,
  rates: EurCrossRates | null,
  rateDate: string | null,
  generatedAt = new Date()
): SupplierReport {
  const measured = parties.filter((party) => !isExcludedParty(party)).map((party) => {
    const metrics = metricsMap[party.id]
    const invoiceTotals = metrics?.invoiceTotals ?? []
    let spendInBase = 0
    let incomplete = false
    for (const { currency, amount } of invoiceTotals) {
      const converted = rates
        ? convertAmountViaEurCross(amount, currency, SUPPLIER_REPORT_BASE_CURRENCY, rates)
        : currency.trim().toUpperCase() === SUPPLIER_REPORT_BASE_CURRENCY
          ? amount
          : null
      if (converted === null) incomplete = true
      else spendInBase += converted
    }
    return {
      party,
      hasSpend: invoiceTotals.length > 0,
      spendInBase,
      incomplete,
      orderCount: metrics?.orderCount ?? 0,
    }
  })

  measured.sort(
    (a, b) =>
      b.spendInBase - a.spendInBase ||
      b.orderCount - a.orderCount ||
      a.party.name.localeCompare(b.party.name, 'tr')
  )

  const kindLabel = kind === 'subcontractor' ? 'Taşeron' : 'Tedarikçi'

  return {
    kindLabel,
    title: `${kindLabel} Listesi`,
    generatedAt,
    baseCurrency: SUPPLIER_REPORT_BASE_CURRENCY,
    rateDate,
    rows: measured.map((row, index) => ({
      rank: index + 1,
      name: clean(row.party.name),
      code: clean(row.party.code),
      contactPerson: clean(row.party.contact_person),
      phone: clean(row.party.phone),
      email: clean(row.party.email),
      address: clean(row.party.address),
      taxNumber: clean(row.party.tax_number),
    })),
    partiesWithSpend: measured.filter((row) => row.hasSpend).length,
    hasIncomplete: measured.some((row) => row.incomplete),
  }
}

export function formatReportDateTime(date: Date): string {
  return date.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })
}

export function formatReportRateDate(rateDate: string): string {
  const date = new Date(`${rateDate}T00:00:00`)
  return Number.isNaN(date.getTime()) ? rateDate : date.toLocaleDateString('tr-TR')
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Görsel yüklenemedi: ${path}`))
    image.src = path
  })
}

/**
 * DÖVEC × DLX logosunu tek görselde birleştirir; PDF ve Excel aynı görseli kullanır.
 * Logo yüklenemezse rapor logosuz da çıkabilsin diye null döner.
 */
export async function buildSupplierReportLogo(): Promise<SupplierReportLogo | null> {
  try {
    const [dovec, dlx] = await Promise.all([loadImage('/d-black.png'), loadImage('/DLX.png')])
    const height = 160
    const dovecWidth = Math.round((dovec.naturalWidth / dovec.naturalHeight) * height)
    // DLX'in harfleri kalın ve eğik; aynı yükseklikte DÖVEC'ten iri görünür.
    const dlxHeight = Math.round(height * 0.78)
    const dlxWidth = Math.round((dlx.naturalWidth / dlx.naturalHeight) * dlxHeight)
    const gap = 64
    const crossSize = 44

    const canvas = document.createElement('canvas')
    canvas.width = dovecWidth + gap + crossSize + gap + dlxWidth
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(dovec, 0, 0, dovecWidth, height)
    context.drawImage(dlx, dovecWidth + gap + crossSize + gap, (height - dlxHeight) / 2, dlxWidth, dlxHeight)

    const crossLeft = dovecWidth + gap
    const crossTop = (height - crossSize) / 2
    context.strokeStyle = '#6b7280'
    context.lineWidth = 8
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(crossLeft, crossTop)
    context.lineTo(crossLeft + crossSize, crossTop + crossSize)
    context.moveTo(crossLeft + crossSize, crossTop)
    context.lineTo(crossLeft, crossTop + crossSize)
    context.stroke()

    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
  } catch (error) {
    console.error('Rapor logosu hazırlanamadı:', error)
    return null
  }
}

async function fetchRates(): Promise<{ rates: EurCrossRates; date: string | null }> {
  const response = await fetch('/api/fx/latest')
  const data = (await response.json().catch(() => null)) as { date?: string; rates?: EurCrossRates } | null
  if (!response.ok || !data?.rates) {
    throw new Error('Döviz kurları alınamadı, harcama sıralaması yapılamıyor. Lütfen tekrar deneyin.')
  }
  return { rates: data.rates, date: typeof data.date === 'string' ? data.date : null }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** Raporu canlı veriyle üretip dosya olarak indirir. Üreticiler yalnızca tıklanınca yüklenir. */
export async function exportSupplierList(
  format: SupplierReportFormat,
  kind: SupplierReportKind,
  parties: SupplierReportParty[]
): Promise<void> {
  const metricsMap = await fetchSupplierLiveMetricsMap()

  const needsRates = parties.some((party) =>
    (metricsMap[party.id]?.invoiceTotals ?? []).some(
      ({ currency }) => currency.trim().toUpperCase() !== SUPPLIER_REPORT_BASE_CURRENCY
    )
  )
  const fx = needsRates ? await fetchRates() : null

  const report = buildSupplierReport(kind, parties, metricsMap, fx?.rates ?? null, fx?.date ?? null)
  const logo = await buildSupplierReportLogo()

  const blob =
    format === 'pdf'
      ? await (await import('@/lib/pdf/supplierListPdf')).buildSupplierListPdf(report, logo)
      : await (await import('@/lib/xlsx/supplierListXlsx')).buildSupplierListXlsx(report, logo)

  const day = report.generatedAt.toLocaleDateString('sv-SE')
  const prefix = kind === 'subcontractor' ? 'taseron-listesi' : 'tedarikci-listesi'
  triggerDownload(blob, `${prefix}-${day}.${format}`)
}
