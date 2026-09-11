'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function formatTotals(rows: { currency: string; amount: number }[] | undefined) {
  if (!rows || rows.length === 0) return '—'
  return rows.map((r) => formatMoney(r.amount, r.currency)).join(' · ')
}

function formatDateRangeLabel(fromIso: string, toIso: string) {
  const from = new Date(fromIso).toLocaleDateString('tr-TR')
  const to = new Date(toIso).toLocaleDateString('tr-TR')
  return `${from} — ${to}`
}

export default function ReportsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [department, setDepartment] = useState<string>('all')
  const [periodMode, setPeriodMode] = useState<'month' | 'custom'>('month')
  const [month, setMonth] = useState(currentMonthValue())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DepartmentSpendingReport | null>(null)

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'admin') {
        setIsAdmin(false)
        router.push('/dashboard')
        return
      }
      setIsAdmin(true)
    }
    void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDepartments = useCallback(async () => {
    const res = await fetch('/api/reports/department-spending?meta=departments')
    if (!res.ok) return
    const data = await res.json()
    setDepartments(data.departments || [])
  }, [])

  useEffect(() => {
    if (isAdmin) void loadDepartments()
  }, [isAdmin, loadDepartments])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (department !== 'all') params.set('department', department)
    if (periodMode === 'month') {
      params.set('month', month)
    } else {
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
    }
    return params.toString()
  }, [department, periodMode, month, dateFrom, dateTo])

  const loadReport = useCallback(async () => {
    if (periodMode === 'custom' && (!dateFrom || !dateTo)) {
      setError('Özel tarih için başlangıç ve bitiş seçin')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/department-spending?${queryString}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rapor alınamadı')
      setReport(data as DepartmentSpendingReport)
    } catch (e: any) {
      setReport(null)
      setError(e?.message || 'Rapor alınamadı')
    } finally {
      setLoading(false)
    }
  }, [periodMode, dateFrom, dateTo, queryString])

  useEffect(() => {
    if (isAdmin) void loadReport()
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportPdf = async () => {
    if (!report) return
    setPdfBusy(true)
    try {
      const { printDepartmentSpendingPdf } = await import('@/lib/pdf/departmentSpendingPdf')
      const dateRangeLabel = formatDateRangeLabel(
        report.filters.dateFrom,
        report.filters.dateTo
      )
      const managers = report.departmentManagers || []
      const departmentManagerLabel =
        managers.length === 0
          ? '—'
          : managers
              .map((m) => {
                const name = m.fullName
                const mail = m.email ? ` · ${m.email}` : ''
                const deptNote =
                  !report.filters.department && m.department ? ` (${m.department})` : ''
                return `${name}${mail}${deptNote}`
              })
              .join('; ')

      const departmentLabel = formatDepartmentPdfLabel(report.summary.department)
      await printDepartmentSpendingPdf({
        docTitle: `Departman harcama — ${departmentLabel}`,
        titleMain: 'DEPARTMAN HARCAMA RAPORU',
        titleSub: 'Dovec Satın Alma — talep, malzeme kalemi ve fatura özeti',
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
      setError(e?.message || 'PDF oluşturulamadı')
    } finally {
      setPdfBusy(false)
    }
  }

  if (isAdmin === null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) return null

  const summary = report?.summary

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-elegant-black dark:text-white md:text-3xl">
            Departman harcama raporu
          </h1>
          <p className="mt-1 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
            Departman bazlı talep, malzeme kalemi ve fatura toplamları — admin görünümü
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
            Yenile
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={exportPdf}
            disabled={!report || pdfBusy || loading}
            className="bg-elegant-black text-white hover:bg-elegant-gray-800"
          >
            <FileDown className={cn('mr-2 h-4 w-4', pdfBusy && 'animate-pulse')} />
            {pdfBusy ? 'PDF hazırlanıyor…' : 'PDF indir'}
          </Button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-elegant-black dark:text-white">
              Filtreler
            </h3>
            <p className="mt-0.5 text-xs text-elegant-gray-500">
              Aylık veya özel tarih aralığı ile rapor alın
            </p>
          </div>
          <div className="flex shrink-0 rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 p-1 dark:border-elegant-gray-700 dark:bg-elegant-black/50">
            {(
              [
                ['month', 'Aylık'],
                ['custom', 'Özel tarih'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPeriodMode(mode)}
                className={cn(
                  'rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors',
                  periodMode === mode
                    ? 'bg-white text-elegant-black shadow-sm dark:bg-elegant-gray-800 dark:text-white'
                    : 'text-elegant-gray-500 hover:text-elegant-black dark:hover:text-white'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Departman
            </Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="rounded-lg border-elegant-gray-200">
                <SelectValue placeholder="Departman seçin" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Tüm departmanlar</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {periodMode === 'month' ? (
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Ay
              </Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border-elegant-gray-200"
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                  Başlangıç
                </Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border-elegant-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                  Bitiş
                </Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border-elegant-gray-200"
                />
              </div>
            </>
          )}

          <div className="flex items-end">
            <Button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="w-full rounded-lg bg-[#01E884] text-elegant-black hover:bg-[#00d476] font-semibold"
            >
              Raporu getir
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
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
              Tarih aralığı:{' '}
              <span className="text-elegant-gray-800 dark:text-elegant-gray-200">
                {formatDateRangeLabel(report.filters.dateFrom, report.filters.dateTo)}
              </span>
              {' · '}
              {summary.department}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Talep sayısı
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight text-elegant-black dark:text-white">
                {summary.requestCount.toLocaleString('tr-TR')}
              </p>
              <p className="mt-1 text-xs text-elegant-gray-500">Dönem içinde oluşturulan</p>
            </div>
            <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Malzeme kalemi
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight text-elegant-black dark:text-white">
                {summary.materialLineCount.toLocaleString('tr-TR')}
              </p>
              <p className="mt-1 text-xs text-elegant-gray-500">
                Toplam miktar: {summary.materialQuantitySum.toLocaleString('tr-TR')}
              </p>
            </div>
            <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Fatura adedi
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight text-elegant-black dark:text-white">
                {summary.invoiceCount.toLocaleString('tr-TR')}
              </p>
              <p className="mt-1 text-xs text-elegant-gray-500">Dönem faturaları</p>
            </div>
            <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Toplam tutar
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
                <p className="mt-1 text-xs text-elegant-gray-500">USD kuru alınamadı</p>
              )}
              <p className="mt-1 text-xs text-elegant-gray-500">
                {summary.fxDate
                  ? `Güncel kur · ${summary.fxDate}${summary.fxIncomplete ? ' (kısmi)' : ''}`
                  : 'Fatura grand_total / amount'}
              </p>
            </div>
          </div>

          {report?.insights && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
                <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                  Amaç dağılımı (top 3)
                </h3>
                {report.insights.purposeNotes.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
                    {report.insights.purposeNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 space-y-3">
                  {report.insights.topPurposes.length === 0 ? (
                    <p className="text-sm text-elegant-gray-500">Amaç verisi yok.</p>
                  ) : (
                    report.insights.topPurposes.map((p, i) => (
                      <div
                        key={p.purpose}
                        className="rounded-lg border border-elegant-gray-100 px-3 py-2.5 dark:border-elegant-gray-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-elegant-black dark:text-white">
                              <span className="text-[#01E884]">{i + 1}.</span> {p.purpose}
                              {p.sharePct != null && (
                                <span className="ml-2 text-xs font-medium text-elegant-gray-500">
                                  %{p.sharePct.toLocaleString('tr-TR')}
                                </span>
                              )}
                            </p>
                            {p.descriptions.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {p.descriptions.map((d) => (
                                  <p
                                    key={d}
                                    className="text-xs text-elegant-gray-500 break-words"
                                  >
                                    {d}
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
                  Büyük harcamalar (≥{' '}
                  {report.insights.largeSpendThresholdUsd.toLocaleString('tr-TR')} USD)
                </h3>
                <p className="mt-1 text-sm text-elegant-gray-500">
                  {report.insights.largeSpends.length} kalem
                </p>
                <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
                  {report.insights.largeSpends.length === 0 ? (
                    <p className="text-sm text-elegant-gray-500">Bu eşiği aşan kalem yok.</p>
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
                              {s.itemName}
                            </p>
                            {s.purpose && (
                              <p className="text-xs text-elegant-gray-500">Amaç: {s.purpose}</p>
                            )}
                            {s.description && (
                              <p className="mt-0.5 text-xs text-elegant-gray-500 break-words">
                                {s.description}
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

          {report && report.departmentBreakdown.length > 0 && department === 'all' && (
            <div className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
              <div className="border-b border-elegant-gray-100 px-5 py-4 dark:border-elegant-gray-800">
                <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                  Departman kırılımı
                </h3>
                <p className="mt-0.5 text-sm text-elegant-gray-500">Harcama büyüklüğüne göre</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-elegant-gray-100 bg-elegant-gray-50/80 text-[11px] font-bold uppercase tracking-wide text-elegant-gray-500 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
                      <th className="px-5 py-3">Departman</th>
                      <th className="px-5 py-3 text-right">Talep</th>
                      <th className="px-5 py-3 text-right">Kalem</th>
                      <th className="px-5 py-3 text-right">Miktar</th>
                      <th className="px-5 py-3 text-right">Fatura</th>
                      <th className="px-5 py-3 text-right">Harcama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                    {report.departmentBreakdown.map((row) => (
                      <tr
                        key={row.department}
                        className="hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-800/50"
                      >
                        <td className="px-5 py-3.5 font-medium text-elegant-black dark:text-white">
                          {row.department}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{row.requestCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {row.materialLineCount}
                        </td>
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
                  Malzeme kalemleri
                </h3>
                <p className="mt-0.5 text-sm text-elegant-gray-500">
                  {report?.lines.length || 0} satır
                </p>
              </div>
            </div>
            <div className="max-h-[560px] overflow-auto">
              {(report?.lines.length || 0) === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-elegant-gray-500">
                  Bu filtrelerde kayıt yok.
                </p>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-elegant-gray-900">
                    <tr className="border-b border-elegant-gray-100 text-[11px] font-bold uppercase tracking-wide text-elegant-gray-500 dark:border-elegant-gray-800">
                      <th className="px-5 py-3">Talep</th>
                      <th className="px-5 py-3">Departman</th>
                      <th className="px-5 py-3">Malzeme</th>
                      <th className="px-5 py-3 text-right">Miktar</th>
                      <th className="px-5 py-3 text-right">Fatura</th>
                      <th className="px-5 py-3 text-right">Tutar</th>
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
                            {line.siteName ? ` · ${line.siteName}` : ''}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">{line.department}</td>
                        <td className="px-5 py-3.5 max-w-[280px]">
                          <span className="font-medium text-elegant-black dark:text-white">
                            {line.itemName}
                          </span>
                          {line.itemDetails?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {line.itemDetails.map((d) => (
                                <p key={d} className="text-xs text-elegant-gray-500 break-words">
                                  {d}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {line.quantity.toLocaleString('tr-TR')}
                          {line.unit ? ` ${line.unit}` : ''}
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
                <p className="text-xs font-bold uppercase tracking-wide text-elegant-gray-500">
                  Toplam tutar
                </p>
                <p className="mt-0.5 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
                  {formatTotals(summary.totalsByCurrency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-elegant-gray-500">
                  Toplam USD
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
                  <p className="text-[11px] text-elegant-gray-500">Kur: {summary.fxDate}</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
