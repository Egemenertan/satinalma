'use client'

import Link from 'next/link'
import { FileStack, Trash2, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { QuoteComparisonStatus } from '@/types/quoteComparison'

interface ComparisonCardData {
  id: string
  title: string
  project_name: string | null
  material_name: string | null
  status: QuoteComparisonStatus
  created_at: string
  offerCount: number
  analysis_progress?: number
  analysis_step?: string | null
}

interface ComparisonCardProps {
  comparison: ComparisonCardData
  onDelete: (id: string) => void
  isDeleting?: boolean
}

const STATUS_CONFIG: Record<QuoteComparisonStatus, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: Clock },
  analyzing: { label: 'Analiz ediliyor', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Loader2 },
  completed: { label: 'Tamamlandı', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Hata', className: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
}

export function ComparisonCard({ comparison, onDelete, isDeleting }: ComparisonCardProps) {
  const status = STATUS_CONFIG[comparison.status] || STATUS_CONFIG.draft
  const StatusIcon = status.icon

  return (
    <div className="group relative rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-all">
      <Link href={`/dashboard/quote-comparison/${comparison.id}`} className="block">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <FileStack className="w-5 h-5 text-gray-600" />
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
          >
            <StatusIcon className={`w-3 h-3 ${comparison.status === 'analyzing' ? 'animate-spin' : ''}`} />
            {status.label}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 truncate mb-1 pr-6">{comparison.title}</h3>
        {comparison.project_name && (
          <p className="text-xs font-medium text-gray-600 truncate">{comparison.project_name}</p>
        )}
        {comparison.material_name && (
          <p className="text-xs text-gray-500 truncate mb-2">{comparison.material_name}</p>
        )}
        {comparison.status === 'analyzing' && (
          <div className="mt-2 mb-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] text-gray-500 truncate">
                {comparison.analysis_step || 'Analiz sürüyor'}
              </p>
              <span className="text-[11px] tabular-nums text-gray-600 font-medium">
                {Math.round(comparison.analysis_progress ?? 0)}%
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden bg-gray-100 rounded-full">
              <div
                className="h-full bg-neutral-950 rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(0, Math.min(100, comparison.analysis_progress ?? 0))}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
          <span>{comparison.offerCount} teklif</span>
          <div className="flex items-center gap-2">
            <span>{new Date(comparison.created_at).toLocaleDateString('tr-TR')}</span>
            <span className="w-7 h-7 flex-shrink-0" />
          </div>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        disabled={isDeleting}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDelete(comparison.id)
        }}
        className="absolute bottom-3.5 right-4 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
