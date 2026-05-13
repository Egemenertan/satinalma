'use client'

import { useCallback, useMemo, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import { Button } from '@/components/ui/button'
import {
  sortSiteMaterialRowsByGbpDescending,
  type SiteMaterialGroupRow,
} from '@/components/finance/site-material-groups-breakdown'
import { useSiteFinanceFx } from '@/contexts/site-finance-fx'
import {
  currencyTotalsSortedEntries,
  formatCurrencyTotalsLine,
  sumAllCurrenciesTotals,
  type InvoiceTotalsDateRange,
  type CurrencyTotals,
} from '@/lib/site-invoice-aggregation'
import type { SiteFinanceChartPrintInput } from '@/lib/pdf/site-finance-chart-print'
import {
  generateSiteDetailSummaryPdf,
  type SiteDetailPdfMaterialRow,
  type SiteDetailPdfOrderRow,
  type SiteDetailPdfSupplierRow,
  type SiteDetailPdfTopSupplierRow,
} from '@/lib/pdf/site-detail-summary-pdf'

function invoiceFilterLabel(range: InvoiceTotalsDateRange): string {
  const { from, to } = range
  if (!from && !to) return 'Tüm zamanlar (faturalanan özet filtresiz)'
  if (from && to) {
    return `${format(from, 'dd MMM yyyy', { locale: tr })} – ${format(to, 'dd MMM yyyy', { locale: tr })}`
  }
  if (from) return `${format(from, 'dd MMM yyyy', { locale: tr })} ve sonrası`
  if (to) return `${format(to, 'dd MMM yyyy', { locale: tr })} ve öncesi`
  return '—'
}

function financeToolbarLabel(view: string, rateDate: string | null): string {
  const v = view === 'LIST' ? 'Orijinal (her döviz ayrı)' : `Tek görünüm (${view})`
  return rateDate ? `${v} · Kur tarihi ${rateDate}` : v
}

/** Tedarikçi sırası: GBP (kur varsa); yoksa TRY sonra toplamlar */
function compareSuppliersForReport(
  fx: ReturnType<typeof useSiteFinanceFx>,
  a: { invoicedByCurrency: CurrencyTotals },
  b: { invoicedByCurrency: CurrencyTotals }
): number {
  if (!fx.loading && fx.rates && !fx.error) {
    const gb = fx.aggregateTo(b.invoicedByCurrency, 'GBP').value
    const ga = fx.aggregateTo(a.invoicedByCurrency, 'GBP').value
    if (Math.abs(gb - ga) > 1e-6) return gb - ga
  }
  const bTry = b.invoicedByCurrency.get('TRY') ?? 0
  const aTry = a.invoicedByCurrency.get('TRY') ?? 0
  if (bTry !== aTry) return bTry - aTry
  return sumAllCurrenciesTotals(b.invoicedByCurrency) - sumAllCurrenciesTotals(a.invoicedByCurrency)
}

export type SupplierBreakdownForSitePdfRow = {
  name: string
  orderCount: number
  invoicedByCurrency: CurrencyTotals
}

export function SiteDetailPdfReportButton(props: {
  slug: string
  siteName: string
  invoiceTotalsDateRange: InvoiceTotalsDateRange
  chartRangeDays: number
  totals: {
    total_requests: number
    orders_count: number
    ordersAmount: number
    invoicedByCurrency: Map<string, number>
    invoiceAttributedRows: number
    inPipeline: number
    legacyApproved: number
    logisticsReqTrend: number | null
  }
  lineItemCount: number
  financeChartCurrencyCodes: string
  supplierBreakdownForPdf: SupplierBreakdownForSitePdfRow[]
  orderRows: SiteDetailPdfOrderRow[]
  materialGroupRowsBase: SiteMaterialGroupRow[]
  /** Günlük fatura/satır grafikleri — şantiye detayındaki `financeDailySeries` */
  financeDailySeriesForPdf: SiteFinanceChartPrintInput
}) {
  const fx = useSiteFinanceFx()
  const [busy, setBusy] = useState(false)

  const materialRowsPdf = useMemo((): SiteDetailPdfMaterialRow[] => {
    const sorted = sortSiteMaterialRowsByGbpDescending(props.materialGroupRowsBase, fx)
    return sorted.map((row) => {
      const invoicedLine = formatCurrencyTotalsLine(row.invoiced, formatCurrency)
      let gbpApproxLine: string | null = null
      if (!fx.loading && fx.rates && !fx.error) {
        const { value, incomplete } = fx.aggregateTo(row.invoiced, 'GBP')
        gbpApproxLine = `Toplam ≈ GBP: ${formatCurrency(value, 'GBP')}${incomplete ? ' (bazı dövizler hariç)' : ''}`
      }
      return {
        label: row.groupLabel,
        requestItems: row.requestItemCount,
        orders: row.orderCount,
        invoicedLine,
        gbpApproxLine,
      }
    })
  }, [props.materialGroupRowsBase, fx])

  const suppliersSortedForPdf = useMemo(() => {
    const rows = [...props.supplierBreakdownForPdf]
    rows.sort((a, b) => compareSuppliersForReport(fx, a, b))
    return rows
  }, [props.supplierBreakdownForPdf, fx])

  const suppliersTableRows = useMemo((): SiteDetailPdfSupplierRow[] => {
    return suppliersSortedForPdf.map((row) => ({
      name: row.name,
      orderCount: row.orderCount,
      invoicedLine: formatCurrencyTotalsLine(row.invoicedByCurrency, formatCurrency),
    }))
  }, [suppliersSortedForPdf])

  const topInvoicedSuppliers = useMemo((): SiteDetailPdfTopSupplierRow[] => {
    return suppliersSortedForPdf.slice(0, 3).map((row) => {
      let totalGbpLabel: string | null = null
      if (!fx.loading && fx.rates && !fx.error) {
        const { value, incomplete } = fx.aggregateTo(row.invoicedByCurrency, 'GBP')
        totalGbpLabel =
          `${formatCurrency(value, 'GBP')} (≈ toplam)` + (incomplete ? ' · bazı dövizler eksik kur' : '')
      }
      return {
        name: row.name,
        orderCount: row.orderCount,
        invoicedLine: formatCurrencyTotalsLine(row.invoicedByCurrency, formatCurrency),
        totalGbpLabel,
      }
    })
  }, [suppliersSortedForPdf, fx])

  const invoicedOpening = useMemo(() => {
    const currencyRows = currencyTotalsSortedEntries(props.totals.invoicedByCurrency).map(([code, val]) => ({
      code,
      amountLabel: formatCurrency(val, code),
    }))

    let totalGbpFormatted: string | null = null
    let totalGbpFootnote: string | null = null
    if (!fx.loading && fx.rates && !fx.error) {
      const agg = fx.aggregateTo(props.totals.invoicedByCurrency, 'GBP')
      totalGbpFormatted = formatCurrency(agg.value, 'GBP')
      if (agg.incomplete) {
        totalGbpFootnote =
          'Uyarı: Kur tablosunda olmayan para birimleri bu GBP toplamına dahil edilmemiştir (şantiye ekranındaki GBP yaklaşımı ile uyumlu).'
      }
    }

    return {
      currencyRows,
      totalGbpFormatted,
      totalGbpFootnote,
      attributedInvoiceRows: props.totals.invoiceAttributedRows,
      chartCurrenciesLabel: props.financeChartCurrencyCodes || '—',
    }
  }, [props.totals.invoicedByCurrency, props.totals.invoiceAttributedRows, props.financeChartCurrencyCodes, fx])

  const topSpendingMaterialGroups = useMemo(() => materialRowsPdf.slice(0, 3), [materialRowsPdf])

  const payload = useMemo(() => {
    const t = props.totals
    const avgItems =
      t.total_requests > 0 ? (props.lineItemCount / t.total_requests).toFixed(1) : '—'
    const trend =
      t.logisticsReqTrend === null ? '—' : `${t.logisticsReqTrend > 0 ? '+' : ''}${t.logisticsReqTrend}%`

    const body: Parameters<typeof generateSiteDetailSummaryPdf>[0] = {
      siteName: props.siteName,
      generatedAtLabel: format(new Date(), "dd/MM/yyyy HH:mm", { locale: tr }),
      invoiceFilterLabel: invoiceFilterLabel(props.invoiceTotalsDateRange),
      financeFxLabel: financeToolbarLabel(fx.view, fx.rateDate),
      chartRangeLabel: `Son ${props.chartRangeDays} gün`,
      invoicedOpening,
      topInvoicedSuppliers,
      topSpendingMaterialGroups,
      kpis: {
        totalRequests: t.total_requests,
        lineItems: props.lineItemCount,
        avgItemsPerRequestLabel: avgItems,
        inPipeline: t.inPipeline,
        legacyApproved: t.legacyApproved,
        requestTrendLabel: trend,
        ordersCount: t.orders_count,
      },
      suppliers: suppliersTableRows,
      materialGroups: materialRowsPdf,
      orders: props.orderRows,
      dailyFinanceChart:
        props.financeDailySeriesForPdf.labels.length > 0 ? props.financeDailySeriesForPdf : null,
    }
    return body
  }, [
    props.siteName,
    props.invoiceTotalsDateRange,
    props.chartRangeDays,
    props.lineItemCount,
    props.orderRows,
    props.financeDailySeriesForPdf,
    invoicedOpening,
    topInvoicedSuppliers,
    topSpendingMaterialGroups,
    suppliersTableRows,
    materialRowsPdf,
    fx.view,
    fx.rateDate,
    props.totals,
  ])

  const onDownload = useCallback(async () => {
    setBusy(true)
    try {
      await generateSiteDetailSummaryPdf(payload, props.slug)
    } catch (e) {
      console.error('PDF rapor:', e)
      window.alert('PDF oluşturulamadı. Konsolu kontrol edin veya daha sonra deneyin.')
    } finally {
      setBusy(false)
    }
  }, [payload, props.slug])

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => void onDownload()}
      className="border-elegant-gray-300 bg-white dark:border-elegant-gray-700 dark:bg-elegant-gray-900"
      aria-busy={busy}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="mr-2 h-4 w-4" aria-hidden />}
      PDF rapor
    </Button>
  )
}
