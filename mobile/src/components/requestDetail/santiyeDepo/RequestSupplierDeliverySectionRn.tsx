import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  isReturnReorderRequestStatus,
  shouldShowDepoTrackingSystem,
} from '../../../features/santiyeDepo/santiyeDepoRules'
import type { BundleOrderRow, PurchaseRequestItemRow, RequestOfferBundle } from '../../../lib/requestOfferBundle'
import { stats, statsFont } from '../../../theme/statsDesignTokens'
import { SupplierGroupDeliveryModalRn, type SupplierDeliveryLine, type SupplierGroup } from './SupplierGroupDeliveryModalRn'

function orderTeslimKalan(o: BundleOrderRow): number {
  const d = o.delivered_quantity || 0
  const r = o.returned_quantity || 0
  return Math.max(0, (o.quantity || 0) - d - r)
}

type Props = {
  bundle: RequestOfferBundle
  onSuccess: () => void
  externalOpenKey?: string | null
  onExternalOpenChange?: (key: string | null) => void
  onOpenReturn?: (order: BundleOrderRow, material: PurchaseRequestItemRow) => void
}


type ReturnableOrder = {
  order: BundleOrderRow
  material: PurchaseRequestItemRow
  maxReturn: number
}

function buildSupplierGroups(bundle: RequestOfferBundle): SupplierGroup[] {
  const items = bundle.request.purchase_request_items ?? []
  const byId = new Map(items.map((i) => [i.id, i] as const))
  const map = new Map<string, SupplierDeliveryLine[]>()

  for (const order of bundle.materialOrders) {
    if (!order.material_item_id || order.is_delivered) continue
    const kalan = orderTeslimKalan(order)
    if (kalan <= 0) continue
    const material = byId.get(order.material_item_id)
    if (!material) continue
    const sid = order.supplier_id || order.supplier?.id || '_'
    const name = order.supplier?.name?.trim() || 'Tedarikçi'
    if (!map.has(sid)) map.set(sid, [])
    map.get(sid)!.push({ order, material })
  }

  const out: SupplierGroup[] = []
  for (const [key, lines] of map) {
    if (lines.length === 0) continue
    const supplierName = lines[0]?.order.supplier?.name?.trim() || 'Tedarikçi'
    out.push({ key, supplierName: key === '_' ? supplierName || 'Tedarikçi' : supplierName, lines })
  }
  return out.sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'tr'))
}

function buildReturnableOrders(bundle: RequestOfferBundle): ReturnableOrder[] {
  const items = bundle.request.purchase_request_items ?? []
  const byId = new Map(items.map((i) => [i.id, i] as const))
  const out: ReturnableOrder[] = []

  for (const order of bundle.materialOrders) {
    if (!order.material_item_id) continue
    const quantity = order.quantity || 0
    const returned = order.returned_quantity || 0
    const maxReturn = Math.max(0, quantity - returned)
    if (maxReturn <= 0) continue
    const material = byId.get(order.material_item_id)
    if (!material) continue
    out.push({ order, material, maxReturn })
  }
  return out
}

export function RequestSupplierDeliverySectionRn({ bundle, onSuccess, externalOpenKey, onExternalOpenChange, onOpenReturn }: Props) {
  const status = bundle.request.status ?? null
  const show =
    shouldShowDepoTrackingSystem(status) && !isReturnReorderRequestStatus(status)

  const groups = useMemo(() => (show ? buildSupplierGroups(bundle) : []), [bundle, show])
  const returnableOrders = useMemo(() => (show ? buildReturnableOrders(bundle) : []), [bundle, show])

  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)

  // Backward compat için external key desteği
  const externalOpen = externalOpenKey !== undefined && externalOpenKey !== null
  const isOpen = externalOpen || deliveryModalOpen
  const handleClose = () => {
    if (onExternalOpenChange) onExternalOpenChange(null)
    setDeliveryModalOpen(false)
  }

  const hasDeliveries = groups.length > 0
  const hasReturns = returnableOrders.length > 0
  const totalLines = groups.reduce((sum, g) => sum + g.lines.length, 0)

  if (!show || (!hasDeliveries && !hasReturns)) return null

  const reqId = bundle.request.id
  const reqNo = (bundle.request.request_number as string | null) ?? null

  const firstReturnOrder = returnableOrders[0]

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sipariş İşlemleri</Text>
        
        <View style={styles.buttonsContainer}>
          {/* Teslim Al - Üstte */}
          {hasDeliveries ? (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
              onPress={() => setDeliveryModalOpen(true)}
            >
              <Text style={styles.btnPrimaryText}>Teslim Al</Text>
              <Text style={styles.btnSubtext}>
                {groups.length > 1 
                  ? `${groups.length} tedarikçi · ${totalLines} kalem bekliyor`
                  : `${totalLines} kalem bekliyor`
                }
              </Text>
            </Pressable>
          ) : null}

          {/* İade - Altta */}
          {hasReturns && onOpenReturn && firstReturnOrder ? (
            <Pressable
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnSecondaryPressed]}
              onPress={() => onOpenReturn(firstReturnOrder.order, firstReturnOrder.material)}
            >
              <Text style={styles.btnSecondaryText}>İade Et</Text>
              <Text style={styles.btnSecondarySubtext}>{returnableOrders.length} kalem iade edilebilir</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <SupplierGroupDeliveryModalRn
        visible={isOpen && hasDeliveries}
        onClose={handleClose}
        onSuccess={() => {
          handleClose()
          onSuccess()
        }}
        purchaseRequestId={reqId}
        requestNumber={reqNo}
        groups={groups}
      />
    </>
  )
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: stats.marginMobile,
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: statsFont.bold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: stats.onSurface,
    marginBottom: 12,
  },
  buttonsContainer: {
    gap: 10,
  },
  btnPrimary: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: stats.primary,
  },
  btnPrimaryText: {
    fontFamily: statsFont.bold,
    fontSize: 16,
    color: stats.onPrimary,
  },
  btnSubtext: {
    fontFamily: statsFont.medium,
    fontSize: 13,
    color: stats.onPrimary,
    opacity: 0.8,
    marginTop: 2,
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  btnSecondary: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: stats.error,
    backgroundColor: '#ffffff',
  },
  btnSecondaryPressed: { opacity: 0.9, transform: [{ scale: 0.99 }], backgroundColor: '#fef2f2' },
  btnSecondaryText: {
    fontFamily: statsFont.bold,
    fontSize: 16,
    color: stats.error,
  },
  btnSecondarySubtext: {
    fontFamily: statsFont.medium,
    fontSize: 13,
    color: stats.error,
    opacity: 0.7,
    marginTop: 2,
  },
})
