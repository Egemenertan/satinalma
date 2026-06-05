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
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { SwipeDismissSheet } from '../../island/SwipeDismissSheet'
import type { BundleOrderRow, PurchaseRequestItemRow } from '../../../lib/requestOfferBundle'
import { createOrderDeliveryRpc, uploadDeliveryPhotoUris } from '../../../features/santiyeDepo/orderDelivery'
import { supabase } from '../../../lib/supabase'
import { stats, statsFont, statsType } from '../../../theme/statsDesignTokens'

type Props = {
  visible: boolean
  onClose: () => void
  order: BundleOrderRow | null
  materialItem: PurchaseRequestItemRow | null
  onSuccess: () => void
}

export function PartialDeliveryModalRn({ visible, onClose, order, materialItem, onSuccess }: Props) {
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  /** Malzeme / sepet modali ile aynı: sabit gövde yüksekliği — iç flex zinciri çökmez */
  const sheetBodyHeight = Math.round(winH * 0.92)
  const footerPad = useMemo(() => Math.max(insets.bottom, 12), [insets.bottom])

  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [damageNotes, setDamageNotes] = useState('')
  const [qualityOk, setQualityOk] = useState(true)
  const [uris, setUris] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const maxQty = useMemo(() => {
    if (!order || !materialItem) return 0
    const delivered = order.delivered_quantity || 0
    const returned = order.returned_quantity || 0
    return Math.max(0, (order.quantity || 0) - delivered - returned)
  }, [order, materialItem])

  const reset = useCallback(() => {
    setQty('')
    setNotes('')
    setDamageNotes('')
    setQualityOk(true)
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

  const submit = useCallback(async () => {
    if (!order || !materialItem) return
    const q = parseFloat(qty.replace(',', '.'))
    if (!qty.trim() || q <= 0) {
      Alert.alert('Teslim alma', 'Geçerli miktar girin.')
      return
    }
    if (q > maxQty) {
      Alert.alert('Teslim alma', `En fazla ${maxQty.toFixed(2)} ${materialItem.unit} teslim alınabilir.`)
      return
    }
    if (uris.length === 0) {
      Alert.alert('Teslim alma', 'En az bir irsaliye fotoğrafı ekleyin.')
      return
    }

    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) {
      Alert.alert('Teslim alma', 'Oturum bulunamadı.')
      return
    }

    setBusy(true)
    try {
      const up = await uploadDeliveryPhotoUris(supabase, uris, order.id)
      if (!up.ok) {
        Alert.alert('Teslim alma', up.message)
        return
      }
      const rpc = await createOrderDeliveryRpc(supabase, {
        orderId: order.id,
        deliveredQuantity: q,
        userId: user.id,
        deliveryNotes: notes.trim() || null,
        photoUrls: up.urls,
        qualityCheck: qualityOk,
        damageNotes: damageNotes.trim() || null,
      })
      if (!rpc.ok) {
        Alert.alert('Teslim alma', rpc.message)
        return
      }
      Alert.alert('Teslim alma', 'Kayıt oluşturuldu.')
      onSuccess()
      close()
    } finally {
      setBusy(false)
    }
  }, [order, materialItem, qty, maxQty, uris, notes, damageNotes, qualityOk, onSuccess, close])

  if (!visible || !order || !materialItem) return null

  const supplierName = order.supplier?.name ?? 'Tedarikçi'

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
            <Text style={styles.title}>Kademeli teslim alma</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {materialItem.item_name} · {supplierName}
            </Text>
          </View>

          <ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            <View style={styles.hintCard}>
              <Text style={styles.hintText}>
                Kalan: <Text style={styles.hintStrong}>{maxQty.toFixed(2)}</Text> {materialItem.unit} (sipariş{' '}
                {order.quantity} − teslim − iade)
              </Text>
            </View>

            <Text style={styles.fieldLbl}>Teslim alınan miktar</Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              placeholder={`Maks. ${maxQty.toFixed(2)}`}
              placeholderTextColor={stats.outline}
              underlineColorAndroid="transparent"
              editable={!busy}
            />

            <Text style={styles.fieldLbl}>Not (isteğe bağlı)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="—"
              placeholderTextColor={stats.outline}
              underlineColorAndroid="transparent"
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
                  underlineColorAndroid="transparent"
                  editable={!busy}
                />
              </>
            ) : null}

            <Text style={styles.fieldLbl}>İrsaliye fotoğrafları ({uris.length}/5)</Text>
            <View style={styles.photoActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.photoActBtn,
                  (busy || uris.length >= 5) && styles.dis,
                  pressed && styles.pressed,
                ]}
                onPress={pickImages}
                disabled={busy || uris.length >= 5}
              >
                <Text style={styles.photoActText}>Galeri</Text>
              </Pressable>
              {Platform.OS !== 'web' ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.photoActBtn,
                    (busy || uris.length >= 5) && styles.dis,
                    pressed && styles.pressed,
                  ]}
                  onPress={takePhoto}
                  disabled={busy || uris.length >= 5}
                >
                  <Text style={styles.photoActText}>Kamera</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView horizontal style={styles.thumbRow} showsHorizontalScrollIndicator={false} nestedScrollEnabled>
              {uris.map((u, i) => (
                <View key={`${u}-${i}`} style={styles.thumbWrap}>
                  <Image source={{ uri: u }} style={styles.thumbImg} />
                  <Pressable
                    style={styles.thumbRemoveBtn}
                    onPress={() => setUris((x) => x.filter((_, idx) => idx !== i))}
                    disabled={busy}
                  >
                    <Text style={styles.thumbRemove}>×</Text>
                  </Pressable>
                </View>
              ))}
              {uris.length < 5 && uris.length === 0 ? (
                <Text style={styles.photoHint}>En az bir fotoğraf zorunludur.</Text>
              ) : null}
            </ScrollView>
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
  innerHost: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    width: '100%',
  },
  sheetColumnMain: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
  },
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
  scrollFlex: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  hintCard: {
    padding: 12,
    borderRadius: stats.radiusLg,
    backgroundColor: stats.primaryContainer,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    marginBottom: 4,
  },
  hintText: { ...statsType.bodyMd, color: stats.onPrimaryContainer },
  hintStrong: { fontFamily: statsFont.bold, color: stats.onPrimaryContainer },
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
    marginTop: 0,
    marginBottom: 0,
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
  photoHint: { ...statsType.labelSm, color: stats.onSurfaceVariant, paddingVertical: 20, alignSelf: 'center' },
  footer: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: stats.outlineVariant,
    backgroundColor: stats.surfaceBright,
    ...(stats.shadowSm ?? {}),
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: stats.radiusXl,
    backgroundColor: stats.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnPrimaryText: { fontFamily: statsFont.bold, fontSize: 16, color: stats.onPrimary },
  btnSecondary: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: stats.radiusXl,
    borderWidth: 1.5,
    borderColor: stats.outlineVariant,
    backgroundColor: stats.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnSecondaryText: { fontFamily: statsFont.bold, fontSize: 16, color: stats.onSurface },
  dis: { opacity: 0.5 },
  pressed: { opacity: 0.92 },
})
