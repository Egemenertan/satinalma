'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { FileDown, RefreshCw } from 'lucide-react'
import {
  formatDepartmentPdfLabel,
  type DepartmentSpendingReport,
} from '@/lib/reports/departmentSpending'
import { titleCaseTr } from '@/lib/reports/titleCase'
import { ReportPeriodFilters, type PeriodMode } from './ReportPeriodFilters'
import {
  currentMonthValue,
  formatDateRangeLabel,
  formatTotals,
  tc,
} from './reportFormat'

type SpendingDimension = 'department' | 'site'

type SiteOption = { id: string; name: string }

export function SpendingReportPanel({ dimension }: { dimension: SpendingDimension }) {
  const isSite = dimension === 'site'
  const [departments, setDepartments] = useState<string[]>([])
  const [sites, setSites] = useState<SiteOption[]>([])
  const [department, setDepartment] = useState('all')
  const [site, setSite] = useState('all')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(currentMonthValue())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DepartmentSpendingReport | null>(null)

  const loadMeta = useCallback(async () => {
    if (isSite) {
      const res = await fetch('/api/reports/department-spending?meta=sites')
      if (!res.ok) return
      const data = await res.json()
      setSites(data.sites || [])
      return
    }
    const res = await fetch('/api/reports/department-spending?meta=departments')
    if (!res.ok) return
    const data = await res.json()
    setDepartments(data.departments || [])
  }, [isSite])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('dimension', dimension)
    if (!isSite && department !== 'all') params.set('department', department)
    if (isSite && site !== 'all') params.set('site', site)
    if (periodMode === 'month') {
      params.set('month', month)
    } else {
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
    }
    return params.toString()
  }, [isSite, department, site, periodMode, month, dateFrom, dateTo])

  const loadReport = useCallback(async () => {
    if (periodMode === 'custom' && (!dateFrom || !dateTo)) {
      setError(titleCaseTr('Özel Tarih İçin Başlangıç Ve Bitiş Seçin'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/department-spending?${queryString}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || titleCaseTr('Rapor Alınamadı'))
      setReport(data as DepartmentSpendingReport)
    } catch (e: any) {
      setReport(null)
      setError(e?.message || titleCaseTr('Rapor Alınamadı'))
    } finally {
      setLoading(false)
    }
  }, [periodMode, dateFrom, dateTo, queryString])

  useEffect(() => {
    void loadReport()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const exportPdf = async () => {
    if (!report) return
    setPdfBusy(true)
    try {
      const { printDepartmentSpendingPdf } = await import('@/lib/pdf/departmentSpendingPdf')
      const dateRangeLabel = formatDateRangeLabel(report.filters.dateFrom, report.filters.dateTo)
      const managers = report.departmentManagers || []
      const departmentManagerLabel =
        managers.length === 0
          ? '—'
          : managers
              .map((m) => {
                const name = tc(m.fullName)
                const mail = m.email ? ` · ${m.email}` : ''
                const deptNote =
                  !report.filters.department && m.department ? ` (${tc(m.department)})` : ''
                return `${name}${mail}${deptNote}`
              })
              .join('; ')

      const departmentLabel = isSite
        ? tc(report.summary.department)
        : formatDepartmentPdfLabel(report.summary.department)

      await printDepartmentSpendingPdf({
        docTitle: isSite
          ? `${titleCaseTr('Şantiye Harcama')} — ${departmentLabel}`
          : `${titleCaseTr('Departman Harcama')} — ${departmentLabel}`,
        titleMain: isSite
          ? titleCaseTr('Şantiye Harcama Raporu').toLocaleUpperCase('tr-TR')
          : 'DEPARTMAN HARCAMA RAPORU',
        titleSub: titleCaseTr('Dovec Satın Alma — Talep, Malzeme Kalemi Ve Fatura Özeti'),
        departmentLabel,
        departmentManagerLabel,
        dateRangeLabel,
        generatedAtLabel: new Date().toLocaleString('tr-TR'),
        requestCount: report.summary.requestCount,
        materialLineCount: report.summary.materialLineCount,
        materialQuantitySum: report.summary.materialQuantitySum,
        invoiceCount: report.summary.invoiceCount,
        totalsByCurrency: report.summary.totalsByCurrency,
        totalUsd: report.summary.totalUsd ?? null,
        fxDate: report.summary.fxDate ?? null,
        fxIncomplete: report.summary.fxIncomplete,
        insights: report.insights || {
          topPurposes: [],
          purposeNotes: [],
          largeSpends: [],
          largeSpendThresholdUsd: 1000,
        },
        lines: report.lines,
      })
    } catch (e: any) {
      setError(e?.message || titleCaseTr('PDF Oluşturulamadı'))
    } finally {
      setPdfBusy(false)
    }
  }

  const summary = report?.summary
  const breakdown = isSite ? report?.siteBreakdown || [] : report?.departmentBreakdown || []
  const showBreakdown = breakdown.length > 0 && (isSite ? site === 'all' : department === 'all')

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-elegant-black dark:text-white md:text-2xl">
            {titleCaseTr(isSite ? 'Şantiye Harcama Raporu' : 'Departman Harcama Raporu')}
          </h2>
          <p className="mt-1 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
            {titleCaseTr(
              isSite
                ? 'Şantiye Bazlı Talep, Malzeme Kalemi Ve Fatura Toplamları'
                : 'Departman Bazlı Talep, Malzeme Kalemi Ve Fatura Toplamları'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadReport}
            disabled={loading}
            className="border-elegant-gray-300 bg-white dark:bg-elegant-gray-900"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            {titleCaseTr('Yenile')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={exportPdf}
            disabled={!report || pdfBusy || loading}
            className="bg-bordeaux text-white hover:bg-bordeaux-700"
          >
            <FileDown className={cn('mr-2 h-4 w-4', pdfBusy && 'animate-pulse')} />
            {pdfBusy ? titleCaseTr('PDF Hazırlanıyor') : titleCaseTr('PDF İndir')}
          </Button>
        </div>
      </div>

      <ReportPeriodFilters
        periodMode={periodMode}
        onPeriodModeChange={setPeriodMode}
        month={month}
        onMonthChange={setMonth}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onSubmit={loadReport}
        loading={loading}
        extraFilters={
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold text-elegant-gray-500">
              {titleCaseTr(isSite ? 'Şantiye' : 'Departman')}
            </Label>
            {isSite ? (
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger className="rounded-lg border-elegant-gray-200">
                  <SelectValue placeholder={titleCaseTr('Şantiye Seçin')} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{titleCaseTr('Tüm Şantiyeler')}</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {tc(s.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="rounded-lg border-elegant-gray-200">
                  <SelectValue placeholder={titleCaseTr('Departman Seçin')} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{titleCaseTr('Tüm Departmanlar')}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {tc(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {tc(error)}
        </div>
      )}

      {loading && !report ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <>
          {report?.filters && (
            <p className="text-xs font-medium text-elegant-gray-500">
              {titleCaseTr('Tarih Aralığı')}:{' '}
              <span className="text-elegant-gray-800 dark:text-elegant-gray-200">
                {formatDateRangeLabel(report.filters.dateFrom, report.filters.dateTo)}
              </span>
              {' · '}
              {tc(summary.department)}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={titleCaseTr('Talep Sayısı')}
              value={summary.requestCount.toLocaleString('tr-TR')}
              hint={titleCaseTr('Dönem İçinde Oluşturulan')}
            />
            <SummaryCard
              label={titleCaseTr('Malzeme Kalemi')}
              value={summary.materialLineCount.toLocaleString('tr-TR')}
              hint={`${titleCaseTr('Toplam Miktar')}: ${summary.materialQuantitySum.toLocaleString('tr-TR')}`}
            />
            <SummaryCard
              label={titleCaseTr('Fatura Adedi')}
              value={summary.invoiceCount.toLocaleString('tr-TR')}
              hint={titleCaseTr('Dönem Faturaları')}
            />
            <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
              <span className="text-[11px] font-semibold text-elegant-gray-500">
                {titleCaseTr('Toplam Tutar')}
              </span>
              <p className="mt-2 font-mono text-base font-bold tracking-tight text-elegant-black dark:text-white leading-snug">
                {formatTotals(summary.totalsByCurrency)}
              </p>
              {summary.totalUsd != null ? (
                <p className="mt-2 font-mono text-xl font-bold text-[#01E884]">
                  ≈{' '}
                  {summary.totalUsd.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  USD
                </p>
              ) : (
                <p className="mt-1 text-xs text-elegant-gray-500">{titleCaseTr('USD Kuru Alınamadı')}</p>
              )}
              <p className="mt-1 text-xs text-elegant-gray-500">
                {summary.fxDate
                  ? `${titleCaseTr('Güncel Kur')} · ${summary.fxDate}${summary.fxIncomplete ? ` (${titleCaseTr('Kısmi')})` : ''}`
                  : titleCaseTr('Fatura Grand Total / Amount')}
              </p>
            </div>
          </div>

          {report?.insights && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
                <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                  {titleCaseTr('Amaç Dağılımı (Top 3)')}
                </h3>
                {report.insights.purposeNotes.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
                    {report.insights.purposeNotes.map((n) => (
                      <li key={n}>{tc(n)}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 space-y-3">
                  {report.insights.topPurposes.length === 0 ? (
                    <p className="text-sm text-elegant-gray-500">{titleCaseTr('Amaç Verisi Yok')}</p>
                  ) : (
                    report.insights.topPurposes.map((p, i) => (
                      <div
                        key={p.purpose}
                        className="rounded-lg border border-elegant-gray-100 px-3 py-2.5 dark:border-elegant-gray-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-elegant-black dark:text-white">
                              <span className="text-[#01E884]">{i + 1}.</span> {tc(p.purpose)}
                              {p.sharePct != null && (
                                <span className="ml-2 text-xs font-medium text-elegant-gray-500">
                                  %{p.sharePct.toLocaleString('tr-TR')}
                                </span>
                              )}
                            </p>
                            {p.descriptions.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {p.descriptions.map((d) => (
                                  <p key={d} className="text-xs text-elegant-gray-500 break-words">
                                    {tc(d)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-bold text-elegant-black dark:text-white">
                              {p.totalUsd != null
                                ? `${p.totalUsd.toLocaleString('tr-TR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} USD`
                                : '—'}
                            </p>
                            <p className="text-xs text-elegant-gray-500">
                              {formatTotals(p.totalsByCurrency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                  {titleCaseTr('Büyük Harcamalar')} (≥{' '}
                  {report.insights.largeSpendThresholdUsd.toLocaleString('tr-TR')} USD)
                </h3>
                <p className="mt-1 text-sm text-elegant-gray-500">
                  {report.insights.largeSpends.length} {titleCaseTr('Kalem')}
                </p>
                <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
                  {report.insights.largeSpends.length === 0 ? (
                    <p className="text-sm text-elegant-gray-500">
                      {titleCaseTr('Bu Eşiği Aşan Kalem Yok')}
                    </p>
                  ) : (
                    report.insights.largeSpends.map((s) => (
                      <div
                        key={`${s.requestNumber}-${s.itemName}-${s.totalUsd}`}
                        className="rounded-lg border border-amber-100 bg-white/80 px-3 py-2.5 dark:border-amber-900/40 dark:bg-elegant-gray-900/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-elegant-gray-500">{s.requestNumber}</p>
                            <p className="font-medium text-elegant-black dark:text-white">
                              {tc(s.itemName)}
                            </p>
                            {s.purpose && (
                              <p className="text-xs text-elegant-gray-500">
                                {titleCaseTr('Amaç')}: {tc(s.purpose)}
                              </p>
                            )}
                            {s.description && (
                              <p className="mt-0.5 text-xs text-elegant-gray-500 break-words">
                                {tc(s.description)}
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 font-mono text-sm font-bold text-elegant-black dark:text-white">
                            {s.totalUsd.toLocaleString('tr-TR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            USD
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {showBreakdown && (
            <div className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
              <div className="border-b border-elegant-gray-100 px-5 py-4 dark:border-elegant-gray-800">
                <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                  {titleCaseTr(isSite ? 'Şantiye Kırılımı' : 'Departman Kırılımı')}
                </h3>
                <p className="mt-0.5 text-sm text-elegant-gray-500">
                  {titleCaseTr('Harcama Büyüklüğüne Göre')}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-elegant-gray-100 bg-elegant-gray-50/80 text-[11px] font-semibold text-elegant-gray-500 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
                      <th className="px-5 py-3">{titleCaseTr(isSite ? 'Şantiye' : 'Departman')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Talep')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Kalem')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Miktar')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Fatura')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Harcama')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                    {breakdown.map((row) => (
                      <tr
                        key={row.department}
                        className="hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-800/50"
                      >
                        <td className="px-5 py-3.5 font-medium text-elegant-black dark:text-white">
                          {tc(row.department)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{row.requestCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{row.materialLineCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {row.materialQuantitySum.toLocaleString('tr-TR')}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{row.invoiceCount}</td>
                        <td className="px-5 py-3.5 text-right font-medium">
                          <div>{formatTotals(row.totalsByCurrency)}</div>
                          {row.totalUsd != null && (
                            <div className="mt-0.5 text-xs font-mono text-elegant-gray-500">
                              ≈{' '}
                              {row.totalUsd.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              USD
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <div className="flex flex-col gap-1 border-b border-elegant-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-elegant-gray-800">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                  {titleCaseTr('Malzeme Kalemleri')}
                </h3>
                <p className="mt-0.5 text-sm text-elegant-gray-500">
                  {report?.lines.length || 0} {titleCaseTr('Satır')}
                </p>
              </div>
            </div>
            <div className="max-h-[560px] overflow-auto">
              {(report?.lines.length || 0) === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-elegant-gray-500">
                  {titleCaseTr('Bu Filtrelerde Kayıt Yok')}
                </p>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-elegant-gray-900">
                    <tr className="border-b border-elegant-gray-100 text-[11px] font-semibold text-elegant-gray-500 dark:border-elegant-gray-800">
                      <th className="px-5 py-3">{titleCaseTr('Talep')}</th>
                      <th className="px-5 py-3">{titleCaseTr(isSite ? 'Şantiye' : 'Departman')}</th>
                      <th className="px-5 py-3">{titleCaseTr('Malzeme')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Miktar')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Fatura')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Tutar')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                    {report!.lines.map((line) => (
                      <tr
                        key={line.itemId}
                        className="hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-800/50"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-elegant-black dark:text-white">
                            {line.requestNumber}
                          </p>
                          <p className="text-xs text-elegant-gray-500">
                            {line.requestCreatedAt
                              ? new Date(line.requestCreatedAt).toLocaleDateString('tr-TR')
                              : '—'}
                            {line.siteName ? ` · ${tc(line.siteName)}` : ''}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          {tc(isSite ? line.siteName || line.department : line.department)}
                        </td>
                        <td className="px-5 py-3.5 max-w-[280px]">
                          <span className="font-medium text-elegant-black dark:text-white">
                            {tc(line.itemName)}
                          </span>
                          {line.itemDetails?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {line.itemDetails.map((d) => (
                                <p key={d} className="text-xs text-elegant-gray-500 break-words">
                                  {tc(d)}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {line.quantity.toLocaleString('tr-TR')}
                          {line.unit ? ` ${tc(line.unit)}` : ''}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{line.invoiceCount}</td>
                        <td className="px-5 py-3.5 text-right font-medium">
                          {formatTotals(line.invoiceTotalsByCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-elegant-gray-200 bg-elegant-gray-50 px-5 py-4 dark:border-elegant-gray-800 dark:bg-elegant-black/40 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-elegant-gray-500">
                  {titleCaseTr('Toplam Tutar')}
                </p>
                <p className="mt-0.5 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
                  {formatTotals(summary.totalsByCurrency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-elegant-gray-500">
                  {titleCaseTr('Toplam USD')}
                </p>
                <p className="font-mono text-lg font-bold text-elegant-black dark:text-white">
                  {summary.totalUsd != null
                    ? `${summary.totalUsd.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} USD`
                    : '—'}
                </p>
                {summary.fxDate && (
                  <p className="text-[11px] text-elegant-gray-500">
                    {titleCaseTr('Kur')}: {summary.fxDate}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
      <span className="text-sm font-semibold text-elegant-gray-500">{label}</span>
      <p className="mt-2 text-4xl font-bold tracking-tight text-elegant-black dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-elegant-gray-500">{hint}</p>
    </div>
  )
}
