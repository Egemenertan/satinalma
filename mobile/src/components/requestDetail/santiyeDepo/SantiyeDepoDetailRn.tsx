import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { depoManagerApproveRequest, depoManagerRejectRequest } from '../../../features/santiyeDepo/depoApprovalActions'
import {
  canDepoManagerApprove,
  shouldShowDepoPdfExport,
  shouldShowDepoTrackingSystem,
} from '../../../features/santiyeDepo/santiyeDepoRules'
import { allowEditForRequest } from '../../../lib/editPermissions'
import { IT_WORKFLOW_STATUSES } from '../../../lib/it-workflow'
import type { BundleOrderRow, PurchaseRequestItemRow, RequestOfferBundle } from '../../../lib/requestOfferBundle'
import { supabase } from '../../../lib/supabase'
import type { ProfileRow } from '../../../lib/purchaseRequestsQuery'
import { SitePersonnelTrackingRn } from '../SitePersonnelTrackingRn'
import { DepoMaterialFooterRn } from './DepoMaterialFooterRn'
import { RequestSupplierDeliverySectionRn } from './RequestSupplierDeliverySectionRn'
import { ReturnOrderModalRn } from './ReturnOrderModalRn'
import { SwipeDismissSheet } from '../../island/SwipeDismissSheet'
import { requestDetailLayout } from '../../../theme/requestDetailLayout'
import { stats, statsFont, statsType } from '../../../theme/statsDesignTokens'

function DepoStatusSummaryRn({
  items,
  shipmentData,
}: {
  items: NonNullable<RequestOfferBundle['request']['purchase_request_items']>
  shipmentData: RequestOfferBundle['shipmentData']
}) {
  const shippedCount = items.filter((it: PurchaseRequestItemRow) => (shipmentData[it.id]?.total_shipped || 0) > 0).length
  const total = items.length
  if (shippedCount === 0) return null
  if (shippedCount === total) {
    return (
      <View style={sumStyles.ok}>
        <Text style={sumStyles.okTitle}>Tüm malzemeler gönderildi</Text>
        <Text style={sumStyles.okSub}>Bu talep için depo gönderimleri tamamlandı.</Text>
      </View>
    )
  }
  return (
    <View style={sumStyles.partial}>
      <Text style={sumStyles.partialTitle}>
        {shippedCount}/{total} malzeme gönderildi
      </Text>
      <Text style={sumStyles.partialSub}>Kalan gönderimleri tamamlayın.</Text>
    </View>
  )
}

const sumStyles = StyleSheet.create({
  ok: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  okTitle: { fontWeight: '700', fontSize: 15, color: '#047857' },
  okSub: { fontSize: 14, color: '#059669', marginTop: 6 },
  partial: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  partialTitle: { fontWeight: '600', fontSize: 14, color: '#92400e' },
  partialSub: { fontSize: 13, color: '#a16207', marginTop: 4 },
})

type Props = {
  bundle: RequestOfferBundle
  profile: ProfileRow
  userId: string
  onRefresh: () => void
  formatRequestNumber: (raw: string | null, id: string) => string
  onEditPress: () => void
}

export function SantiyeDepoDetailRn({
  bundle,
  profile,
  userId,
  onRefresh,
  formatRequestNumber,
  onEditPress,
}: Props) {
  const req = bundle.request
  const items = req.purchase_request_items ?? []
  const status = req.status

  const [returnOpen, setReturnOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState<BundleOrderRow | null>(null)
  const [returnMaterial, setReturnMaterial] = useState<(typeof items)[number] | null>(null)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [approvalBusy, setApprovalBusy] = useState<'appr' | 'rej' | null>(null)

  const { data: genelMerkezId } = useQuery({
    queryKey: ['sites', 'genel_merkez'],
    queryFn: async () => {
      const { data } = await supabase.from('sites').select('id').eq('name', 'Genel Merkez Ofisi').maybeSingle()
      return (data as { id: string } | null)?.id ?? null
    },
  })

  const userSiteIds = useMemo(() => {
    const sid = profile.site_id
    if (Array.isArray(sid) && sid.length) return sid
    if (typeof sid === 'string' && sid) return [sid]
    return []
  }, [profile.site_id])

  const isGenelMerkezUser = Boolean(
    genelMerkezId && userSiteIds.length > 0 && userSiteIds[0] === genelMerkezId
  )

  const itBanner = useMemo(() => {
    if (!req.it_workflow_applies || !status) return null
    const st = status as string
    if (!(IT_WORKFLOW_STATUSES as readonly string[]).includes(st)) return null
    if (st === 'it_incelemesinde') {
      return 'Bu talep IT yönetiminde inceleniyor. Pazarlama onayı sonrası süreç devam eder.'
    }
    if (st === 'it_onaylandi') {
      return 'IT onayı tamamlandı. Talep satın alma sürecine hazırlanıyor.'
    }
    return null
  }, [req.it_workflow_applies, status])

  const editable = allowEditForRequest({
    status: String(status ?? ''),
    userRole: profile.role ?? '',
    userDepartment: profile.department,
    itWorkflowApplies: Boolean(req.it_workflow_applies),
  })

  const managerEdit =
    (profile.role === 'santiye_depo_yonetici' || profile.role === 'site_manager') &&
    (status === 'kısmen gönderildi' || status === 'depoda mevcut değil')

  const showPdf = shouldShowDepoPdfExport({
    status,
    siteId: req.site_id ?? null,
    isGenelMerkezUser,
  })

  const showApproval = canDepoManagerApprove({
    role: profile.role ?? '',
    status,
    siteId: req.site_id ?? null,
  })

  const toast = useCallback((msg: string) => Alert.alert('Bilgi', msg), [])

  const openReturn = useCallback((order: BundleOrderRow, material: (typeof items)[number]) => {
    setReturnOrder(order)
    setReturnMaterial(material)
    setReturnOpen(true)
  }, [])

  const approve = useCallback(async () => {
    setApprovalBusy('appr')
    try {
      const res = await depoManagerApproveRequest(supabase, {
        requestId: req.id,
        currentStatus: status ?? null,
        siteId: req.site_id ?? null,
      })
      if (!res.ok) {
        Alert.alert('Onay', res.message)
        return
      }
      Alert.alert('Onay', res.message)
      await onRefresh()
    } finally {
      setApprovalBusy(null)
    }
  }, [req.id, req.site_id, status, onRefresh])

  const reject = useCallback(async () => {
    setApprovalBusy('rej')
    try {
      const res = await depoManagerRejectRequest(supabase, { requestId: req.id, reason: rejectReason })
      if (!res.ok) {
        Alert.alert('Red', res.message)
        return
      }
      Alert.alert('Red', 'Talep reddedildi.')
      setRejectOpen(false)
      setRejectReason('')
      await onRefresh()
    } finally {
      setApprovalBusy(null)
    }
  }, [req.id, rejectReason, onRefresh])

  const rn = formatRequestNumber((req.request_number as string) ?? null, req.id)

  return (
    <ScrollView style={requestDetailLayout.screenScroll} contentContainerStyle={requestDetailLayout.scrollContent}>
      <View style={requestDetailLayout.topMeta}>
        <Text style={requestDetailLayout.pageTitle}>{req.title || '—'}</Text>
        <Text style={requestDetailLayout.pageMeta}>
          {rn} · {status || '—'}
          {req.site_name ? ` · ${req.site_name}` : ''}
        </Text>
      </View>

      {itBanner ? (
        <View style={requestDetailLayout.itBanner}>
          <Text style={requestDetailLayout.itBannerText}>{itBanner}</Text>
        </View>
      ) : null}

      {showPdf ? (
        <Pressable
          style={styles.pdfBtn}
          onPress={() =>
            Alert.alert(
              'Talep PDF’i',
              'PDF çıktısı şu an web uygulamasındaki talep ekranından alınabilir.'
            )
          }
        >
          <Text style={styles.pdfBtnText}>PDF</Text>
        </Pressable>
      ) : null}

      {showApproval ? (
        <View style={styles.approvalCard}>
          <Text style={styles.approvalTitle}>Depo onayı</Text>
          <View style={styles.approvalRow}>
            <Pressable
              style={[styles.rejectBtn, approvalBusy !== null && styles.dis]}
              disabled={approvalBusy !== null}
              onPress={() => setRejectOpen(true)}
            >
              <Text style={styles.rejectBtnText}>Reddet</Text>
            </Pressable>
            <Pressable
              style={[styles.approveBtn, approvalBusy !== null && styles.dis]}
              disabled={approvalBusy !== null}
              onPress={approve}
            >
              {approvalBusy === 'appr' ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.approveBtnText}>Onayla</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <SitePersonnelTrackingRn
        request={{
          id: req.id,
          status,
          request_number: req.request_number,
          title: req.title,
          site_name: req.site_name,
          image_urls: req.image_urls ?? null,
          purchase_request_items: items,
        }}
        materialOrders={bundle.materialOrders}
        shipmentData={bundle.shipmentData}
        canEdit={
          (profile.role === 'santiye_depo_yonetici' || profile.role === 'site_manager') &&
          managerEdit &&
          editable
        }
        readOnly={false}
        onEditPress={onEditPress}
        hideMaterialSectionHeader
        renderItemFooter={(item) => (
          <DepoMaterialFooterRn
            item={item}
            itemsCount={items.length}
            bundle={bundle}
            userId={userId}
            onRefresh={onRefresh}
            onToast={toast}
          />
        )}
      />

      <RequestSupplierDeliverySectionRn bundle={bundle} onSuccess={() => void onRefresh()} onOpenReturn={openReturn} />

      {shouldShowDepoTrackingSystem(status) ? null : (
        <View style={styles.summaryInset}>
          <DepoStatusSummaryRn items={items} shipmentData={bundle.shipmentData} />
        </View>
      )}

      <ReturnOrderModalRn
        visible={returnOpen}
        onClose={() => {
          setReturnOpen(false)
          setReturnOrder(null)
          setReturnMaterial(null)
        }}
        order={returnOrder}
        materialItem={returnMaterial}
        userRole={profile.role ?? 'santiye_depo'}
        onSuccess={() => void onRefresh()}
      />

      <SwipeDismissSheet
        visible={rejectOpen}
        onRequestClose={() => setRejectOpen(false)}
        title="Red nedeni"
        maxHeightRatio={0.65}
        tapBackdropToClose
      >
        <View style={styles.sheetPad}>
          <TextInput
            style={[styles.rejectInput, styles.textArea]}
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            placeholder="Zorunlu"
            placeholderTextColor={stats.outline}
          />
          <View style={styles.rejectActions}>
            <Pressable style={styles.btnGhost} onPress={() => setRejectOpen(false)}>
              <Text style={styles.btnGhostText}>İptal</Text>
            </Pressable>
            <Pressable
              style={styles.btnDangerSolid}
              disabled={approvalBusy !== null}
              onPress={reject}
            >
              {approvalBusy === 'rej' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnDangerSolidText}>Reddet</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SwipeDismissSheet>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  summaryInset: {
    paddingHorizontal: 20,
  },
  sheetPad: { paddingHorizontal: 20 },
  pdfBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#111827',
    borderRadius: 9999,
    alignItems: 'center',
  },
  pdfBtnText: { fontWeight: '600', fontSize: 15, color: '#ffffff' },
  approvalCard: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  approvalTitle: { fontWeight: '700', fontSize: 15, color: '#047857', marginBottom: 14 },
  approvalRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  approveBtn: {
    flex: 1.85,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#01E884',
    borderRadius: 9999,
  },
  approveBtnText: { fontWeight: '700', fontSize: 15, color: '#111827' },
  rejectBtn: {
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#ffffff',
    borderRadius: 9999,
  },
  rejectBtnText: { fontWeight: '600', fontSize: 14, color: '#dc2626' },
  dis: { opacity: 0.55 },
  rejectInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  rejectActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  btnGhostText: { fontWeight: '600', color: '#374151' },
  btnDangerSolid: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  btnDangerSolidText: { fontWeight: '700', color: '#ffffff' },
})
