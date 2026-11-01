'use client'

import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/app/dashboard/orders/utils/numberFormatting'

type State =
  | { status: 'loading' }
  | { status: 'ok'; total: number; currency: string; invoiceCount: number }
  | { status: 'not_configured' }
  | { status: 'error' }

export function LinasoftPurchaseInvoiceCard({ siteId }: { siteId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/linasoft/purchase-invoice-total?siteId=${encodeURIComponent(siteId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (data?.status === 'ok') setState(data)
        else if (data?.status === 'not_configured') setState({ status: 'not_configured' })
        else setState({ status: 'error' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [siteId])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Receipt className="h-4 w-4" />
          Muhasebe (Linasoft) — Alış Faturaları Toplamı
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === 'loading' && <Skeleton className="h-8 w-48" />}
        {state.status === 'ok' && (
          <>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(state.total, state.currency)}</p>
            <p className="mt-1 text-xs text-elegant-gray-500">{state.invoiceCount} fatura</p>
          </>
        )}
        {state.status === 'not_configured' && (
          <p className="text-sm text-elegant-gray-500">Linasoft entegrasyonu henüz yapılandırılmadı.</p>
        )}
        {state.status === 'error' && (
          <p className="text-sm text-amber-800 dark:text-amber-300">Linasoft verisi alınamadı.</p>
        )}
      </CardContent>
    </Card>
  )
}
