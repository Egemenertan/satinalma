'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowRight, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { fetchRequestProcess } from '@/services/request-process.service'
import RequestActivityTimeline from '@/components/offers/RequestActivityTimeline'
import { RequestProcessProgress } from '@/components/requests/RequestProcessProgress'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'
import { cn } from '@/lib/utils'
import { SPECIAL_SITE_ID } from '@/lib/constants'

const BLOCKED_DETAIL_STATUSES = new Set(['depoda mevcut değil'])

function statusLabel(status: string | null | undefined, siteId?: string | null): string {
  const value = (status || '').toLowerCase()
  if (value === 'pending' && siteId === SPECIAL_SITE_ID) return 'Ana Depo Kontrolü'
  if (value === 'pending') return 'Beklemede'
  if (value === 'departman_onayı_bekliyor') return 'Departman onayı bekliyor'
  if (value === 'depoda mevcut değil') return 'Depoda mevcut değil'
  if (value === 'beklemede') return 'Ana depo kontrolü yapılıyor'
  if (value === 'gönderildi') return 'Ana depoda mevcut'
  if (value === 'ana depoda yok') return 'Ana depoda yok'
  if (value === 'satın almaya gönderildi') return 'Satın almaya gönderildi'
  if (value === 'it_incelemesinde') return 'IT incelemesinde'
  if (value === 'it_onaylandi') return 'IT onaylandı'
  if (value === 'onaylandı' || value === 'approved') return 'Onaylandı'
  if (value === 'reddedildi' || value === 'rejected') return 'Reddedildi'
  return status || '—'
}

export function RequestProcessModal({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      setUserRole(profile?.role ?? null)
    })
  }, [open])

  const { data, error, isLoading } = useSWR(
    open && requestId ? `request_process/${requestId}` : null,
    () => fetchRequestProcess(requestId as string),
    { revalidateOnFocus: false }
  )

  const canOpenDetail =
    Boolean(requestId && data) &&
    !(userRole === 'purchasing_officer' && BLOCKED_DETAIL_STATUSES.has((data?.request.status || '').toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-3xl dark:bg-elegant-gray-900">
        <DialogHeader>
          <DialogTitle className="pr-8 text-elegant-black dark:text-white">
            {data?.request.title || 'Talep süreci'}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-elegant-gray-600">
                {data?.request.request_number || 'Süreç yükleniyor'}
              </span>
              {data?.request.site_name && (
                <span className="text-elegant-gray-500">· {data.request.site_name}</span>
              )}
              {data?.request.status && (
                <Badge
                  variant="outline"
                  className={
                    (data.request.status || '').toLowerCase() === 'beklemede' ||
                    ((data.request.status || '').toLowerCase() === 'pending' &&
                      data.request.site_id === SPECIAL_SITE_ID)
                      ? 'border-[#EAB308] bg-[#FACC15] font-semibold text-[#422006]'
                      : 'border-elegant-gray-200 font-semibold'
                  }
                >
                  {statusLabel(data.request.status, data.request.site_id)}
                </Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-10 text-sm text-elegant-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Süreç yükleniyor…
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Süreç yüklenemedi. {error instanceof Error ? error.message : ''}
          </p>
        )}

        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-elegant-gray-50 px-3 py-2.5 dark:bg-elegant-gray-800/70">
                <p className="text-[10px] font-bold text-elegant-gray-500">Talep eden</p>
                <p className="mt-0.5 font-medium text-elegant-black dark:text-white">
                  {data.request.requester?.full_name || data.request.requester?.email || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-elegant-gray-50 px-3 py-2.5 dark:bg-elegant-gray-800/70">
                <p className="text-[10px] font-bold text-elegant-gray-500">Departman</p>
                <p className="mt-0.5 font-medium text-elegant-black dark:text-white">
                  {data.request.department || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-elegant-gray-50 px-3 py-2.5 dark:bg-elegant-gray-800/70">
                <p className="text-[10px] font-bold text-elegant-gray-500">Tutar</p>
                <p className="mt-0.5 font-mono font-medium text-elegant-black dark:text-white">
                  {formatCurrency(data.request.total_amount || 0, 'TRY')}
                </p>
              </div>
            </div>

            <RequestProcessProgress process={data} />

            {requestId && <RequestActivityTimeline requestId={requestId} />}

            <div className={cn('flex justify-end gap-2 pt-1')}>
              {canOpenDetail && (
                <Button asChild className="bg-[#01E884] text-elegant-black hover:bg-[#00c46a]">
                  <Link href={`/dashboard/requests/${requestId}/offers`}>
                    Talep detayına git
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
