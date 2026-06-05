import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
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
  const isDepotOfferRole = userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici'
  /** IT Yönetim + web offers ile uyum: department_head ve üst roller tam bundle görür */
  const useOfferBundle =
    isSitePersonnel ||
    isDepotOfferRole ||
    isSiteManager ||
    userRole === 'department_head' ||
    userRole === 'admin' ||
    userRole === 'super_admin' ||
    userRole === 'manager'

  const [returnOpen, setReturnOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState<BundleOrderRow | null>(null)
  const [returnMaterial, setReturnMaterial] = useState<PurchaseRequestItemRow | null>(null)

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

  const { data: legacyData, isLoading: legacyLoading, error: legacyError } = useQuery({
    queryKey: ['purchase_request', requestId, 'legacy'],
    enabled: Boolean(requestId && user?.id && !useOfferBundle),
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

    if (isDepotOfferRole && profile && user?.id) {
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
            {formatRequestNumber((req.request_number as string) ?? null, req.id)} · {req.status || '—'}
            {req.site_name ? ` · ${req.site_name}` : ''}
          </Text>
        </View>
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
          {formatRequestNumber(data.request_number, data.id)} · {data.status}
          {data.site_name ? ` · ${data.site_name}` : ''}
        </Text>
      </View>

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
          </View>
        ))}

        {!items.length ? <Text style={styles.empty}>{t('requestDetail.noItems')}</Text> : null}
      </View>
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
  badgeOk: { backgroundColor: '#f0fdf4' },
  badgeRo: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#047857' },
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
  empty: { marginTop: 16, fontSize: 15, color: '#6b7280' },
})
