'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { titleCaseTr } from '@/lib/reports/titleCase'

export type PeriodMode = 'month' | 'custom'

type ReportPeriodFiltersProps = {
  periodMode: PeriodMode
  onPeriodModeChange: (mode: PeriodMode) => void
  month: string
  onMonthChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  extraFilters?: ReactNode
  onSubmit: () => void
  loading?: boolean
  hint?: string
}

export function ReportPeriodFilters({
  periodMode,
  onPeriodModeChange,
  month,
  onMonthChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  extraFilters,
  onSubmit,
  loading,
  hint,
}: ReportPeriodFiltersProps) {
  return (
    <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm dark:border-elegant-gray-800 dark:bg-elegant-gray-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-elegant-black dark:text-white">
            {titleCaseTr('Filtreler')}
          </h3>
          <p className="mt-0.5 text-xs text-elegant-gray-500">
            {titleCaseTr(hint || 'Aylık Veya Özel Tarih Aralığı İle Rapor Alın')}
          </p>
        </div>
        <div className="flex shrink-0 rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 p-1 dark:border-elegant-gray-700 dark:bg-elegant-black/50">
          {(
            [
              ['month', 'Aylık'],
              ['custom', 'Özel Tarih'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onPeriodModeChange(mode)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                periodMode === mode
                  ? 'bg-navy text-white shadow-sm dark:bg-elegant-gray-800 dark:text-white'
                  : 'text-elegant-gray-500 hover:text-elegant-black dark:hover:text-white'
              )}
            >
              {titleCaseTr(label)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {extraFilters}

        {periodMode === 'month' ? (
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-elegant-gray-500">
              {titleCaseTr('Ay')}
            </Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="rounded-lg border-elegant-gray-200"
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-elegant-gray-500">
                {titleCaseTr('Başlangıç')}
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="rounded-lg border-elegant-gray-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-elegant-gray-500">
                {titleCaseTr('Bitiş')}
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="rounded-lg border-elegant-gray-200"
              />
            </div>
          </>
        )}

        <div className="flex items-end">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="w-full rounded-lg bg-[#01E884] text-elegant-black hover:bg-[#00d476] font-semibold"
          >
            {titleCaseTr('Raporu Getir')}
          </Button>
        </div>
      </div>
    </div>
  )
}
