import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  markItemDepotNotAvailable,
  sendQuantityFromDepot,
  deletePurchaseRequestItem,
} from '../../../features/santiyeDepo/depotShipments'
import {
  canRemoveDepotMaterial,
  isReturnReorderRequestStatus,
  shouldHideDepotItemStructureButtons,
  shouldShowDepoTrackingSystem,
} from '../../../features/santiyeDepo/santiyeDepoRules'
import type { BundleOrderRow, PurchaseRequestItemRow, RequestOfferBundle, ShipmentInfo } from '../../../lib/requestOfferBundle'
import { supabase } from '../../../lib/supabase'
import { stats, statsFont, statsType } from '../../../theme/statsDesignTokens'

type Props = {
  item: PurchaseRequestItemRow
  itemsCount: number
  bundle: RequestOfferBundle
  userId: string
  onRefresh: () => void
  onToast: (message: string) => void
  /** true: sadece sipariş durumu göster (depo gönderim satırı yok) — şantiye personeli vb. */
  ordersOnly?: boolean
}

function orderTeslimKalan(o: BundleOrderRow): number {
  const d = o.delivered_quantity || 0
  const r = o.returned_quantity || 0
  return Math.max(0, (o.quantity || 0) - d - r)
}

export function DepoMaterialFooterRn({
  item,
  itemsCount,
  bundle,
  userId,
  onRefresh,
  onToast,
  ordersOnly = false,
}: Props) {
  const [sendQty, setSendQty] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const status = bundle.request.status
  const requestId = bundle.request.id
  const shipmentData = bundle.shipmentData as Record<string, ShipmentInfo>
  const materialOrders = bundle.materialOrders.filter((o) => o.material_item_id === item.id)

  const orderOperations = (
    <View style={styles.orderBlock}>
      {materialOrders.length === 0 ? (
        <Text style={styles.orderHint}>Bu kalem için sipariş yok.</Text>
      ) : (
        materialOrders.map((o) => {
            const kalanTeslim = orderTeslimKalan(o)
          return (
            <View key={o.id} style={styles.orderStatusRow}>
              <Text style={styles.orderStatusText}>
                {o.supplier?.name ?? 'Tedarikçi'} · {o.quantity} {item.unit}
                {o.is_delivered ? ' · ✓ Teslim alındı' : ` · ${kalanTeslim} bekliyor`}
              </Text>
            </View>
          )
        })
      )}
    </View>
  )

  if (ordersOnly) {
    if (isReturnReorderRequestStatus(status)) {
      return (
        <View style={styles.bannerMuted}>
          <Text style={styles.bannerMutedText}>Gönderim kapalı — iade yeniden sipariş talebi.</Text>
        </View>
      )
    }
    if (shouldShowDepoTrackingSystem(status)) {
      return orderOperations
    }
    return null
  }

  if (isReturnReorderRequestStatus(status)) {
    return (
      <View style={styles.bannerMuted}>
        <Text style={styles.bannerMutedText}>Gönderim kapalı — iade yeniden sipariş talebi.</Text>
      </View>
    )
  }

  if (shouldShowDepoTrackingSystem(status)) {
    return orderOperations
  }

  const hideStructure = shouldHideDepotItemStructureButtons(shipmentData, item)
  const canRemove = canRemoveDepotMaterial(status) && !hideStructure

  if (hideStructure) {
    return null
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.depotOps}>
      <Text style={styles.depotOpsTitle}>Depo</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.qtyInput}
          value={sendQty}
          onChangeText={setSendQty}
          keyboardType="decimal-pad"
          placeholder={`Miktar · max ${item.quantity}`}
          placeholderTextColor="#9ca3af"
        />
        <Pressable
          style={[styles.btnSend, busy === 'send' && styles.dis]}
          disabled={busy !== null}
          onPress={() =>
            run('send', async () => {
              const q = parseFloat(sendQty.replace(',', '.'))
              const res = await sendQuantityFromDepot(supabase, {
                requestId,
                item,
                sentQuantity: q,
                userId,
              })
              if (!res.ok) {
                onToast(res.message)
                return
              }
              onToast(
                res.newQuantity === 0
                  ? `${item.item_name} tamamen gönderildi`
                  : `Gönderildi. Kalan: ${res.newQuantity} ${item.unit}`
              )
              setSendQty('')
              await onRefresh()
            })
          }
        >
          <Text style={styles.btnSendText}>{busy === 'send' ? '…' : 'Gönder'}</Text>
        </Pressable>
      </View>
      <View style={styles.secondaryRow}>
        <Pressable
          style={[styles.btnSecondary, busy === 'depotno' && styles.dis]}
          disabled={busy !== null}
          onPress={() =>
            run('depotno', async () => {
              const res = await markItemDepotNotAvailable(supabase, {
                requestId,
                item,
                shipmentData,
                userId,
              })
              if (!res.ok) {
                onToast(res.message)
                return
              }
              onToast('Depoda mevcut değil olarak işaretlendi.')
              await onRefresh()
            })
          }
        >
          <Text style={styles.btnSecondaryText}>{busy === 'depotno' ? '…' : 'Depoda yok'}</Text>
        </Pressable>
        {canRemove && itemsCount > 1 ? (
          <Pressable
            style={[styles.btnSecondaryDanger, busy === 'del' && styles.dis]}
            disabled={busy !== null}
            onPress={() =>
              run('del', async () => {
                const res = await deletePurchaseRequestItem(supabase, item.id, itemsCount)
                if (!res.ok) {
                  onToast(res.message)
                  return
                }
                onToast('Malzeme kaldırıldı.')
                await onRefresh()
              })
            }
          >
            <Text style={styles.btnSecondaryDangerText}>{busy === 'del' ? '…' : 'Kaldır'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bannerMuted: {
    marginTop: 12,
    padding: 10,
    backgroundColor: stats.primaryContainer,
    borderRadius: stats.radiusXl,
  },
  bannerMutedText: { ...statsType.labelMd, fontSize: 12, color: stats.onPrimaryContainer },
  orderBlock: {
    marginTop: 14,
    paddingTop: 8,
  },
  orderBlockTitle: {
    ...statsType.labelMd,
    marginBottom: 8,
    color: stats.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  orderStatusRow: {
    paddingVertical: 4,
  },
  orderStatusText: { ...statsType.labelMd, color: stats.onSurfaceVariant },
  orderHint: { ...statsType.labelSm, color: stats.outline },
  depotOps: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  depotOpsTitle: { fontSize: 12, fontWeight: '700', color: '#374151' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  qtyInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  btnSend: {
    minWidth: 96,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
  },
  btnSendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  btnSecondary: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  btnSecondaryText: { color: '#0f172a', fontWeight: '600', fontSize: 13 },
  btnSecondaryDanger: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  btnSecondaryDangerText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnDark: { backgroundColor: '#111827' },
  btnDarkText: { color: '#fff', fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  btnOutlineText: { color: '#0f172a', fontWeight: '600' },
  btnDanger: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  btnDangerText: { color: '#b91c1c', fontWeight: '700' },
  dis: { opacity: 0.55 },
})
