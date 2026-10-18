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
import { RefreshCw } from 'lucide-react'
import {
  formatDurationMinutes,
  type RolePerformanceReport,
  type RolePerformanceUser,
} from '@/lib/reports/rolePerformance'
import { titleCaseTr } from '@/lib/reports/titleCase'
import { ReportPeriodFilters, type PeriodMode } from './ReportPeriodFilters'
import { currentMonthValue, formatDateRangeLabel, formatDateTime, tc } from './reportFormat'

type RoleOption = { value: string; label: string; description: string }

export function RolePerformancePanel() {
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [role, setRole] = useState('purchasing_officer')
  const [userId, setUserId] = useState('all')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(currentMonthValue())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RolePerformanceReport | null>(null)
  const [directory, setDirectory] = useState<RolePerformanceUser[]>([])

  useEffect(() => {
    const loadRoles = async () => {
      const res = await fetch('/api/reports/role-performance?meta=roles')
      if (!res.ok) return
      const data = await res.json()
      setRoles(data.roles || [])
    }
    void loadRoles()
  }, [])

  const buildQuery = useCallback(
    (effectiveUserId: string) => {
      const params = new URLSearchParams()
      params.set('role', role)
      if (effectiveUserId !== 'all') params.set('userId', effectiveUserId)
      if (periodMode === 'month') {
        params.set('month', month)
      } else {
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
      }
      return params.toString()
    },
    [role, periodMode, month, dateFrom, dateTo]
  )

  const loadReport = useCallback(async (nextUserId = userId) => {
    if (periodMode === 'custom' && (!dateFrom || !dateTo)) {
      setError(titleCaseTr('Özel Tarih İçin Başlangıç Ve Bitiş Seçin'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/role-performance?${buildQuery(nextUserId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || titleCaseTr('Rapor Alınamadı'))
      const nextReport = data as RolePerformanceReport
      setReport(nextReport)
      if (nextUserId === 'all') {
        setDirectory(nextReport.users || [])
      } else if (!nextReport.users.some((u) => u.userId === nextUserId)) {
        setUserId('all')
        setDirectory(nextReport.users || [])
      }
    } catch (e: any) {
      setReport(null)
      setError(e?.message || titleCaseTr('Rapor Alınamadı'))
    } finally {
      setLoading(false)
    }
  }, [periodMode, dateFrom, dateTo, buildQuery, userId])

  useEffect(() => {
    setUserId('all')
    setDirectory([])
    void loadReport('all')
  }, [role]) // eslint-disable-line react-hooks/exhaustive-deps

  const users = report?.users || []
  const summary = report?.summary
  const maxBucket = Math.max(1, ...(report?.slaBuckets.map((b) => b.count) || [1]))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-elegant-black dark:text-white md:text-2xl">
            {titleCaseTr('Rol Performans Raporu')}
          </h2>
          <p className="mt-1 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
            {titleCaseTr(
              'Seçilen Roldeki Kullanıcıların İşlemleri, Bekleme Süreleri Ve Performans Özeti'
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadReport()}
          disabled={loading}
          className="border-elegant-gray-300 bg-white dark:bg-elegant-gray-900"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          {titleCaseTr('Yenile')}
        </Button>
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
        hint={titleCaseTr('Rol Ve Kullanıcı Seçerek Performans Raporu Alın')}
        extraFilters={
          <>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-elegant-gray-500">
                {titleCaseTr('Rol')}
              </Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  setRole(value)
                  setUserId('all')
                  setDirectory([])
                }}
              >
                <SelectTrigger className="rounded-lg border-elegant-gray-200">
                  <SelectValue placeholder={titleCaseTr('Rol Seçin')} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {roles.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {tc(item.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold text-elegant-gray-500">
                {titleCaseTr('Kullanıcı')}
              </Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="rounded-lg border-elegant-gray-200">
                  <SelectValue placeholder={titleCaseTr('Tüm Kullanıcılar')} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{titleCaseTr('Tüm Kullanıcılar')}</SelectItem>
                  {(directory.length > 0 ? directory : users).map((user) => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {tc(user.fullName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
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
      ) : summary && report ? (
        <>
          <div>
            <p className="text-xs font-medium text-elegant-gray-500">
              {titleCaseTr('Tarih Aralığı')}:{' '}
              <span className="text-elegant-gray-800 dark:text-elegant-gray-200">
                {formatDateRangeLabel(report.filters.dateFrom, report.filters.dateTo)}
              </span>
              {' · '}
              {tc(report.roleLabel)}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-elegant-black dark:text-white">
              {tc(report.metricTitle)}
            </h3>
            <p className="mt-1 text-sm text-elegant-gray-500">{tc(report.metricHint)}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={titleCaseTr('Kullanıcı')}
              value={summary.userCount.toLocaleString('tr-TR')}
              hint={titleCaseTr('Bu Roldeki Kayıtlı Kullanıcı')}
            />
            <StatCard
              label={titleCaseTr('Toplam İşlem')}
              value={summary.actionCount.toLocaleString('tr-TR')}
              hint={titleCaseTr('Onay, Sipariş, Sevkiyat Ve Talep')}
            />
            <StatCard
              label={titleCaseTr('Ortalama Süre')}
              value={formatDurationMinutes(summary.avgMinutes)}
              hint={`${titleCaseTr('Medyan')}: ${formatDurationMinutes(summary.medianMinutes)}`}
            />
            <StatCard
              label={titleCaseTr('Bekleyen')}
              value={summary.pendingCaseCount.toLocaleString('tr-TR')}
              hint={`${summary.completedCaseCount.toLocaleString('tr-TR')} ${titleCaseTr('Tamamlanan Vaka')}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MiniStat label={titleCaseTr('Sipariş')} value={summary.orderCount} />
            <MiniStat label={titleCaseTr('Onay')} value={summary.approvalCount} />
            <MiniStat label={titleCaseTr('Red')} value={summary.rejectionCount} />
            <MiniStat
              label={titleCaseTr('Talep / Sevkiyat')}
              value={summary.requestCreatedCount + summary.shipmentCount}
            />
          </div>

          <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
              {titleCaseTr('Süre Dağılımı')}
            </h3>
            <p className="mt-0.5 text-sm text-elegant-gray-500">
              {tc(report.metricTitle)}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.slaBuckets.map((bucket) => (
                <div key={bucket.key} className="rounded-lg border border-elegant-gray-100 px-3 py-3 dark:border-elegant-gray-800">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-elegant-black dark:text-white">
                      {tc(bucket.label)}
                    </span>
                    <span className="font-mono text-sm font-bold">{bucket.count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-elegant-gray-100 dark:bg-elegant-gray-800">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        bucket.key === 'pending' ? 'bg-amber-400' : 'bg-[#01E884]'
                      )}
                      style={{ width: `${Math.round((bucket.count / maxBucket) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <div className="border-b border-elegant-gray-100 px-5 py-4 dark:border-elegant-gray-800">
              <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                {titleCaseTr('Kullanıcı Performansı')}
              </h3>
              <p className="mt-0.5 text-sm text-elegant-gray-500">
                {titleCaseTr('Bu Roldeki Kullanıcıların Yaptığı İşlemlere Göre')}
              </p>
            </div>
            <div className="overflow-x-auto">
              {users.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-elegant-gray-500">
                  {titleCaseTr('Bu Rolde Kullanıcı Yok')}
                </p>
              ) : (
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-elegant-gray-100 bg-elegant-gray-50/80 text-[11px] font-semibold text-elegant-gray-500 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
                      <th className="px-5 py-3">{titleCaseTr('Kullanıcı')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Talep')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Onay')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Sipariş')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Fatura')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Sevkiyat')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Ortalama')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Bekleyen')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                    {users.map((user) => (
                      <tr
                        key={user.userId}
                        className="hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-800/50"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-elegant-black dark:text-white">
                            {tc(user.fullName)}
                          </p>
                          <p className="text-xs text-elegant-gray-500">
                            {user.email || '—'}
                            {user.department ? ` · ${tc(user.department)}` : ''}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.requestCreatedCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.approvalCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.orderCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.invoiceGroupCount}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.shipmentCount}</td>
                        <td className="px-5 py-3.5 text-right font-medium">
                          {formatDurationMinutes(user.avgMinutes)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{user.pendingCaseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
            <div className="border-b border-elegant-gray-100 px-5 py-4 dark:border-elegant-gray-800">
              <h3 className="text-lg font-semibold tracking-tight text-elegant-black dark:text-white">
                {titleCaseTr('Vaka Detayları')}
              </h3>
              <p className="mt-0.5 text-sm text-elegant-gray-500">
                {report.cases.length} {titleCaseTr('Satır')} · {tc(report.metricTitle)}
              </p>
            </div>
            <div className="max-h-[560px] overflow-auto">
              {report.cases.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-elegant-gray-500">
                  {titleCaseTr('Bu Filtrelerde Kayıt Yok')}
                </p>
              ) : (
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-elegant-gray-900">
                    <tr className="border-b border-elegant-gray-100 text-[11px] font-semibold text-elegant-gray-500 dark:border-elegant-gray-800">
                      <th className="px-5 py-3">{titleCaseTr('Talep')}</th>
                      <th className="px-5 py-3">{titleCaseTr('Kullanıcı')}</th>
                      <th className="px-5 py-3">{titleCaseTr('Başlangıç')}</th>
                      <th className="px-5 py-3">{titleCaseTr('İşlem')}</th>
                      <th className="px-5 py-3 text-right">{titleCaseTr('Süre')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elegant-gray-100 dark:divide-elegant-gray-800">
                    {report.cases.map((row) => (
                      <tr
                        key={`${row.requestId}-${row.actorId}-${row.actionAt || row.startAt}`}
                        className="hover:bg-elegant-gray-50/80 dark:hover:bg-elegant-gray-800/50"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-elegant-black dark:text-white">
                            {row.requestNumber}
                          </p>
                          <p className="text-xs text-elegant-gray-500">
                            {[row.siteName, row.department, row.status].filter(Boolean).map((v) => tc(v)).join(' · ')}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-elegant-black dark:text-white">{tc(row.actorName)}</p>
                          <p className="text-xs text-elegant-gray-500">{tc(row.metricLabel)}</p>
                        </td>
                        <td className="px-5 py-3.5 text-elegant-gray-600 dark:text-elegant-gray-400">
                          {formatDateTime(row.startAt)}
                        </td>
                        <td className="px-5 py-3.5 text-elegant-gray-600 dark:text-elegant-gray-400">
                          {formatDateTime(row.actionAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-elegant-black dark:text-white">
                          {row.minutes == null
                            ? titleCaseTr('Bekliyor')
                            : formatDurationMinutes(row.minutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
      <span className="text-sm font-semibold text-elegant-gray-500">{label}</span>
      <p className="mt-2 text-4xl font-bold tracking-tight text-elegant-black dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-elegant-gray-500">{hint}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-elegant-gray-200 bg-white px-4 py-3 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
      <p className="text-sm font-semibold text-elegant-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-elegant-black dark:text-white">{value.toLocaleString('tr-TR')}</p>
    </div>
  )
}
