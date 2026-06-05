import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SignedSatinalmaImageRn } from '../common/SignedSatinalmaImageRn'
import { partitionPurchaseRequestImageUrls } from '../../features/santiyeDepo/orderDelivery'
import type { BundleOrderRow, PurchaseRequestItemRow, ShipmentInfo } from '../../lib/requestOfferBundle'
import { stats, statsCardSurface, statsFont, statsType } from '../../theme/statsDesignTokens'

/** Sipariş satırı teslim+iade ile kapatılmış mı (is_delivered veya miktar dengesi) */
export function orderDeliverySettled(o: BundleOrderRow): boolean {
  if (o.is_delivered) return true
  const q = o.quantity || 0
  if (q <= 0) return true
  const d = o.delivered_quantity || 0
  const r = o.returned_quantity || 0
  return d + r >= q - 1e-9
}

type Props = {
  request: {
    id: string
    status: string | null
    request_number?: string | null
    title?: string | null
    site_name?: string | null
    image_urls?: string[] | null
    purchase_request_items?: PurchaseRequestItemRow[]
  }
  materialOrders: BundleOrderRow[]
  shipmentData: Record<string, ShipmentInfo>
  canEdit: boolean
  readOnly?: boolean
  onEditPress: () => void
  sectionTitle?: string
  sectionSub?: string
  /** true ise malzeme bloğundaki başlık ve açıklama satırları gösterilmez (örn. depo görünümü). */
  hideMaterialSectionHeader?: boolean
  renderItemFooter?: (item: PurchaseRequestItemRow, index: number) => ReactNode | null
}

function getMaterialDeliveryStatus(itemId: string, materialOrders: BundleOrderRow[]) {
  const materialOrdersForItem = materialOrders.filter((o) => o.material_item_id === itemId)
  if (materialOrdersForItem.length === 0) {
    return {
      hasOrders: false,
      allDelivered: false,
      someDelivered: false as const,
      deliveredCount: 0,
      totalCount: 0,
      hasPartialQuantity: false,
    }
  }
  const totalCount = materialOrdersForItem.length
  const settledCount = materialOrdersForItem.filter(orderDeliverySettled).length
  const sumDelivered = materialOrdersForItem.reduce((s, o) => s + (o.delivered_quantity || 0), 0)
  const allDelivered = settledCount === totalCount
  const hasPartialQuantity = !allDelivered && sumDelivered > 0 && settledCount === 0
  return {
    hasOrders: true,
    allDelivered,
    someDelivered: settledCount > 0 || hasPartialQuantity,
    deliveredCount: settledCount,
    totalCount,
    hasPartialQuantity,
  }
}

/** Tedarik metrikleri — tek panelde satır düzeni (iç içe kutu yok) */
function MetricRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={metricStyles.row}>
      <View style={metricStyles.rowLabelCol}>
        <Text style={metricStyles.rowLabel}>{label}</Text>
        {sub ? <Text style={metricStyles.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={metricStyles.rowValue}>{value}</Text>
    </View>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={detailBlockStyles.section}>
      <Text style={detailBlockStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g

function parseTextWithLinks(text: string): Array<{ type: 'text' | 'link'; content: string }> {
  const parts: Array<{ type: 'text' | 'link'; content: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'link', content: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }]
}

function DetailRow({
  label,
  value,
  isLast,
  multiline,
}: {
  label: string
  value: string
  isLast?: boolean
  multiline?: boolean
}) {
  const parts = useMemo(() => parseTextWithLinks(value), [value])
  const hasLinks = parts.some((p) => p.type === 'link')

  return (
    <View style={[detailBlockStyles.row, isLast ? detailBlockStyles.rowLast : null]}>
      <Text style={detailBlockStyles.rowLabel}>{label}</Text>
      <Text style={multiline ? detailBlockStyles.rowValueMulti : detailBlockStyles.rowValue}>
        {hasLinks
          ? parts.map((part, i) =>
              part.type === 'link' ? (
                <Text
                  key={i}
                  style={detailBlockStyles.linkText}
                  onPress={() => Linking.openURL(part.content)}
                >
                  {part.content}
                </Text>
              ) : (
                <Text key={i}>{part.content}</Text>
              )
            )
          : value}
      </Text>
    </View>
  )
}

function formatMaterialCatalogLine(item: PurchaseRequestItemRow): string {
  const parts = [
    item.material_item_name,
    item.material_group,
    item.material_group_code,
    item.material_class,
  ].filter((p): p is string => Boolean(p && String(p).trim()))
  return parts.join(' · ')
}

const metricStyles = StyleSheet.create({
  panel: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  rowLabelCol: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  rowSub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    maxWidth: '46%',
  },
})

const detailBlockStyles = StyleSheet.create({
  section: {
    marginTop: 18,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  rowValue: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  rowValueMulti: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
    marginTop: 2,
  },
  linkText: {
    color: '#01E884',
    textDecorationLine: 'underline',
  },
})

export function SitePersonnelTrackingRn({
  request,
  materialOrders,
  shipmentData,
  canEdit,
  readOnly = false,
  onEditPress,
  sectionTitle,
  sectionSub,
  hideMaterialSectionHeader = false,
  renderItemFooter,
}: Props) {
  const items = request.purchase_request_items ?? []
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null)

  const { irsaliye: irsaliyeUrls, other: requestLevelNonIrsaliyeUrls } = useMemo(
    () => partitionPurchaseRequestImageUrls(request.id, request.image_urls),
    [request.id, request.image_urls]
  )

  if (!items.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Bu talepte malzeme kalemi yok.</Text>
      </View>
    )
  }

  const showSupplierSection =
    request.status === 'sipariş verildi' ||
    request.status === 'kısmen teslim alındı' ||
    request.status === 'teslim alındı' ||
    request.status === 'iade var'

  const hasEdit = !readOnly && canEdit
  const showTitles = !hideMaterialSectionHeader

  return (
    <View style={styles.scroll}>
      {showTitles ? (
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{sectionTitle ?? 'Malzeme kalemleri'}</Text>
            <Text style={styles.sectionSub}>
              {sectionSub ?? 'Ürün bilgileri ve şantiye / tedarik durumu'}
            </Text>
          </View>
        </View>
      ) : null}


      {items.map((item, index) => {
        const deliveryStatus = getMaterialDeliveryStatus(item.id, materialOrders)
        const itemShipments = shipmentData[item.id]
        const depoShipped = itemShipments?.total_shipped ?? 0
        const shipmentCount = itemShipments?.shipments?.length ?? 0

        const itemOrders = materialOrders.filter((o) => o.material_item_id === item.id)
        const totalOrdered = itemOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
        const orderCount = itemOrders.length
        const deliveredOrdCount = itemOrders.filter(orderDeliverySettled).length

        const itemImages =
          Array.isArray(item.image_urls) && item.image_urls.length > 0
            ? item.image_urls
            : index === 0 && requestLevelNonIrsaliyeUrls.length > 0
              ? requestLevelNonIrsaliyeUrls
              : []

        const nearestDeliveryDate = itemOrders
          .map((o) => o.delivery_date)
          .filter(Boolean)
          .sort()[0] as string | undefined

        let deliveryMeta = 'Sipariş yok'
        let deliverySub = '—'
        if (nearestDeliveryDate) {
          const deliveryDate = new Date(nearestDeliveryDate)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          deliveryDate.setHours(0, 0, 0, 0)
          const diffDays = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < 0) deliverySub = `${Math.abs(diffDays)} gün geçti`
          else if (diffDays === 0) deliverySub = 'Bugün'
          else deliverySub = `${diffDays} gün kaldı`
          deliveryMeta = deliveryDate.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        }

        const supplierGroups = itemOrders.reduce<
          Record<
            string,
            {
              supplier: BundleOrderRow['supplier']
              name: string
              orders: BundleOrderRow[]
              totalQuantity: number
              totalDelivered: number
            }
          >
        >((groups, order) => {
          const supplierId = order.supplier?.id || 'unknown'
          const supplierName = order.supplier?.name || 'Bilinmeyen tedarikçi'
          if (!groups[supplierId]) {
            groups[supplierId] = {
              supplier: order.supplier,
              name: supplierName,
              orders: [],
              totalQuantity: 0,
              totalDelivered: 0,
            }
          }
          groups[supplierId].orders.push(order)
          groups[supplierId].totalQuantity += order.quantity || 0
          groups[supplierId].totalDelivered += order.delivered_quantity || 0
          return groups
        }, {})

        const suppliers = Object.values(supplierGroups)

        const catalogLine = formatMaterialCatalogLine(item)
        const brandDisplay = item.brand?.trim() ? item.brand.trim() : 'Belirtilmemiş'
        const purposeDisplay = item.purpose?.trim() ? item.purpose.trim() : 'Belirtilmemiş'
        const descDisplay = item.description?.trim() ? item.description.trim() : 'Belirtilmemiş'

        type ProductRowSpec = { label: string; value: string; multiline?: boolean }
        const productRows: ProductRowSpec[] = [{ label: 'Marka', value: brandDisplay }]
        if (catalogLine) {
          productRows.push({ label: 'Malzeme sınıflandırması', value: catalogLine })
        }
        productRows.push({ label: 'Kullanım amacı', value: purposeDisplay })
        if (item.delivery_date) {
          productRows.push({
            label: 'İstenen teslim tarihi',
            value: new Date(item.delivery_date).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          })
        }
        productRows.push({ label: 'Açıklama', value: descDisplay, multiline: true })
        if (item.specifications?.trim()) {
          productRows.push({
            label: 'Teknik özellikler',
            value: item.specifications.trim(),
            multiline: true,
          })
        }

        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  {items.length > 1 ? (
                    <View style={styles.indexBadge}>
                      <Text style={styles.indexBadgeText}>{index + 1}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.itemTitle}>{item.item_name}</Text>
                </View>

                <DetailSection title="Ürün bilgileri">
                  {productRows.map((row, ri) => (
                    <DetailRow
                      key={`${row.label}-${ri}`}
                      label={row.label}
                      value={row.value}
                      multiline={row.multiline}
                      isLast={ri === productRows.length - 1}
                    />
                  ))}
                </DetailSection>

                {itemImages.length > 0 ? (
                  <View style={styles.imgSection}>
                    <Text style={styles.imgLabel}>Ek görseller</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {itemImages.slice(0, 12).map((url, imgI) => (
                        <Pressable
                          key={`${url}-${imgI}`}
                          onPress={() => setFullscreenImageUri(url)}
                        >
                          <SignedSatinalmaImageRn uri={url} style={styles.thumb} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View style={styles.statusCol}>
                {!deliveryStatus.hasOrders ? (
                  <View style={styles.chipGray}>
                    <Text style={styles.chipGrayText}>Sipariş yok</Text>
                  </View>
                ) : deliveryStatus.allDelivered ? (
                  <View style={styles.chipOk}>
                    <Text style={styles.chipOkText}>Teslim alındı</Text>
                  </View>
                ) : deliveryStatus.deliveredCount > 0 ? (
                  <View style={styles.chipGray}>
                    <Text style={styles.chipGrayText}>
                      {deliveryStatus.deliveredCount}/{deliveryStatus.totalCount} teslim
                    </Text>
                  </View>
                ) : deliveryStatus.hasPartialQuantity ? (
                  <View style={styles.chipGray}>
                    <Text style={styles.chipGrayText}>Kısmi teslim</Text>
                  </View>
                ) : (
                  <View style={styles.chipGray}>
                    <Text style={styles.chipGrayText}>Beklemede</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={metricStyles.panel}>
              <Text style={metricStyles.panelTitle}>Tedarik özeti</Text>
              <MetricRow
                label="İlk talep miktarı"
                value={`${(item.original_quantity ?? item.quantity).toFixed(2)} ${item.unit}`}
              />
              <MetricRow
                label="Depodan çıkan"
                value={`${depoShipped.toFixed(2)} ${item.unit}`}
                sub={
                  shipmentCount > 0
                    ? `${shipmentCount} gönderim kaydı`
                    : depoShipped > 0
                      ? undefined
                      : 'Henüz şantiyeye çıkış yok'
                }
              />
              <MetricRow
                label="Siparişteki miktar"
                value={`${totalOrdered.toFixed(2)} ${item.unit}`}
                sub={
                  orderCount > 0
                    ? formatOrderSubline(orderCount, deliveredOrdCount, item.unit)
                    : 'Henüz sipariş oluşmadı'
                }
              />
              <MetricRow
                label="Planlı teslim tarihi"
                value={nearestDeliveryDate ? deliveryMeta : '—'}
                sub={
                  nearestDeliveryDate
                    ? deliverySub
                    : orderCount > 0
                      ? 'Tarih siparişe işlendiğinde görünür'
                      : undefined
                }
              />
            </View>

            {showSupplierSection ? (
              <View style={styles.supplierSection}>
                <Text style={styles.supplierTitle}>Tedarikçiler</Text>
                {suppliers.length === 0 ? (
                  <Text style={styles.supplierEmpty}>Bu kalem için henüz sipariş kaydı bulunmuyor.</Text>
                ) : (
                  suppliers.map((sup, si) => (
                    <View key={`${sup.name}-${si}`} style={styles.supplierCard}>
                      <Text style={styles.supplierName}>{sup.name}</Text>
                      <View style={styles.supplierRow}>
                        <Text style={styles.supplierLbl}>Sipariş</Text>
                        <Text style={styles.supplierVal}>
                          {sup.totalQuantity.toFixed(2)} {item.unit}
                        </Text>
                      </View>
                      <View style={styles.supplierRow}>
                        <Text style={styles.supplierLbl}>Teslim</Text>
                        <Text style={styles.supplierVal}>
                          {sup.totalDelivered.toFixed(2)} {item.unit}
                        </Text>
                      </View>
                      <View style={styles.supplierRow}>
                        <Text style={styles.supplierLbl}>Kalan</Text>
                        <Text style={styles.supplierVal}>
                          {(sup.totalQuantity - sup.totalDelivered).toFixed(2)} {item.unit}
                        </Text>
                      </View>
                      {(sup.supplier?.contact_person || sup.supplier?.phone) && (
                        <View style={styles.contactBox}>
                          <Text style={styles.contactTitle}>İletişim</Text>
                          {sup.supplier?.contact_person ? (
                            <Text style={styles.contactLine}>Kişi: {sup.supplier.contact_person}</Text>
                          ) : null}
                          {sup.supplier?.phone ? (
                            <Text style={styles.contactLine}>Tel: {sup.supplier.phone}</Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {renderItemFooter?.(item, index)}
          </View>
        )
      })}

      {/* Fullscreen Image Modal */}
      <Modal
        visible={Boolean(fullscreenImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImageUri(null)}
      >
        <View style={styles.fullscreenOverlay}>
          <Pressable
            style={styles.fullscreenBackdrop}
            onPress={() => setFullscreenImageUri(null)}
          />
          <View style={[styles.fullscreenImageContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {fullscreenImageUri ? (
              <SignedSatinalmaImageRn
                uri={fullscreenImageUri}
                style={[styles.fullscreenImage, { width: screenWidth - 32, height: screenHeight * 0.7 }]}
                resizeMode="contain"
              />
            ) : null}
          </View>
          <Pressable
            style={[styles.fullscreenCloseBtn, { top: insets.top + 16 }]}
            onPress={() => setFullscreenImageUri(null)}
          >
            <Text style={styles.fullscreenCloseBtnText}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}

function formatOrderSubline(orderCount: number, deliveredOrdCount: number, unit: string): string {
  if (orderCount > 0) {
    if (deliveredOrdCount === orderCount) return `${unit} · Tamamlandı`
    if (deliveredOrdCount > 0) return `${unit} · ${deliveredOrdCount}/${orderCount}`
    return `${unit} · ${orderCount} bekliyor`
  }
  return unit
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  emptyWrap: { paddingVertical: 32, paddingHorizontal: 20 },
  emptyText: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 26,
    color: '#111827',
  },
  sectionSub: { fontSize: 14, color: '#6b7280', marginTop: 6 },
  editBtn: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: '#ffffff',
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    marginBottom: 14,
    borderRadius: 20,
  },
  irsaliyeCard: {
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#f0fdf4',
  },
  irsaliyeTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
  },
  irsaliyeSub: { fontSize: 14, color: '#6b7280', marginTop: 6, marginBottom: 12 },
  irsaliyeScroll: { marginHorizontal: -4 },
  irsaliyeThumb: {
    width: 88,
    height: 88,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#01E884',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadgeText: { color: '#111827', fontWeight: '700', fontSize: 13 },
  itemTitle: {
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 24,
    color: '#111827',
    flex: 1,
  },
  imgSection: { marginTop: 16 },
  imgLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: '#f3f4f6',
  },
  chipGray: {
    alignSelf: 'flex-end',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipGrayText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  chipOk: {
    alignSelf: 'flex-end',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  chipOkText: { fontSize: 12, fontWeight: '700', color: '#047857' },
  statusCol: { justifyContent: 'flex-start', paddingTop: 2 },
  supplierSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  supplierTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  supplierEmpty: {
    fontSize: 14,
    textAlign: 'center',
    color: '#9ca3af',
    padding: 16,
  },
  supplierCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  supplierName: { fontWeight: '700', fontSize: 15, color: '#111827', marginBottom: 10 },
  supplierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  supplierLbl: { fontSize: 14, color: '#6b7280' },
  supplierVal: { fontSize: 14, fontWeight: '600', color: '#111827' },
  contactBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  contactTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  contactLine: { fontSize: 14, color: '#111827', marginBottom: 4 },
  infoFoot: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 12,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#01E884',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: { color: '#111827', fontSize: 14, fontWeight: '700' },
  infoTitle: { fontWeight: '700', fontSize: 14, color: '#111827' },
  infoBody: { fontSize: 14, color: '#6b7280', marginTop: 4, lineHeight: 20 },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  fullscreenImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    borderRadius: 12,
    backgroundColor: '#000',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtnText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
})
