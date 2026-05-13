'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Package, Edit, X, Send } from 'lucide-react'
import { OffersPageProps, PurchaseRequestItem } from './types'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import SitePersonnelView from './SitePersonnelView'
import { useRouter } from 'next/navigation'
import {
  IT_STATUS_INCELEMEDE,
  IT_STATUS_ONAYLANDI,
  isPazarlamaDepartment
} from '@/lib/it-workflow'

interface ItWorkflowViewProps
  extends Pick<
    OffersPageProps,
    | 'request'
    | 'materialSuppliers'
    | 'materialOrders'
    | 'shipmentData'
    | 'onRefresh'
    | 'showToast'
  > {
  currentOrder: unknown
  userRole: string
  userDepartment: string | null
}

export default function ItWorkflowView({
  request,
  onRefresh,
  showToast,
  userRole,
  userDepartment,
  ...props
}: ItWorkflowViewProps) {
  const router = useRouter()
  const supabase = createClient()
  const [stage1Busy, setStage1Busy] = useState(false)
  const [stage2Busy, setStage2Busy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sendQuantities, setSendQuantities] = useState<Record<string, string>>({})

  const isDeptHeadPazarlama =
    userRole === 'department_head' && isPazarlamaDepartment(userDepartment)
  const isSiteMgrPazarlama =
    userRole === 'site_manager' && isPazarlamaDepartment(userDepartment)
  const isElevated = userRole === 'admin' || userRole === 'manager'

  const canStage1 = isDeptHeadPazarlama || isElevated
  const canStage2 = isSiteMgrPazarlama || isElevated

  const handleEdit = () => {
    router.push(`/dashboard/requests/${request.id}/edit`)
  }

  const openSendDialog = () => {
    if (!isDeptHeadPazarlama || request.status !== IT_STATUS_INCELEMEDE) return
    const init: Record<string, string> = {}
    for (const it of request.purchase_request_items ?? []) {
      init[it.id] = it.quantity > 0 ? String(it.quantity) : '0'
    }
    setSendQuantities(init)
    setSendDialogOpen(true)
  }

  /** Pazarlama department_head: gönderim miktarları + shipment kaydı, ardından "gönderildi". */
  const confirmSendGonderildi = async () => {
    if (!isDeptHeadPazarlama || request.status !== IT_STATUS_INCELEMEDE) return

    const items: PurchaseRequestItem[] = request.purchase_request_items ?? []
    const toShip: { item: PurchaseRequestItem; qty: number }[] = []

    for (const item of items) {
      const raw = sendQuantities[item.id] ?? '0'
      const qty = Math.floor(Number(String(raw).replace(',', '.')))
      if (Number.isNaN(qty) || qty < 0) {
        showToast('Geçersiz adet girişi', 'error')
        return
      }
      if (qty > item.quantity) {
        showToast(
          `${item.item_name} için en fazla ${item.quantity} ${item.unit} girebilirsiniz`,
          'error'
        )
        return
      }
      if (item.quantity <= 0 && qty > 0) {
        showToast(`${item.item_name} için kalan miktar yok`, 'error')
        return
      }
      if (qty > 0) toShip.push({ item, qty })
    }

    if (toShip.length === 0) {
      showToast('En az bir kalem için gönderim adedi girin', 'error')
      return
    }

    setStage1Busy(true)
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Oturum bulunamadı')

      const summaryParts: string[] = []

      for (const { item, qty } of toShip) {
        const newQuantity = Math.max(0, item.quantity - qty)

        const { error: rpcError } = await supabase.rpc('update_purchase_request_item_quantity', {
          item_id: item.id,
          new_quantity: newQuantity
        })

        if (rpcError) {
          const { error: updateError } = await supabase
            .from('purchase_request_items')
            .update({ quantity: newQuantity })
            .eq('id', item.id)

          if (updateError) {
            throw new Error(
              `Miktar güncellenemedi (${item.item_name}): ${updateError.message || rpcError.message}`
            )
          }
        }

        const { error: shipmentError } = await supabase.from('shipments').insert({
          purchase_request_id: request.id,
          purchase_request_item_id: item.id,
          shipped_quantity: qty,
          shipped_by: user.id,
          notes: `${item.item_name} - ${qty} ${item.unit} gönderildi (IT Yönetim)`
        })

        if (shipmentError) {
          const { error: revertRpcError } = await supabase.rpc(
            'update_purchase_request_item_quantity',
            {
              item_id: item.id,
              new_quantity: item.quantity
            }
          )
          if (revertRpcError) {
            await supabase
              .from('purchase_request_items')
              .update({ quantity: item.quantity })
              .eq('id', item.id)
          }
          throw new Error(
            shipmentError.message || 'Gönderim kaydı oluşturulamadı'
          )
        }

        summaryParts.push(`${item.item_name}: ${qty} ${item.unit}`)
      }

      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: 'gönderildi',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      const summary = summaryParts.join('; ')
      await supabase.from('approval_history').insert({
        purchase_request_id: request.id,
        action: 'approved',
        performed_by: user.id,
        comments: `IT Yönetim — Pazarlama departman yöneticisi gönderildi. Miktarlar: ${summary}`
      })

      try {
        const { handlePurchaseRequestStatusChange } = await import('@/lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, 'gönderildi', request.status)
      } catch {
        /* non-blocking */
      }

      invalidatePurchaseRequestsCache()
      setSendDialogOpen(false)
      await onRefresh()
      showToast('Talep gönderildi olarak işaretlendi.', 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata'
      showToast('Gönder işlemi başarısız: ' + msg, 'error')
    } finally {
      setStage1Busy(false)
    }
  }

  const handleApproveStage1 = async () => {
    if (!canStage1) return
    setStage1Busy(true)
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Oturum bulunamadı')

      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: IT_STATUS_ONAYLANDI,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      await supabase.from('approval_history').insert({
        purchase_request_id: request.id,
        action: 'approved',
        performed_by: user.id,
        comments: 'Pazarlama departman yöneticisi — IT Yönetim onayı (satın almaya gönderim bekleniyor)'
      })

      try {
        const { handlePurchaseRequestStatusChange } = await import('@/lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, IT_STATUS_ONAYLANDI, request.status)
      } catch {
        /* non-blocking */
      }

      invalidatePurchaseRequestsCache()
      await onRefresh()
      showToast('Talep onaylandı. Pazarlama site manager satın almaya gönderebilir.', 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata'
      showToast('Onay başarısız: ' + msg, 'error')
    } finally {
      setStage1Busy(false)
    }
  }

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Red nedeni girin', 'error')
      return
    }
    setStage1Busy(true)
    setRejectOpen(false)
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Oturum bulunamadı')

      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: 'reddedildi',
          rejection_reason: rejectReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      await supabase.from('approval_history').insert({
        purchase_request_id: request.id,
        action: 'rejected',
        performed_by: user.id,
        comments: `IT Yönetim — Pazarlama departman yöneticisi reddetti: ${rejectReason.trim()}`
      })

      try {
        const { handlePurchaseRequestStatusChange } = await import('@/lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, 'reddedildi', request.status)
      } catch {
        /* non-blocking */
      }

      invalidatePurchaseRequestsCache()
      await onRefresh()
      showToast('Talep reddedildi', 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata'
      showToast('Red başarısız: ' + msg, 'error')
    } finally {
      setStage1Busy(false)
      setRejectReason('')
    }
  }

  const handleSendToPurchasing = async () => {
    if (!canStage2 || request.status !== IT_STATUS_ONAYLANDI) return
    setStage2Busy(true)
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Oturum bulunamadı')

      const newStatus = 'satın almaya gönderildi'
      const successMessage = 'Malzemeler satın almaya gönderildi!'
      const historyComment =
        'Pazarlama site manager — IT onayı sonrası satın almaya gönderildi'

      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      await supabase.from('approval_history').insert({
        purchase_request_id: request.id,
        action: 'approved',
        performed_by: user.id,
        comments: historyComment
      })

      try {
        const { handlePurchaseRequestStatusChange } = await import('@/lib/teams-webhook')
        await handlePurchaseRequestStatusChange(request.id, newStatus, request.status)
      } catch {
        /* non-blocking */
      }

      invalidatePurchaseRequestsCache()
      await onRefresh()
      showToast(successMessage, 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata'
      showToast('İşlem başarısız: ' + msg, 'error')
    } finally {
      setStage2Busy(false)
    }
  }

  const materialOrdersArray = Array.isArray(props.materialOrders)
    ? props.materialOrders
    : Object.values(props.materialOrders || {})

  const sitePersonnelProps = {
    ...props,
    request,
    materialOrders: materialOrdersArray,
    onRefresh,
    showToast,
    hideDeliveryButtons: true
  }

  const showStage1Card = request.status === IT_STATUS_INCELEMEDE && canStage1
  const showStage2Card = request.status === IT_STATUS_ONAYLANDI && canStage2

  return (
    <>
      <SitePersonnelView {...sitePersonnelProps} currentOrder={props.currentOrder} />

      {showStage1Card && (
        <Card className="bg-white border-0 shadow-sm rounded-3xl mt-4">
          <CardContent className="p-4 sm:p-8">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-sky-600" />
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-2">
                IT Yönetim — Pazarlama
              </h3>
              <p className="text-xs sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
                Talebi düzenleyebilir, gönderebilir, onaylayabilir veya reddedebilirsiniz.
              </p>
              <div className="flex flex-col gap-2 sm:gap-3">
                <Button
                  onClick={handleEdit}
                  variant="outline"
                  className="flex items-center justify-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl w-full"
                >
                  <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                  Talebi Düzenle
                </Button>
                {isDeptHeadPazarlama && (
                  <Button
                    onClick={openSendDialog}
                    disabled={stage1Busy}
                    variant="outline"
                    className="flex items-center justify-center gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-xl w-full"
                  >
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    Gönder
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setRejectReason('')
                    setRejectOpen(true)
                  }}
                  disabled={stage1Busy}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50 rounded-xl w-full"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Reddet
                </Button>
                <Button
                  onClick={handleApproveStage1}
                  disabled={stage1Busy}
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl w-full"
                >
                  {stage1Busy ? 'Onaylanıyor...' : 'Onayla (Satın almaya hazır)'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showStage2Card && (
        <Card className="bg-white border-0 shadow-sm rounded-3xl mt-4">
          <CardContent className="p-4 sm:p-8">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-2">
                IT onayı tamamlandı
              </h3>
              <p className="text-xs sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
                Ana depo stok kontrolü yapılır; uygunsa satın almaya gönderilir veya onaylanır.
              </p>
              <Button
                onClick={handleSendToPurchasing}
                disabled={stage2Busy}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl w-full"
              >
                {stage2Busy ? 'Gönderiliyor...' : 'Satın Almaya Gönder / Onayla'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={sendDialogOpen}
        onOpenChange={open => {
          if (stage1Busy) return
          setSendDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-lg bg-white max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gönderim miktarları</DialogTitle>
            <DialogDescription>
              Her kalem için şantiyeye gönderilecek adedi girin. Onay sonrası talep &quot;Gönderildi&quot;
              olur ve gönderim kayıtları oluşturulur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
            {(request.purchase_request_items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu talepte kalem yok.</p>
            ) : (
              (request.purchase_request_items ?? []).map((item: PurchaseRequestItem) => (
                <div key={item.id} className="flex flex-col gap-1.5 rounded-lg border border-gray-100 p-3">
                  <Label htmlFor={`send-qty-${item.id}`} className="text-sm font-medium">
                    {item.item_name}
                    <span className="font-normal text-gray-500">
                      {' '}
                      (Kalan: {item.quantity} {item.unit})
                    </span>
                  </Label>
                  <Input
                    id={`send-qty-${item.id}`}
                    type="number"
                    min={0}
                    max={item.quantity}
                    step={1}
                    disabled={item.quantity <= 0 || stage1Busy}
                    value={sendQuantities[item.id] ?? ''}
                    onChange={e =>
                      setSendQuantities(prev => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="rounded-xl"
                  />
                </div>
              ))
            )}
          </div>
          <DialogFooter className="gap-2 flex-shrink-0">
            <Button
              variant="outline"
              disabled={stage1Busy}
              onClick={() => setSendDialogOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              disabled={stage1Busy}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void confirmSendGonderildi()}
            >
              {stage1Busy ? 'Gönderiliyor...' : 'Gönder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Talebi reddet</DialogTitle>
            <DialogDescription>Red gerekçesini yazın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="it-reject">Gerekçe</Label>
            <Textarea
              id="it-reject"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={() => void confirmReject()}>
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
