'use client'

import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  formatActivityDateTime,
  mapApprovalHistoryToActivity,
  type RequestActivityItem,
  type RequestActivityRow,
} from '@/lib/request-activity'

type Props = {
  requestId: string
  /** refreshData sonrası yeniden çekmek için */
  refreshKey?: number | string
}

export default function RequestActivityTimeline({ requestId, refreshKey }: Props) {
  const [items, setItems] = useState<RequestActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data, error: fetchError } = await supabase
          .from('approval_history')
          .select(
            `
            id,
            action,
            comments,
            created_at,
            performed_by,
            profiles:performed_by (
              full_name,
              email,
              role
            )
          `
          )
          .eq('purchase_request_id', requestId)
          .order('created_at', { ascending: true })

        if (fetchError) throw fetchError
        if (cancelled) return

        const rows = (data || []) as unknown as RequestActivityRow[]
        setItems(mapApprovalHistoryToActivity(rows))
      } catch (e: unknown) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Geçmiş yüklenemedi'
        setError(message)
        setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [requestId, refreshKey])

  return (
    <div className="mb-3 sm:mb-8">
      <div className="bg-white border-0 shadow-sm rounded-3xl">
        <div className="p-3 sm:p-6 pb-2 sm:pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
            <h3 className="text-base sm:text-xl font-semibold text-gray-900">
              Talep Geçmişi
            </h3>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Oluşturma ve durum değişiklikleri — kim, ne zaman
          </p>
        </div>

        <div className="px-3 sm:px-6 pb-3 sm:pb-6">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Geçmiş yükleniyor…
            </div>
          ) : error ? (
            <p className="py-4 text-sm text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">
              Bu talep için henüz kayıtlı bir işlem geçmişi yok.
            </p>
          ) : (
            <ol className="relative space-y-0 border-l border-gray-200 ml-2 sm:ml-3">
              {items.map((item, index) => (
                <li key={item.id} className="relative pl-5 sm:pl-6 pb-5 last:pb-0">
                  <span
                    className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white ${
                      item.action === 'rejected'
                        ? 'bg-red-500'
                        : item.action === 'submitted'
                          ? 'bg-gray-400'
                          : index === items.length - 1
                            ? 'bg-[#00E676]'
                            : 'bg-emerald-400'
                    }`}
                  />
                  <div className="space-y-1">
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {item.actionLabel}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">{item.actorName}</span>
                      {item.actorRole ? (
                        <span className="text-gray-500"> · {item.actorRole}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] sm:text-xs font-semibold text-gray-800">
                      {formatActivityDateTime(item.createdAt)}
                    </p>
                    {item.comments ? (
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-2.5 sm:p-3 mt-1.5 break-words">
                        {item.comments}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
