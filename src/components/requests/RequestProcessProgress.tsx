'use client'

import useSWR from 'swr'
import { Check, CircleDot, Loader2, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchRequestProcess } from '@/services/request-process.service'
import type { RequestProcessModel, RequestProcessStep, ProcessStepStatus } from '@/lib/request-process'

function stepTone(status: ProcessStepStatus) {
  if (status === 'done') return 'done'
  if (status === 'current') return 'current'
  if (status === 'rejected') return 'rejected'
  if (status === 'skipped') return 'skipped'
  return 'upcoming'
}

function StepIcon({ status }: { status: ProcessStepStatus }) {
  if (status === 'done') return <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
  if (status === 'rejected') return <X className="h-3.5 w-3.5" strokeWidth={2.5} />
  if (status === 'skipped') return <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
  if (status === 'current') return <CircleDot className="h-3.5 w-3.5" strokeWidth={2.5} />
  return <span className="h-1.5 w-1.5 rounded-full bg-current" />
}

function StepNode({
  step,
  index,
  isLast,
}: {
  step: RequestProcessStep
  index: number
  isLast: boolean
}) {
  const tone = stepTone(step.status)
  return (
    <li className="relative flex min-w-[132px] flex-1 flex-col items-center text-center">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            'absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 h-0.5',
            tone === 'done' || step.status === 'skipped' ? 'bg-[#01E884]' : 'bg-elegant-gray-200 dark:bg-elegant-gray-700'
          )}
        />
      )}
      <div
        className={cn(
          'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold',
          tone === 'done' && 'border-[#01E884] bg-[#01E884] text-elegant-black',
          tone === 'current' && 'border-[#01E884] bg-white text-[#0A0A0A] shadow-[0_0_0_4px_rgba(1,232,132,0.18)]',
          tone === 'rejected' && 'border-red-500 bg-red-500 text-black',
          tone === 'skipped' && 'border-elegant-gray-300 bg-elegant-gray-100 text-elegant-gray-400 dark:border-elegant-gray-600 dark:bg-elegant-gray-800',
          tone === 'upcoming' && 'border-elegant-gray-300 bg-white text-elegant-gray-400 dark:border-elegant-gray-600 dark:bg-elegant-gray-900'
        )}
      >
        {tone === 'upcoming' ? index + 1 : <StepIcon status={step.status} />}
      </div>
      <p className="mt-2.5 text-[11px] font-semibold leading-tight text-elegant-black dark:text-white">
        {step.title}
      </p>
      <p className="mt-1 text-[11px] font-medium leading-tight text-elegant-gray-800 dark:text-elegant-gray-200">
        {step.assigneeName}
      </p>
      <p className="mt-0.5 text-[10px] text-elegant-gray-500">{step.roleLabel}</p>
      {step.status === 'current' && (
        <span className="mt-1.5 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#0A0A0A]">
          Şu anki adım
        </span>
      )}
    </li>
  )
}

export function RequestProcessProgress({
  process,
  compact = false,
}: {
  process: RequestProcessModel
  compact?: boolean
}) {
  const { steps, nextStep, followingStep, isComplete, isRejected, warehouseFulfilled } = process

  return (
    <div className={cn('rounded-2xl border border-elegant-gray-200 bg-white dark:border-elegant-gray-800 dark:bg-elegant-gray-900', compact ? 'p-4' : 'p-5')}>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-elegant-black dark:text-white">Talep süreci</h3>
          <p className="text-xs text-elegant-gray-500">
            Her adımın sorumlusu ve bir sonraki işlem
          </p>
        </div>
        {isComplete && (
          <span className="text-[11px] font-semibold text-[#0A0A0A]">Satın almaya ulaştı</span>
        )}
        {warehouseFulfilled && !isComplete && (
          <span className="text-[11px] font-semibold text-[#0A0A0A]">Depodan karşılandı</span>
        )}
        {isRejected && (
          <span className="text-[11px] font-semibold text-red-600">Süreç reddedildi</span>
        )}
      </div>

      <ol className="flex overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <StepNode key={step.id} step={step} index={index} isLast={index === steps.length - 1} />
        ))}
      </ol>

      {nextStep && !isRejected && !isComplete && (
        <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.04] px-3 py-2.5">
          <p className="text-[10px] font-bold text-[#0A0A0A]">Sonraki adım</p>
          <p className="mt-0.5 text-sm font-semibold text-elegant-black dark:text-white">{nextStep.title}</p>
          <p className="text-xs text-elegant-gray-600 dark:text-elegant-gray-300">
            Sorumlu: <span className="font-medium">{nextStep.assigneeName}</span>
            {nextStep.roleLabel ? ` · ${nextStep.roleLabel}` : ''}
          </p>
          {followingStep && (
            <p className="mt-1.5 text-xs text-elegant-gray-500">
              Ardından: {followingStep.title}
              {followingStep.assigneeName !== 'Satın alma ekibi' ? ` · ${followingStep.assigneeName}` : ''}
            </p>
          )}
        </div>
      )}

      {warehouseFulfilled && !isComplete && (
        <p className="mt-3 text-xs text-elegant-gray-600">
          Talep ana depodan karşılandı; satın almaya gönderilmedi.
        </p>
      )}
    </div>
  )
}

export function RequestProcessSection({
  requestId,
  refreshKey,
  compact = false,
}: {
  requestId: string
  refreshKey?: string | number
  compact?: boolean
}) {
  const { data, error, isLoading } = useSWR(
    requestId ? `request_process/${requestId}/${refreshKey ?? ''}` : null,
    () => fetchRequestProcess(requestId),
    { revalidateOnFocus: false }
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Süreç yükleniyor…
      </div>
    )
  }

  if (error || !data) return null

  return <RequestProcessProgress process={data} compact={compact} />
}
