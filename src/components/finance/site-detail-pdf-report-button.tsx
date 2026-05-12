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
import { formatCurrencyTotalsLine, type InvoiceTotalsDateRange } from '@/lib/site-invoice-aggregation'
import {
  generateSiteDetailSummaryPdf,
  type SiteDetailPdfMaterialRow,
  type SiteDetailPdfOrderRow,
  type SiteDetailPdfSupplierRow,
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
  supplierRows: SiteDetailPdfSupplierRow[]
  orderRows: SiteDetailPdfOrderRow[]
  materialGroupRowsBase: SiteMaterialGroupRow[]
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
      kpis: {
        totalRequests: t.total_requests,
        lineItems: props.lineItemCount,
        avgItemsPerRequestLabel: avgItems,
        inPipeline: t.inPipeline,
        legacyApproved: t.legacyApproved,
        requestTrendLabel: trend,
        ordersCount: t.orders_count,
        ordersAmountTry: formatCurrency(t.ordersAmount, 'TRY'),
      },
      finance: {
        invoicedLine: formatCurrencyTotalsLine(t.invoicedByCurrency, formatCurrency),
        attributedInvoiceRows: t.invoiceAttributedRows,
        chartCurrenciesLabel: props.financeChartCurrencyCodes || '—',
      },
      suppliers: props.supplierRows,
      materialGroups: materialRowsPdf,
      orders: props.orderRows,
    }
    return body
  }, [props, fx.view, fx.rateDate, materialRowsPdf])

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
