import { useCallback, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { itWorkflowConfirmSendGonderildi } from '../../../features/itWorkflow/itWorkflowDepartmentSend'
import {
  persistItWorkflowItemEdits,
  type ItWorkflowItemDraft,
} from '../../../features/itWorkflow/itWorkflowPersistItemEdits'
import { siteManagerApproveOrSendToPurchasing } from '../../../features/siteManager/siteManagerRequestActions'
import {
  IT_STATUS_INCELEMEDE,
  IT_STATUS_ONAYLANDI,
  IT_WORKFLOW_STATUSES,
  isItWorkflowElevatedRole,
  isPazarlamaDepartment,
} from '../../../lib/it-workflow'
import type { PurchaseRequestItemRow } from '../../../lib/requestOfferBundle'
import { supabase } from '../../../lib/supabase'

export type UseItWorkflowActionsRnArgs = {
  requestId: string
  status: string | null
  siteId: string | null
  itWorkflowApplies: boolean
  userRole: string
  userDepartment: string | null | undefined
  items: PurchaseRequestItemRow[]
  onSuccess: () => void
}

export function useItWorkflowActionsRn({
  requestId,
  status,
  siteId,
  itWorkflowApplies,
  userRole,
  userDepartment,
  items,
  onSuccess,
}: UseItWorkflowActionsRnArgs) {
  const queryClient = useQueryClient()
  const [busyApprove1, setBusyApprove1] = useState(false)
  const [busyReject, setBusyReject] = useState(false)
  const [busyStage2, setBusyStage2] = useState(false)
  const [busySend, setBusySend] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)

  const isDeptHeadPazarlama =
    userRole === 'department_head' && isPazarlamaDepartment(userDepartment)
  const isSiteMgrPazarlama =
    userRole === 'site_manager' && isPazarlamaDepartment(userDepartment)
  const elevated = isItWorkflowElevatedRole(userRole)

  const canStage1 = isDeptHeadPazarlama || elevated
  const canStage2 = isSiteMgrPazarlama || elevated

  const visible = useMemo(() => {
    if (!itWorkflowApplies || !status) return false
    return (IT_WORKFLOW_STATUSES as readonly string[]).includes(status)
  }, [itWorkflowApplies, status])

  const showStage1 = visible && status === IT_STATUS_INCELEMEDE && canStage1
  const showStage2 = visible && status === IT_STATUS_ONAYLANDI && canStage2
  const showAny = showStage1 || showStage2

  const onApproveStage1 = useCallback(async () => {
    setBusyApprove1(true)
    try {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        const { data: refreshData } = await supabase.auth.refreshSession()
        session = refreshData.session
      }
      const user = session?.user
      if (!user) throw new Error('Oturum bulunamadı')

      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: IT_STATUS_ONAYLANDI,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) throw new Error(updateError.message)

      await supabase.from('approval_history').insert({
        purchase_request_id: requestId,
        action: 'approved',
        performed_by: user.id,
        comments: 'IT Yönetim onayı',
      })

      Alert.alert('', 'Satın alma için onaya gönderildi')
      onSuccess()
    } catch (e) {
      Alert.alert('', e instanceof Error ? e.message : 'İşlem başarısız')
    } finally {
      setBusyApprove1(false)
    }
  }, [requestId, onSuccess])

  const onRejectConfirm = useCallback(async () => {
    const t = rejectReason.trim()
    if (!t) {
      Alert.alert('', 'Red gerekçesi yazın')
      return
    }
    setBusyReject(true)
    try {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        const { data: refreshData } = await supabase.auth.refreshSession()
        session = refreshData.session
      }
      const user = session?.user
      if (!user) throw new Error('Oturum bulunamadı')

      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({
          status: 'reddedildi',
          rejection_reason: t,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) throw new Error(updateError.message)

      await supabase.from('approval_history').insert({
        purchase_request_id: requestId,
        action: 'rejected',
        performed_by: user.id,
        comments: `IT Yönetim red: ${t}`,
      })

      setRejectOpen(false)
      setRejectReason('')
      Alert.alert('', 'Talep reddedildi')
      onSuccess()
    } catch (e) {
      Alert.alert('', e instanceof Error ? e.message : 'İşlem başarısız')
    } finally {
      setBusyReject(false)
    }
  }, [rejectReason, requestId, onSuccess])

  const onSendToPurchasing = useCallback(async () => {
    setBusyStage2(true)
    try {
      const { message } = await siteManagerApproveOrSendToPurchasing(
        supabase,
        requestId,
        IT_STATUS_ONAYLANDI,
        siteId
      )
      Alert.alert('', message)
      onSuccess()
    } catch (e) {
      Alert.alert('', e instanceof Error ? e.message : 'İşlem başarısız')
    } finally {
      setBusyStage2(false)
    }
  }, [requestId, siteId, onSuccess])

  const handleSaveEdits = useCallback(
    async (drafts: Record<string, ItWorkflowItemDraft>) => {
      setSavingEdit(true)
      
      // Optimistic update - UI'yı hemen güncelle
      queryClient.setQueryData(['request_offer_bundle', requestId], (oldData: any) => {
        if (!oldData?.request?.purchase_request_items) return oldData
        
        const updatedItems = oldData.request.purchase_request_items.map((item: any) => {
          const draft = drafts[item.id]
          if (!draft) return item
          
          // Brand: eğer trim edilmiş değer varsa kullan, boşsa null
          const brandTrimmed = draft.brand?.trim()
          const finalBrand = brandTrimmed && brandTrimmed.length > 0 ? brandTrimmed : null
          
          return {
            ...item,
            item_name: draft.item_name?.trim() || item.item_name,
            brand: finalBrand,
            description: draft.description?.trim() || null,
            quantity: Number(draft.quantity) || item.quantity,
            unit: draft.unit?.trim() || item.unit,
            specifications: draft.specifications?.trim() || null,
            purpose: draft.purpose?.trim() || null,
            delivery_date: draft.delivery_date?.trim() || null,
          }
        })
        
        return {
          ...oldData,
          request: {
            ...oldData.request,
            purchase_request_items: updatedItems
          }
        }
      })
      
      try {
        // En güncel items'ı cache'den al
        const currentData = queryClient.getQueryData<any>(['request_offer_bundle', requestId])
        const currentItems = (currentData?.request?.purchase_request_items ?? items) as PurchaseRequestItemRow[]
        
        await persistItWorkflowItemEdits(supabase, currentItems, drafts)
        try {
          await supabase.rpc('update_purchase_request_status_manual', { request_id: requestId })
        } catch {
          /* sessiz */
        }
        
        // Başarılı olursa cache'i yenile (doğrulama için)
        await queryClient.invalidateQueries({ 
          queryKey: ['request_offer_bundle', requestId] 
        })
        
        setEditOpen(false)
        Alert.alert('', 'Kalemler güncellendi')
        onSuccess()
      } catch (e) {
        await queryClient.invalidateQueries({ 
          queryKey: ['request_offer_bundle', requestId] 
        })
        Alert.alert('', e instanceof Error ? e.message : 'İşlem başarısız')
      } finally {
        setSavingEdit(false)
      }
    },
    [items, requestId, onSuccess, queryClient]
  )

  const handleSendQuantities = useCallback(
    async (quantities: Record<string, string>) => {
      setBusySend(true)
      try {
        await itWorkflowConfirmSendGonderildi(supabase, {
          requestId,
          items,
          sendQuantities: quantities,
        })
        setSendOpen(false)
        Alert.alert('', 'Gönderildi')
        onSuccess()
      } catch (e) {
        Alert.alert('', e instanceof Error ? e.message : 'İşlem başarısız')
      } finally {
        setBusySend(false)
      }
    },
    [requestId, items, onSuccess]
  )

  const busyAny =
    busyApprove1 || busyReject || busyStage2 || busySend || savingEdit

  return {
    isDeptHeadPazarlama,
    showStage1,
    showStage2,
    showAny,
    busyAny,
    busyApprove1,
    busyReject,
    busyStage2,
    busySend,
    savingEdit,
    rejectOpen,
    rejectReason,
    editOpen,
    sendOpen,
    setRejectReason,
    setEditOpen,
    setSendOpen,
    setRejectOpen,
    onApproveStage1,
    onRejectConfirm,
    onSendToPurchasing,
    handleSaveEdits,
    handleSendQuantities,
  }
}
