'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  rejectedPurchasingItems,
  resendRejectedPurchaseRequest,
  type PurchasingRejectableItem,
} from '@/lib/purchasing-item-rejection'

type Props = {
  requestId: string
  requestedBy?: string | null
  currentUserId: string | null
  items: PurchasingRejectableItem[]
  onRefresh: () => Promise<void>
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function RejectedMaterialsBanner({
  requestId,
  requestedBy,
  currentUserId,
  items,
  onRefresh,
  showToast,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const rejected = rejectedPurchasingItems(items)
  const isOwner = Boolean(currentUserId && requestedBy && currentUserId === requestedBy)

  if (!isOwner || rejected.length === 0) return null

  const resend = async () => {
    if (!currentUserId || busy) return
    setBusy(true)
    try {
      const supabase = createClient()
      const result = await resendRejectedPurchaseRequest(supabase, {
        requestId,
        userId: currentUserId,
      })
      if (result.ok === false) {
        showToast(result.message, 'error')
        return
      }
      showToast('Talep satın almaya yeniden gönderildi.', 'success')
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#FCA5A5] bg-[#FECACA] px-5 py-5 sm:px-6">
      <p className="text-xl font-semibold tracking-tight text-[#7F1D1D] sm:text-3xl">
        Reddedilen malzemeler var
      </p>
      <p className="mt-2 text-sm text-[#7F1D1D] sm:text-base">
        Satın alma bazı kalemleri reddetti. Nedeni malzemenin yanında yazıyor. Düzenleyip yeniden gönderebilirsiniz.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="border-[#7F1D1D] bg-white text-[#7F1D1D] hover:bg-white"
          onClick={() => router.push(`/dashboard/requests/${requestId}/edit`)}
        >
          Düzenle
        </Button>
        <Button
          type="button"
          className="bg-[#7F1D1D] text-white hover:bg-[#991B1B]"
          disabled={busy}
          onClick={() => void resend()}
        >
          {busy ? 'Gönderiliyor...' : 'Yeniden Gönder'}
        </Button>
      </div>
    </div>
  )
}
