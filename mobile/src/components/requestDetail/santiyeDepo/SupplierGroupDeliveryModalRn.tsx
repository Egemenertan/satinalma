import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { SwipeDismissSheet } from '../../island/SwipeDismissSheet'

let DocumentScanner: { scanDocument: (opts?: { maxNumDocuments?: number }) => Promise<{ scannedImages?: string[] }> } | null = null
try {
  DocumentScanner = require('react-native-document-scanner-plugin').default
} catch {
  DocumentScanner = null
}
import type { BundleOrderRow, PurchaseRequestItemRow } from '../../../lib/requestOfferBundle'
import {
  appendIrsaliyeUrlsToPurchaseRequest,
  createOrderDeliveryRpc,
  uploadIrsaliyePhotoUris,
} from '../../../features/santiyeDepo/orderDelivery'
import { supabase } from '../../../lib/supabase'
import { stats, statsFont, statsType } from '../../../theme/statsDesignTokens'
import { useTranslation } from 'react-i18next'

export type SupplierDeliveryLine = {
  order: BundleOrderRow
  material: PurchaseRequestItemRow
}

export type SupplierGroup = {
  key: string
  supplierName: string
  lines: SupplierDeliveryLine[]
}

type Props = {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  purchaseRequestId: string
  requestNumber: string | null
  /** @deprecated Tek tedarikçi için backward compat */
  supplierName?: string
  /** @deprecated Tek tedarikçi için backward compat */
  lines?: SupplierDeliveryLine[]
  /** Birden fazla tedarikçi grubu için */
  groups?: SupplierGroup[]
}

function lineMaxQty(order: BundleOrderRow): number {
  const d = order.delivered_quantity || 0
  const r = order.returned_quantity || 0
  return Math.max(0, (order.quantity || 0) - d - r)
}

export function SupplierGroupDeliveryModalRn({
  visible,
  onClose,
  onSuccess,
  purchaseRequestId,
  requestNumber,
  supplierName,
  lines,
  groups: groupsProp,
}: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  const sheetBodyHeight = Math.round(winH * 0.92)
  const footerPad = useMemo(() => Math.max(insets.bottom, 20) + 24, [insets.bottom])

  // Backward compat: eğer groups yoksa lines'dan tek grup oluştur
  const groups = useMemo<SupplierGroup[]>(() => {
    if (groupsProp && groupsProp.length > 0) return groupsProp
    if (lines && lines.length > 0) {
      return [{ key: '_single', supplierName: supplierName || 'Tedarikçi', lines }]
    }
    return []
  }, [groupsProp, lines, supplierName])

  // Tüm lines'ı düzleştir
  const allLines = useMemo(() => groups.flatMap((g) => g.lines), [groups])

  // Tek tedarikçi mi çok tedarikçi mi?
  const isSingleSupplier = groups.length === 1
  const totalLineCount = allLines.length

  const [qtyByOrderId, setQtyByOrderId] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [damageNotes, setDamageNotes] = useState('')
  const [qualityOk, setQualityOk] = useState(true)
  // Her tedarikçi için ayrı fotoğraf listesi: { supplierKey: string[] }
  const [urisBySupplier, setUrisBySupplier] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)

  const displayReqNo = requestNumber?.trim() || purchaseRequestId.slice(-8)

  useEffect(() => {
    if (!visible || allLines.length === 0) return
    setQtyByOrderId((prev) => {
      const next = { ...prev }
      for (const { order } of allLines) {
        if (next[order.id] === undefined) next[order.id] = ''
      }
      return next
    })
  }, [visible, allLines])

  const reset = useCallback(() => {
    setQtyByOrderId({})
    setNotes('')
    setDamageNotes('')
    setQualityOk(true)
    setUrisBySupplier({})
  }, [])

  const close = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const getSupplierUris = useCallback((supplierKey: string) => {
    return urisBySupplier[supplierKey] ?? []
  }, [urisBySupplier])

  const pickImagesForSupplier = useCallback(async (supplierKey: string) => {
    const currentUris = urisBySupplier[supplierKey] ?? []
    if (currentUris.length >= 5) return

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('supplierDelivery.permissionTitle'), t('supplierDelivery.galleryBody'))
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 5 - currentUris.length,
    })
    if (res.canceled) return
    const next = res.assets.map((a) => a.uri).filter(Boolean) as string[]
    setUrisBySupplier((prev) => ({
      ...prev,
      [supplierKey]: [...(prev[supplierKey] ?? []), ...next].slice(0, 5),
    }))
  }, [urisBySupplier, t])

  const scanDocumentForSupplier = useCallback(async (supplierKey: string) => {
    const currentUris = urisBySupplier[supplierKey] ?? []
    if (currentUris.length >= 5) return
    
    const fallbackToCamera = async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t('supplierDelivery.permissionTitle'), t('supplierDelivery.cameraBody'))
        return
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.85 })
      if (res.canceled) return
      const uri = res.assets[0]?.uri
      if (uri) {
        setUrisBySupplier((prev) => ({
          ...prev,
          [supplierKey]: [...(prev[supplierKey] ?? []), uri].slice(0, 5),
        }))
      }
    }

    if (!DocumentScanner) {
      await fallbackToCamera()
      return
    }

    try {
      const result = await DocumentScanner.scanDocument({
        maxNumDocuments: Math.min(5 - currentUris.length, 3),
      })
      const scanned = result.scannedImages ?? []
      if (scanned.length > 0) {
        setUrisBySupplier((prev) => ({
          ...prev,
          [supplierKey]: [...(prev[supplierKey] ?? []), ...scanned].slice(0, 5),
        }))
      }
    } catch {
      await fallbackToCamera()
    }
  }, [urisBySupplier, t])

  const removeUriForSupplier = useCallback((supplierKey: string, idx: number) => {
    setUrisBySupplier((prev) => ({
      ...prev,
      [supplierKey]: (prev[supplierKey] ?? []).filter((_, i) => i !== idx),
    }))
  }, [])

  const submit = useCallback(async () => {
    if (allLines.length === 0) return

    // Her tedarikçi için en az 1 fotoğraf kontrolü (miktar girilmişse)
    for (const group of groups) {
      const groupUris = urisBySupplier[group.key] ?? []
      const hasQtyForGroup = group.lines.some(({ order }) => {
        const raw = (qtyByOrderId[order.id] || '').trim().replace(',', '.')
        return raw && parseFloat(raw) > 0
      })
      if (hasQtyForGroup && groupUris.length === 0) {
        Alert.alert(
          t('supplierDelivery.receiveTitle'),
          `${group.supplierName} için en az 1 irsaliye fotoğrafı eklemelisiniz.`
        )
        return
      }
    }

    // Tedarikçiye göre deliveries oluştur
    const deliveriesBySupplier: Record<string, { order: BundleOrderRow; material: PurchaseRequestItemRow; qty: number }[]> = {}
    for (const group of groups) {
      for (const { order, material } of group.lines) {
        const raw = (qtyByOrderId[order.id] || '').trim().replace(',', '.')
        if (!raw) continue
        const q = parseFloat(raw)
        if (q <= 0) continue
        const maxQ = lineMaxQty(order)
        if (q > maxQ) {
          Alert.alert(
            t('supplierDelivery.receiveTitle'),
            t('supplierDelivery.maxQtyBody', {
              name: material.item_name,
              max: maxQ.toFixed(2),
              unit: material.unit,
            })
          )
          return
        }
        if (!deliveriesBySupplier[group.key]) deliveriesBySupplier[group.key] = []
        deliveriesBySupplier[group.key].push({ order, material, qty: q })
      }
    }

    const allDeliveries = Object.values(deliveriesBySupplier).flat()
    if (allDeliveries.length === 0) {
      Alert.alert(t('supplierDelivery.receiveTitle'), t('supplierDelivery.minLineQtyBody'))
      return
    }

    let { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      session = refreshData.session
    }
    const user = session?.user
    if (!user) {
      Alert.alert(t('supplierDelivery.receiveTitle'), t('supplierDelivery.noSessionBody'))
      return
    }

    const baseNote = t('supplierDelivery.notePrefix', { req: displayReqNo })
    const deliveryNotes = [baseNote, notes.trim() || null].filter(Boolean).join(' — ') || baseNote

    setBusy(true)
    try {
      // Tüm fotoğrafları birleştir ve yükle
      const allUris = Object.values(urisBySupplier).flat()
      const up = await uploadIrsaliyePhotoUris(supabase, allUris, purchaseRequestId)
      if (!up.ok) {
        Alert.alert(t('supplierDelivery.receiveTitle'), up.message)
        return
      }

      // Her tedarikçi için fotoğraf URL'lerini hesapla
      const urlsBySupplier: Record<string, string[]> = {}
      let urlIdx = 0
      for (const group of groups) {
        const groupUriCount = (urisBySupplier[group.key] ?? []).length
        urlsBySupplier[group.key] = up.urls.slice(urlIdx, urlIdx + groupUriCount)
        urlIdx += groupUriCount
      }

      // Her delivery için ilgili tedarikçinin fotoğraflarını kullan
      for (const group of groups) {
        const groupDeliveries = deliveriesBySupplier[group.key] ?? []
        const groupUrls = urlsBySupplier[group.key] ?? []
        
        for (const { order, qty } of groupDeliveries) {
          const rpc = await createOrderDeliveryRpc(supabase, {
            orderId: order.id,
            deliveredQuantity: qty,
            userId: user.id,
            deliveryNotes,
            photoUrls: groupUrls,
            qualityCheck: qualityOk,
            damageNotes: damageNotes.trim() || null,
          })
          if (!rpc.ok) {
            Alert.alert(t('supplierDelivery.receiveTitle'), rpc.message)
            return
          }
        }
      }

      const append = await appendIrsaliyeUrlsToPurchaseRequest(supabase, purchaseRequestId, up.urls)
      if (!append.ok) {
        Alert.alert(t('supplierDelivery.receiveTitle'), append.message)
        return
      }

      Alert.alert(t('supplierDelivery.receiveTitle'), t('supplierDelivery.savedManyBody', { count: allDeliveries.length }))
      onSuccess()
      close()
    } finally {
      setBusy(false)
    }
  }, [
    allLines,
    groups,
    qtyByOrderId,
    urisBySupplier,
    notes,
    damageNotes,
    qualityOk,
    purchaseRequestId,
    displayReqNo,
    onSuccess,
    close,
    t,
  ])

  if (!visible || allLines.length === 0) return null

  return (
    <SwipeDismissSheet visible={visible} onRequestClose={close} title={null} maxHeightRatio={0.94}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheetRoot, { height: sheetBodyHeight, maxHeight: sheetBodyHeight }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.innerHost}>
          <View style={styles.sheetColumnMain}>
            <View style={styles.sheetHeader}>
              <Text style={styles.title}>Teslim al</Text>
              <Text style={styles.sub} numberOfLines={2}>
                {isSingleSupplier ? groups[0].supplierName : `${groups.length} tedarikçi`} · {totalLineCount} kalem
              </Text>
              <Text style={styles.tagIrsaliye}>İrsaliye görselleri talep kaydına eklenir ({displayReqNo})</Text>
            </View>

            <ScrollView
              style={styles.scrollFlex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {groups.map((group, groupIdx) => {
                const groupUris = getSupplierUris(group.key)
                return (
                  <View key={group.key}>
                    {/* Tedarikçi ayırıcı - birden fazla tedarikçi varsa göster */}
                    {!isSingleSupplier && groupIdx > 0 && <View style={styles.supplierDivider} />}
                    
                    {/* Tedarikçi başlığı */}
                    {!isSingleSupplier && (
                      <View style={styles.supplierHeader}>
                        <View style={styles.supplierBadge}>
                          <Text style={styles.supplierBadgeText}>{group.supplierName}</Text>
                        </View>
                        <Text style={styles.supplierLineCount}>{group.lines.length} kalem</Text>
                      </View>
                    )}
                    
                    {/* Malzemeler */}
                    {group.lines.map(({ order, material }) => {
                      const maxQ = lineMaxQty(order)
                      return (
                        <View key={order.id} style={styles.lineCard}>
                          <Text style={styles.lineTitle} numberOfLines={2}>
                            {material.item_name}
                          </Text>
                          <Text style={styles.lineHint}>
                            Kalan: {maxQ.toFixed(2)} {material.unit} (sip. {order.quantity?.toFixed(2) ?? order.quantity})
                          </Text>
                          <Text style={styles.fieldLbl}>Teslim alınan</Text>
                          <TextInput
                            style={styles.input}
                            value={qtyByOrderId[order.id] ?? ''}
                            onChangeText={(txt) => setQtyByOrderId((m) => ({ ...m, [order.id]: txt }))}
                            keyboardType="decimal-pad"
                            placeholder={`0 — max ${maxQ.toFixed(2)}`}
                            placeholderTextColor={stats.outline}
                            editable={!busy}
                          />
                        </View>
                      )
                    })}

                    {/* Her tedarikçi için ayrı fotoğraf alanı */}
                    <View style={styles.photoSection}>
                      <Text style={styles.fieldLbl}>
                        {isSingleSupplier ? 'İrsaliye fotoğrafları' : `${group.supplierName} - İrsaliye`} ({groupUris.length}/5)
                      </Text>
                      <View style={styles.photoActions}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.photoActBtn,
                            (busy || groupUris.length >= 5) && styles.dis,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => pickImagesForSupplier(group.key)}
                          disabled={busy || groupUris.length >= 5}
                        >
                          <Text style={styles.photoActText}>Galeri</Text>
                        </Pressable>
                        {Platform.OS !== 'web' ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.photoActBtn,
                              DocumentScanner ? styles.scanBtn : null,
                              (busy || groupUris.length >= 5) && styles.dis,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => scanDocumentForSupplier(group.key)}
                            disabled={busy || groupUris.length >= 5}
                          >
                            <Text style={DocumentScanner ? styles.scanBtnText : styles.photoActText}>
                              {DocumentScanner ? 'Belge Tara' : 'Kamera'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {groupUris.length > 0 ? (
                        <ScrollView horizontal style={styles.thumbRow} showsHorizontalScrollIndicator={false} nestedScrollEnabled>
                          {groupUris.map((u, i) => (
                            <View key={`${u}-${i}`} style={styles.thumbWrap}>
                              <Image source={{ uri: u }} style={styles.thumbImg} />
                              <Pressable
                                style={styles.thumbRemoveBtn}
                                onPress={() => removeUriForSupplier(group.key, i)}
                                disabled={busy}
                              >
                                <Text style={styles.thumbRemove}>×</Text>
                              </Pressable>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={styles.photoHint}>En az 1 irsaliye fotoğrafı gerekli</Text>
                      )}
                    </View>
                  </View>
                )
              })}

              <Text style={styles.fieldLbl}>Not (isteğe bağlı)</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="—"
                placeholderTextColor={stats.outline}
                editable={!busy}
              />

              <View style={styles.rowBetween}>
                <Text style={styles.fieldLblFlat}>Kalite uygun</Text>
                <Switch
                  value={qualityOk}
                  onValueChange={setQualityOk}
                  disabled={busy}
                  trackColor={{ false: stats.surfaceContainerHighest, true: 'rgba(0, 230, 118, 0.35)' }}
                  thumbColor={qualityOk ? stats.primary : stats.outline}
                  ios_backgroundColor={stats.surfaceContainerHighest}
                />
              </View>

              {!qualityOk ? (
                <>
                  <Text style={styles.fieldLbl}>Hasar / uyumsuzluk notu</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={damageNotes}
                    onChangeText={setDamageNotes}
                    multiline
                    editable={!busy}
                  />
                </>
              ) : null}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: footerPad }]}>
              <Pressable
                style={({ pressed }) => [styles.btnSecondary, busy && styles.dis, pressed && styles.pressed]}
                onPress={close}
                disabled={busy}
              >
                <Text style={styles.btnSecondaryText}>İptal</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btnPrimary, busy && styles.dis, pressed && styles.pressed]}
                onPress={submit}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={stats.onPrimary} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Kaydet</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SwipeDismissSheet>
  )
}

const styles = StyleSheet.create({
  sheetRoot: { width: '100%' },
  innerHost: { flex: 1, minHeight: 0, width: '100%' },
  sheetColumnMain: { flex: 1, minHeight: 0, width: '100%', flexDirection: 'column' },
  sheetHeader: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stats.outlineVariant,
  },
  title: {
    fontFamily: statsFont.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: stats.onSurface,
  },
  sub: { ...statsType.bodyMd, color: stats.onSurfaceVariant, marginTop: 6 },
  tagIrsaliye: {
    ...statsType.labelSm,
    color: stats.onPrimaryContainer,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: stats.primaryContainer,
    borderRadius: stats.radiusLg,
    overflow: 'hidden',
  },
  scrollFlex: { flex: 1, minHeight: 0, width: '100%' },
  scrollContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  supplierDivider: {
    height: 1,
    backgroundColor: stats.outlineVariant,
    marginVertical: 16,
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  supplierBadge: {
    backgroundColor: stats.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  supplierBadgeText: {
    fontFamily: statsFont.bold,
    fontSize: 13,
    color: stats.onPrimaryContainer,
  },
  supplierLineCount: {
    ...statsType.labelSm,
    color: stats.onSurfaceVariant,
  },
  lineCard: {
    padding: 12,
    marginBottom: 12,
    borderRadius: stats.radiusLg,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    backgroundColor: stats.surfaceContainerLow,
  },
  lineTitle: { fontFamily: statsFont.semibold, fontSize: 15, color: stats.onSurface },
  lineSupplierHint: { 
    ...statsType.labelSm, 
    color: stats.primary, 
    marginTop: 2,
    fontFamily: statsFont.medium,
  },
  lineHint: { ...statsType.labelSm, color: stats.onSurfaceVariant, marginTop: 4 },
  photoSection: {
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    backgroundColor: stats.surfaceContainerLowest,
    borderRadius: stats.radiusLg,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
  },
  photoHint: {
    ...statsType.labelSm,
    color: stats.onSurfaceVariant,
    marginTop: 8,
    fontStyle: 'italic',
  },
  fieldLbl: {
    ...statsType.labelMd,
    fontFamily: statsFont.semibold,
    color: stats.onSurface,
    marginTop: 14,
    marginBottom: 6,
  },
  fieldLblFlat: {
    ...statsType.labelMd,
    fontFamily: statsFont.semibold,
    color: stats.onSurface,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.28)',
    borderRadius: stats.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...statsType.bodyLg,
    color: stats.onSurface,
    backgroundColor: stats.surfaceBright,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 4,
  },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  photoActBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: stats.radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.28)',
    alignItems: 'center',
    backgroundColor: stats.surfaceBright,
    minHeight: 48,
  },
  photoActText: { ...statsType.bodyMd, fontFamily: statsFont.semibold, color: stats.primary },
  scanBtn: {
    backgroundColor: stats.primary,
    borderColor: stats.primary,
  },
  scanBtnText: { ...statsType.bodyMd, fontFamily: statsFont.semibold, color: stats.onPrimary },
  thumbRow: { marginTop: 10, minHeight: 72, flexGrow: 0 },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: stats.radiusLg,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: stats.outlineVariant,
  },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbRemoveBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomLeftRadius: 8,
  },
  thumbRemove: { fontSize: 18, fontFamily: statsFont.bold, color: stats.error },
  footer: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: stats.outlineVariant,
    backgroundColor: stats.surfaceBright,
    ...(stats.shadowSm ?? {}),
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: stats.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnPrimaryText: { fontFamily: statsFont.bold, fontSize: 16, color: stats.onPrimary },
  btnSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: stats.outlineVariant,
    backgroundColor: stats.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnSecondaryText: { fontFamily: statsFont.bold, fontSize: 16, color: stats.onSurface },
  dis: { opacity: 0.5 },
  pressed: { opacity: 0.92 },
})
