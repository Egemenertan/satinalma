import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { SwipeDismissSheet } from '../../island/SwipeDismissSheet'
import { processOrderReturn, uploadReturnPhotoUris } from '../../../features/santiyeDepo/orderReturn'
import type { BundleOrderRow, PurchaseRequestItemRow } from '../../../lib/requestOfferBundle'
import { supabase } from '../../../lib/supabase'

type Props = {
  visible: boolean
  onClose: () => void
  order: (BundleOrderRow & { purchase_request_id?: string; status?: string | null }) | null
  materialItem: PurchaseRequestItemRow | null
  userRole: string
  onSuccess: () => void
}

export function ReturnOrderModalRn({ visible, onClose, order, materialItem, userRole, onSuccess }: Props) {
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  /** PartialDeliveryModalRn ile aynı: Modal gövdesinde sabit yükseklik — iç flex sıfıra çökmez */
  const sheetBodyHeight = Math.round(winH * 0.94)

  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [reorder, setReorder] = useState<boolean | null>(null)
  const [uris, setUris] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const orderQuantity = order?.quantity ?? 0
  const deliveredQuantity = order?.delivered_quantity ?? 0
  const currentReturnedQuantity = order?.returned_quantity ?? 0

  const maxQty = useMemo(() => {
    if (!order || !materialItem) return 0
    const remaining = orderQuantity - deliveredQuantity - currentReturnedQuantity
    return Math.max(0, remaining)
  }, [order, materialItem, orderQuantity, deliveredQuantity, currentReturnedQuantity])

  const reset = useCallback(() => {
    setQty('')
    setNotes('')
    setReorder(null)
    setUris([])
  }, [])

  const close = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const pickImages = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('İzin', 'Galeri izni gerekli.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 5 - uris.length,
    })
    if (res.canceled) return
    const next = res.assets.map((a) => a.uri).filter(Boolean) as string[]
    setUris((u) => [...u, ...next].slice(0, 5))
  }, [uris.length])

  const takePhoto = useCallback(async () => {
    if (uris.length >= 5) return
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('İzin', 'Kamera izni gerekli.')
      return
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 })
    if (res.canceled) return
    const uri = res.assets[0]?.uri
    if (uri) setUris((u) => [...u, uri].slice(0, 5))
  }, [uris.length])

  const submitDisabled =
    busy ||
    !notes.trim() ||
    reorder === null ||
    !qty.trim() ||
    parseFloat(qty.replace(',', '.') || '0') <= 0 ||
    parseFloat(qty.replace(',', '.') || '0') > maxQty ||
    maxQty <= 0

  const submit = useCallback(async () => {
    if (!order || !materialItem) return
    if (!notes.trim()) {
      Alert.alert('İade', 'İade nedeni / notlar zorunludur.')
      return
    }
    if (reorder === null) {
      Alert.alert('İade', 'Lütfen "Yeniden sipariş verilsin mi?" sorusunu yanıtlayın.')
      return
    }
    const q = parseFloat(qty.replace(',', '.'))
    if (!qty.trim() || q <= 0) {
      Alert.alert('İade', 'Geçerli bir iade miktarı girin.')
      return
    }
    if (maxQty <= 0) {
      Alert.alert(
        'İade',
        'İade edilecek kalan miktar yok. Tüm malzeme teslim alındı veya iade edildi.'
      )
      return
    }
    if (q > maxQty) {
      Alert.alert(
        'İade',
        `Maksimum ${maxQty.toFixed(2)} ${materialItem.unit} iade edebilirsiniz. (Kalan: ${maxQty.toFixed(2)} ${materialItem.unit})`
      )
      return
    }

    setBusy(true)
    try {
      let photoUrls: string[] = []
      if (uris.length > 0) {
        const up = await uploadReturnPhotoUris(supabase, uris, order.id)
        if (!up.ok) {
          Alert.alert('İade', up.message)
          return
        }
        photoUrls = up.urls
      }

      const res = await processOrderReturn(supabase, {
        order,
        materialItem,
        returnQty: q,
        returnNotes: notes.trim(),
        reorderRequested: reorder === true,
        photoUrls,
        userRole,
      })
      if (!res.ok) {
        Alert.alert('İade', res.message)
        return
      }
      Alert.alert('İade', res.message)
      onSuccess()
      close()
    } finally {
      setBusy(false)
    }
  }, [order, materialItem, notes, reorder, qty, maxQty, uris, userRole, onSuccess, close])

  if (!visible || !order || !materialItem) return null

  const supplierName = order.supplier?.name ?? 'Bilinmeyen'

  return (
    <SwipeDismissSheet visible={visible} onRequestClose={close} title={null} maxHeightRatio={0.94}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.kavRoot, { height: sheetBodyHeight, maxHeight: sheetBodyHeight }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.innerHost}>
          <View style={styles.sheetColumnMain}>
            <View style={styles.sheetHeader}>
              <Text style={styles.title}>Malzeme iadesi</Text>
              <Text style={styles.sub} numberOfLines={2}>
                {materialItem.item_name} · {supplierName}
              </Text>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              nestedScrollEnabled
              bounces
            >
              <View style={styles.warnBox}>
                <Text style={styles.warnTitle}>İade işlemi</Text>
                <Text style={styles.warnBody}>
                  <Text style={styles.warnStrong}>{materialItem.item_name}</Text> için iade kaydı oluşturulur.
                  İade miktarı, siparişteki teslim ve iade durumuna göre hesaplanan üst sınırı aşamaz.
                </Text>
              </View>

              <View style={styles.statsCard}>
                <View style={styles.statRow}>
                  <Text style={styles.statLbl}>Tedarikçi</Text>
                  <Text style={styles.statValWide}>{supplierName}</Text>
                </View>
                <View style={styles.statGrid}>
                  <View style={styles.statCell}>
                    <Text style={styles.statLbl}>Sipariş miktarı</Text>
                    <Text style={styles.statVal}>
                      {orderQuantity.toFixed(2)} {materialItem.unit}
                    </Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statLbl}>Teslim alınan</Text>
                    <Text style={[styles.statVal, styles.statGreen]}>
                      {deliveredQuantity.toFixed(2)} {materialItem.unit}
                    </Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statLbl}>İade edilen</Text>
                    <Text style={[styles.statVal, styles.statRed]}>
                      {currentReturnedQuantity.toFixed(2)} {materialItem.unit}
                    </Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statLbl}>Kalan (iade üst sınırı)</Text>
                    <Text style={[styles.statVal, styles.statBlue]}>
                      {maxQty.toFixed(2)} {materialItem.unit}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLbl}>
                İade miktarı (En fazla {maxQty.toFixed(2)} {materialItem.unit}) *
              </Text>
              <TextInput
                style={styles.input}
                value={qty}
                onChangeText={setQty}
                keyboardType="decimal-pad"
                placeholder="Miktar"
                placeholderTextColor="#9ca3af"
                editable={!busy && maxQty > 0}
              />

              <Text style={styles.fieldLbl}>İade nedeni / notlar *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="İade nedenini yazın..."
                editable={!busy}
              />

              <Text style={styles.fieldLbl}>Yeniden sipariş verilsin mi? *</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  style={[styles.toggleBtn, styles.toggleYes, reorder === true && styles.toggleYesOn]}
                  onPress={() => setReorder(true)}
                  disabled={busy}
                >
                  <Text style={[styles.toggleTxt, reorder === true && styles.toggleTxtOnYes]}>Evet</Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleBtn, styles.toggleNo, reorder === false && styles.toggleNoOn]}
                  onPress={() => setReorder(false)}
                  disabled={busy}
                >
                  <Text style={[styles.toggleTxt, reorder === false && styles.toggleTxtOnNo]}>Hayır</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLbl}>İade fotoğrafları (isteğe bağlı, en fazla 5)</Text>
              <View style={styles.photoActions}>
                <Pressable
                  style={[styles.photoActBtn, (busy || uris.length >= 5) && styles.dis]}
                  onPress={pickImages}
                  disabled={busy || uris.length >= 5}
                >
                  <Text style={styles.photoActText}>Galeri</Text>
                </Pressable>
                <Pressable
                  style={[styles.photoActBtn, (busy || uris.length >= 5) && styles.dis]}
                  onPress={takePhoto}
                  disabled={busy || uris.length >= 5}
                >
                  <Text style={styles.photoActText}>Kamera</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbRow}
                nestedScrollEnabled
              >
                {uris.map((u) => (
                  <View key={u} style={styles.thumbWrap}>
                    <Image source={{ uri: u }} style={styles.thumbImg} />
                    <Pressable
                      style={styles.thumbRemoveBtn}
                      disabled={busy}
                      onPress={() => setUris((x) => x.filter((i) => i !== u))}
                    >
                      <Text style={styles.thumbRemove}>×</Text>
                    </Pressable>
                  </View>
                ))}
                {uris.length === 0 ? (
                  <Text style={styles.photoHint}>İadeyi belgeleyen fotoğraflar ekleyebilirsiniz.</Text>
                ) : null}
              </ScrollView>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) + 44 }]}>
              <Pressable style={styles.btnGhost} onPress={close} disabled={busy}>
                <Text style={styles.btnGhostText}>İptal</Text>
              </Pressable>
              <Pressable
                style={[styles.btnDanger, submitDisabled && styles.dis]}
                onPress={submit}
                disabled={submitDisabled}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnDangerText}>İadeyi kaydet</Text>
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
  kavRoot: { width: '100%' },
  innerHost: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
  },
  sheetColumnMain: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
  },
  sheetHeader: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#7f1d1d' },
  sub: { fontSize: 14, color: '#6b7280', marginTop: 6, lineHeight: 20 },
  scroll: { flex: 1, minHeight: 0, width: '100%' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  warnBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warnTitle: { fontSize: 14, fontWeight: '600', color: '#991b1b', marginBottom: 6 },
  warnBody: { fontSize: 13, color: '#b91c1c', lineHeight: 18 },
  warnStrong: { fontWeight: '700', color: '#7f1d1d' },
  statsCard: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    gap: 10,
  },
  statRow: { gap: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCell: { width: '47%', minWidth: 120 },
  statLbl: { fontSize: 12, color: '#6b7280' },
  statVal: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2 },
  statValWide: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2 },
  statGreen: { color: '#15803d' },
  statRed: { color: '#b91c1c' },
  statBlue: { color: '#1d4ed8' },
  fieldLbl: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleYes: { borderColor: '#22c55e', backgroundColor: '#fff' },
  toggleYesOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  toggleNo: { borderColor: '#ef4444', backgroundColor: '#fff' },
  toggleNoOn: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  toggleTxt: { fontWeight: '600', color: '#374151' },
  toggleTxtOnYes: { color: '#fff' },
  toggleTxtOnNo: { color: '#fff' },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  photoActBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  photoActText: { fontWeight: '600', color: '#374151', fontSize: 14 },
  thumbRow: { marginTop: 10, marginBottom: 12, minHeight: 72, flexGrow: 0 },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginRight: 8,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemoveBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomLeftRadius: 8,
  },
  thumbRemove: { fontSize: 18, fontWeight: '800', color: '#dc2626' },
  photoHint: { fontSize: 12, color: '#9ca3af', paddingVertical: 20 },
  footer: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 10 },
    }),
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    minHeight: 52,
  },
  btnGhostText: { fontWeight: '700', color: '#374151', fontSize: 16 },
  btnDanger: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnDangerText: { fontWeight: '700', color: '#fff', fontSize: 16 },
  dis: { opacity: 0.5 },
})
