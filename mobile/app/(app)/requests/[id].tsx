import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { SantiyeDepoDetailRn } from '../../../src/components/requestDetail/santiyeDepo/SantiyeDepoDetailRn'
import { DepoMaterialFooterRn } from '../../../src/components/requestDetail/santiyeDepo/DepoMaterialFooterRn'
import { RequestSupplierDeliverySectionRn } from '../../../src/components/requestDetail/santiyeDepo/RequestSupplierDeliverySectionRn'
import { ReturnOrderModalRn } from '../../../src/components/requestDetail/santiyeDepo/ReturnOrderModalRn'
import {
  ItWorkflowActionsCardRn,
  ItWorkflowActionsSheetsRn,
  useItWorkflowActionsRn,
} from '../../../src/components/requestDetail/itWorkflow/ItWorkflowActionsRn'
import { SiteManagerActionsRn } from '../../../src/components/requestDetail/siteManager/SiteManagerActionsRn'
import { SitePersonnelTrackingRn } from '../../../src/components/requestDetail/SitePersonnelTrackingRn'
import { RequestActivityTimelineRn } from '../../../src/components/requestDetail/RequestActivityTimelineRn'
import { RequestStatusNoticeRn, requestStatusLabel } from '../../../src/components/requestDetail/RequestStatusNoticeRn'
import { RejectedMaterialsNoticeRn } from '../../../src/components/requestDetail/RejectedMaterialsNoticeRn'
import { rejectPurchaseRequestItem } from '../../../src/lib/purchasingItemRejection'
import { allowEditForRequest } from '../../../src/lib/editPermissions'
import { IT_WORKFLOW_STATUSES } from '../../../src/lib/it-workflow'
import type { ProfileRow } from '../../../src/lib/purchaseRequestsQuery'
import type { BundleOrderRow, PurchaseRequestItemRow } from '../../../src/lib/requestOfferBundle'
import { fetchRequestOfferBundle } from '../../../src/lib/requestOfferBundle'
import { supabase } from '../../../src/lib/supabase'
import { useAuth } from '../../../src/providers/AuthProvider'
import { stats, statsCardSurface, statsFont, statsType } from '../../../src/theme/statsDesignTokens'
import { requestDetailLayout } from '../../../src/theme/requestDetailLayout'

type RequestDetail = Record<string, unknown> & {
  id: string
  request_number: string | null
  title: string | null
  status: string | null
  site_name: string | null
  it_workflow_applies?: boolean | null
  purchase_request_items?: Array<{
    id: string
    item_name: string
    quantity: number
    unit: string
    purpose?: string | null
    material_class?: string | null
    material_group?: string | null
    purchasing_rejection_reason?: string | null
  }>
}

function resolveProfileSiteIds(profile: ProfileRow) {
  if (profile.site_id && Array.isArray(profile.site_id) && profile.site_id.length) {
    return profile.site_id as string[]
  }
  if (profile.site_id && typeof profile.site_id === 'string') {
    return [profile.site_id]
  }
  if (profile.construction_site_id) {
    return [profile.construction_site_id]
  }
  return []
}

function formatRequestNumber(raw: string | null, id: string): string {
  if (!raw) return `REQ-${id.slice(-6)}`
  const parts = raw.split('-')
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    const secondLastPart = parts[parts.length - 2]
    const lastTwoChars = secondLastPart.slice(-2)
    return `${lastTwoChars}-${lastPart}`
  }
  return raw
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const requestId = Array.isArray(id) ? id[0] : id
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const userRole = profile?.role ?? ''

  const isSitePersonnel = userRole === 'site_personnel'
  const isSiteManager = userRole === 'site_manager'
  const isWarehouseManager = userRole === 'warehouse_manager'
  const isDepotOfferRole = userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici'
  /** IT Yönetim + web offers ile uyum: department_head ve üst roller tam bundle görür */
  const useOfferBundle =
    isSitePersonnel ||
    isDepotOfferRole ||
    isSiteManager ||
    userRole === 'department_head' ||
    userRole === 'admin' ||
    userRole === 'super_admin' ||
    userRole === 'manager' ||
    isWarehouseManager

  const [returnOpen, setReturnOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState<BundleOrderRow | null>(null)
  const [returnMaterial, setReturnMaterial] = useState<PurchaseRequestItemRow | null>(null)
  const [poRejectItem, setPoRejectItem] = useState<{ id: string; item_name: string } | null>(null)
  const [poRejectReason, setPoRejectReason] = useState('')
  const [poRejecting, setPoRejecting] = useState(false)

  const toastSite = useCallback((msg: string) => Alert.alert(t('common.info'), msg), [t])

  const openReturn = useCallback((order: BundleOrderRow, material: PurchaseRequestItemRow) => {
    setReturnOrder(order)
    setReturnMaterial(material)
    setReturnOpen(true)
  }, [])

  const {
    data: bundle,
    isLoading: bundleLoading,
    error: bundleError,
    refetch: refetchBundle,
  } = useQuery({
    queryKey: ['request_offer_bundle', requestId],
    enabled: Boolean(requestId && user?.id && useOfferBundle),
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!requestId) return null
      return fetchRequestOfferBundle(supabase, requestId)
    },
  })

  const wf = useItWorkflowActionsRn({
    requestId: bundle?.request?.id ?? '',
    status: (bundle?.request?.status as string | null) ?? null,
    siteId: (bundle?.request?.site_id as string | null) ?? null,
    itWorkflowApplies: Boolean(bundle?.request?.it_workflow_applies),
    userRole,
    userDepartment: profile?.department,
    items: (bundle?.request?.purchase_request_items ?? []) as PurchaseRequestItemRow[],
    onSuccess: () => void refetchBundle(),
  })

  const personnelAccessDenied = useMemo(() => {
    if (!isSitePersonnel || !bundle?.request || !user?.id) return false
    return bundle.request.requested_by !== user.id
  }, [isSitePersonnel, bundle?.request, user?.id])

  const depotAccessDenied = useMemo(() => {
    if (!isDepotOfferRole || !bundle?.request || !profile) return false
    const siteId = bundle.request.site_id as string | null
    if (!siteId) return true
    const userSites = resolveProfileSiteIds(profile as ProfileRow)
    return !userSites.includes(siteId)
  }, [isDepotOfferRole, bundle?.request, profile])

  const siteManagerAccessDenied = useMemo(() => {
    if (!isSiteManager || !bundle?.request || !profile) return false
    const siteId = bundle.request.site_id as string | null
    if (!siteId) return true
    const userSites = resolveProfileSiteIds(profile as ProfileRow)
    return !userSites.includes(siteId)
  }, [isSiteManager, bundle?.request, profile])

  const editable = useMemo(() => {
    if (!bundle?.request || !profile?.role) return false
    return allowEditForRequest({
      status: String(bundle.request.status ?? ''),
      userRole: profile.role,
      userDepartment: profile.department,
      itWorkflowApplies: Boolean(bundle.request.it_workflow_applies),
    })
  }, [bundle?.request, profile])

  const { data: legacyData, isLoading: legacyLoading, error: legacyError, refetch: refetchLegacy } = useQuery({
    queryKey: ['purchase_request', requestId, 'legacy'],
    enabled: Boolean(requestId && user?.id && !useOfferBundle),
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: row, error: err } = await supabase
        .from('purchase_requests')
        .select(
          `
          *,
          sites:site_id ( name ),
          purchase_request_items (*)
        `
        )
        .eq('id', requestId as string)
        .is('deleted_at', null)
        .single()
      if (err) throw err
      return row as RequestDetail
    },
  })

  if (!requestId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyStateText}>{t('requestDetail.invalid')}</Text>
      </View>
    )
  }

  if (useOfferBundle) {
    if (bundleLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={stats.primary} size="large" />
        </View>
      )
    }
    if (bundleError || !bundle) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyStateText}>{t('requestDetail.loadError')}</Text>
        </View>
      )
    }
    if (personnelAccessDenied) {
      return (
        <View style={styles.centered}>
          <Text style={styles.deniedTitle}>{t('requestDetail.accessTitle')}</Text>
          <Text style={styles.deniedSub}>{t('requestDetail.accessPersonnel')}</Text>
        </View>
      )
    }
    if (depotAccessDenied) {
      return (
        <View style={styles.centered}>
          <Text style={styles.deniedTitle}>{t('requestDetail.accessTitle')}</Text>
          <Text style={styles.deniedSub}>{t('requestDetail.accessDepot')}</Text>
        </View>
      )
    }
    if (siteManagerAccessDenied) {
      return (
        <View style={styles.centered}>
          <Text style={styles.deniedTitle}>{t('requestDetail.accessTitle')}</Text>
          <Text style={styles.deniedSub}>{t('requestDetail.accessSm')}</Text>
        </View>
      )
    }

    if ((isDepotOfferRole || isWarehouseManager) && profile && user?.id) {
      return (
        <SantiyeDepoDetailRn
          bundle={bundle}
          profile={profile as ProfileRow}
          userId={user.id}
          onRefresh={() => void refetchBundle()}
          formatRequestNumber={formatRequestNumber}
          onEditPress={() => {
            Alert.alert(
              t('requestDetail.editTitle'),
              t('requestDetail.editBody'),
              [
                { text: t('common.ok'), style: 'cancel' },
                { text: t('common.refresh'), onPress: () => void refetchBundle() },
              ]
            )
          }}
        />
      )
    }

    const req = bundle.request
    return (
      <>
      <ScrollView style={requestDetailLayout.screenScroll} contentContainerStyle={requestDetailLayout.scrollContent}>
        <View style={requestDetailLayout.topMeta}>
          <Text style={requestDetailLayout.pageTitle}>{req.title || '—'}</Text>
          <Text style={requestDetailLayout.pageMeta}>
            {formatRequestNumber((req.request_number as string) ?? null, req.id)} · {requestStatusLabel(req.status)}
            {req.site_name ? ` · ${req.site_name}` : ''}
          </Text>
        </View>
        <RequestActivityTimelineRn
          requestId={req.id}
          refreshKey={(req.updated_at as string | null | undefined) ?? null}
        />
        <RequestStatusNoticeRn status={req.status} />
        <RejectedMaterialsNoticeRn
          requestId={req.id}
          requestedBy={req.requested_by}
          currentUserId={user?.id}
          items={(req.purchase_request_items ?? []) as PurchaseRequestItemRow[]}
          onRefresh={() => void refetchBundle()}
          onToast={toastSite}
        />
        <RequestSupplierDeliverySectionRn 
          bundle={bundle} 
          onSuccess={() => void refetchBundle()} 
          onOpenReturn={openReturn}
        />
        <SitePersonnelTrackingRn
          request={{
            id: req.id,
            status: req.status ?? null,
            request_number: req.request_number,
            title: req.title,
            site_name: req.site_name,
            image_urls: (req.image_urls as string[] | null) ?? null,
            purchase_request_items: req.purchase_request_items,
          }}
          materialOrders={bundle.materialOrders}
          shipmentData={bundle.shipmentData}
          canEdit={editable}
          readOnly={false}
          onEditPress={() => {
            Alert.alert(
              t('requestDetail.editTitle'),
              t('requestDetail.editBodyLong'),
              [
                { text: t('common.ok'), style: 'cancel' },
                { text: t('common.refresh'), onPress: () => void refetchBundle() },
              ]
            )
          }}
          renderItemFooter={
            user?.id
              ? (item) => (
                  <DepoMaterialFooterRn
                    item={item}
                    itemsCount={req.purchase_request_items?.length ?? 0}
                    bundle={bundle}
                    userId={user.id}
                    onRefresh={() => void refetchBundle()}
                    onToast={toastSite}
                    ordersOnly
                  />
                )
              : undefined
          }
        />
        <ReturnOrderModalRn
          visible={returnOpen}
          onClose={() => {
            setReturnOpen(false)
            setReturnOrder(null)
            setReturnMaterial(null)
          }}
          order={returnOrder}
          materialItem={returnMaterial}
          userRole={userRole || 'site_personnel'}
          onSuccess={() => void refetchBundle()}
        />
        <ItWorkflowActionsCardRn wf={wf} />
        {isSiteManager ? (
          <SiteManagerActionsRn
            requestId={req.id}
            status={req.status ?? null}
            siteId={(req.site_id as string | null) ?? null}
            requestDepartment={(req.department as string | null) ?? null}
            viewerDepartment={profile?.department ?? null}
            canEdit={editable}
            onEditPress={() => {
              Alert.alert(
                t('requestDetail.editTitle'),
                t('requestDetail.editBody'),
                [
                  { text: t('common.ok'), style: 'cancel' },
                  { text: t('common.refresh'), onPress: () => void refetchBundle() },
                ]
              )
            }}
            onSuccess={() => void refetchBundle()}
          />
        ) : null}
      </ScrollView>
      <ItWorkflowActionsSheetsRn wf={wf} items={(req.purchase_request_items ?? []) as PurchaseRequestItemRow[]} />
      </>
    )
  }

  const data = legacyData
  const legacyEditable = useMemo(() => {
    if (!data || !profile?.role) return false
    return allowEditForRequest({
      status: String(data.status ?? ''),
      userRole: profile.role,
      userDepartment: profile.department,
      itWorkflowApplies: Boolean(data.it_workflow_applies),
    })
  }, [data, profile])

  if (legacyLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={stats.primary} size="large" />
      </View>
    )
  }

  if (legacyError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyStateText}>{t('requestDetail.loadErrorShort')}</Text>
      </View>
    )
  }

  const items = data.purchase_request_items ?? []

  return (
    <ScrollView style={requestDetailLayout.screenScroll} contentContainerStyle={requestDetailLayout.scrollContent}>
      <View style={requestDetailLayout.topMeta}>
        <Text style={requestDetailLayout.pageTitle}>{data.title || '—'}</Text>
        <Text style={requestDetailLayout.pageMeta}>
          {formatRequestNumber(data.request_number, data.id)} · {requestStatusLabel(data.status)}
          {data.site_name ? ` · ${data.site_name}` : ''}
        </Text>
      </View>

      <RequestActivityTimelineRn
        requestId={data.id}
        refreshKey={(data.updated_at as string | null | undefined) ?? null}
      />
      <RequestStatusNoticeRn status={data.status} />
      <RejectedMaterialsNoticeRn
        requestId={data.id}
        requestedBy={(data.requested_by as string | null) ?? null}
        currentUserId={user?.id}
        items={items}
        onRefresh={() => void refetchLegacy()}
        onToast={toastSite}
      />

      <View style={styles.legacyBody}>
        <View style={[styles.badge, legacyEditable ? styles.badgeOk : styles.badgeRo]}>
          <Text style={styles.badgeText}>
            {legacyEditable ? t('requestDetail.editableWeb') : t('requestDetail.readOnly')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{t('requestDetail.itemsSection')}</Text>
        {items.map((it) => (
          <View key={it.id} style={[statsCardSurface.listItem, styles.itemCard]}>
            <Text style={styles.itemName}>{it.item_name}</Text>
            <Text style={styles.itemMeta}>
              {it.quantity} {it.unit}
              {it.material_class ? ` · ${it.material_class}` : ''}
              {it.material_group ? ` / ${it.material_group}` : ''}
            </Text>
            {it.purpose ? (
              <Text style={styles.purpose}>{t('requestDetail.purposeLabel', { purpose: it.purpose })}</Text>
            ) : null}
            {it.purchasing_rejection_reason?.trim() ? (
              <Text style={styles.rejectReason}>Red nedeni: {it.purchasing_rejection_reason}</Text>
            ) : null}
            {userRole === 'purchasing_officer' &&
            !it.purchasing_rejection_reason?.trim() &&
            (data.status === 'satın almaya gönderildi' ||
              data.status === 'eksik malzemeler talep edildi' ||
              (data.status === 'reddedildi' &&
                items.some((row) => row.purchasing_rejection_reason?.trim()))) ? (
              <Pressable
                style={styles.rejectBtn}
                onPress={() => {
                  setPoRejectReason('')
                  setPoRejectItem({ id: it.id, item_name: it.item_name })
                }}
              >
                <Text style={styles.rejectBtnText}>Reddet</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {!items.length ? <Text style={styles.empty}>{t('requestDetail.noItems')}</Text> : null}
      </View>
      <Modal visible={Boolean(poRejectItem)} transparent animationType="fade" onRequestClose={() => setPoRejectItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{poRejectItem?.item_name} reddedilsin</Text>
            <TextInput
              style={styles.modalInput}
              value={poRejectReason}
              onChangeText={setPoRejectReason}
              placeholder="Reddedilme nedeni"
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPoRejectItem(null)}>
                <Text style={styles.modalCancel}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={styles.modalSave}
                disabled={poRejecting}
                onPress={() => {
                  if (!poRejectItem || !user?.id || !data) return
                  setPoRejecting(true)
                  void rejectPurchaseRequestItem(supabase, {
                    requestId: data.id,
                    requestStatus: data.status,
                    itemId: poRejectItem.id,
                    itemName: poRejectItem.item_name,
                    reason: poRejectReason,
                    userId: user.id,
                  }).then((result) => {
                    setPoRejecting(false)
                    if (!result.ok) {
                      toastSite(result.message)
                      return
                    }
                    setPoRejectItem(null)
                    toastSite('Malzeme reddedildi.')
                    void refetchLegacy()
                  })
                }}
              >
                <Text style={styles.modalSaveText}>{poRejecting ? '...' : 'Reddet'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  emptyStateText: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  deniedTitle: { fontWeight: '700', fontSize: 18, color: '#111827', marginBottom: 8 },
  deniedSub: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  legacyBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
  },
  badgeOk: { backgroundColor: '#F4F4F4' },
  badgeRo: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#0A0A0A' },
  sectionTitle: {
    marginTop: 24,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    color: '#111827',
  },
  itemCard: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  itemMeta: { marginTop: 6, fontSize: 14, color: '#6b7280' },
  purpose: { marginTop: 10, fontSize: 14, color: '#374151', lineHeight: 20 },
  rejectReason: {
    marginTop: 8,
    color: '#7F1D1D',
    backgroundColor: '#FECACA',
    borderRadius: 12,
    padding: 8,
    fontWeight: '600',
  },
  rejectBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#7F1D1D',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rejectBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#111827' },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 10, minHeight: 90 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 12, alignItems: 'center' },
  modalCancel: { color: '#374151', fontWeight: '600' },
  modalSave: { backgroundColor: '#7F1D1D', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  modalSaveText: { color: '#fff', fontWeight: '700' },
  empty: { marginTop: 16, fontSize: 15, color: '#6b7280' },
})
