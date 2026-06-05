import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
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
import { SwipeDismissSheet } from '../island/SwipeDismissSheet'
import { stats, statsFont, statsType } from '../../theme/statsDesignTokens'

export type MaterialItemRn = { id: string; name: string; class?: string; group?: string }

export type CartItemRn = {
  id: string
  material_class: string
  material_group: string
  material_item_name: string
  material_name: string
  material_description: string
  unit: string
  quantity: string
  brand: string
  specifications: string
  purpose: string
  delivery_date: string
  image_urls: string[]
  pendingImageUris: string[]
}

const COMMON_UNITS = [
  'Adet',
  'Kg',
  'Gram',
  'Ton',
  'Litre',
  'M',
  'M²',
  'M³',
  'Cm',
  'Mm',
  'Paket',
  'Kutu',
  'Koli',
  'Çuval',
  'Top',
  'Rulo',
  'Palet',
  'Bağ',
  'Torba',
  'Bidon',
  'Varil',
  'Takım',
  'Set',
] as const

function emptyCartFromItem(
  item: MaterialItemRn,
  materialClass: string,
  materialGroup: string
): CartItemRn {
  return {
    id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    material_class: materialClass,
    material_group: materialGroup,
    material_item_name: item.name,
    material_name: item.name,
    material_description: '',
    unit: '',
    quantity: '1',
    brand: '',
    specifications: '',
    purpose: '',
    delivery_date: '',
    image_urls: [],
    pendingImageUris: [],
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

function startOfToday(): Date {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmdToLocalDate(value: string): Date | null {
  const s = value.trim()
  if (!ISO.test(s)) return null
  const [yy, mm, dd] = s.split('-').map(Number)
  if (!yy || !mm || !dd) return null
  return new Date(yy, mm - 1, dd, 12, 0, 0, 0)
}

function formatTrDateLabel(ymd: string): string {
  if (!ISO.test(ymd.trim())) return ''
  const d = parseYmdToLocalDate(ymd)
  if (!d) return ''
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildInitialForm(
  item: MaterialItemRn,
  materialClass: string,
  materialGroup: string,
  editItem: CartItemRn | null
): CartItemRn {
  if (editItem) {
    return { ...editItem, pendingImageUris: editItem.pendingImageUris ?? [] }
  }
  return emptyCartFromItem(item, materialClass, materialGroup)
}

type Props = {
  visible: boolean
  item: MaterialItemRn | null
  materialClass: string
  materialGroup: string
  editItem: CartItemRn | null
  editIndex: number
  onClose: () => void
  onAdd: (line: CartItemRn) => void
  onUpdate: (index: number, line: CartItemRn) => void
}

export function MaterialDetailModalRn({
  visible,
  item,
  materialClass,
  materialGroup,
  editItem,
  editIndex,
  onClose,
  onAdd,
  onUpdate,
}: Props) {
  const insets = useSafeAreaInsets()
  const { height: winH, width: winW } = useWindowDimensions()
  const [draft, setDraft] = useState<CartItemRn | null>(null)
  const [unitPicker, setUnitPicker] = useState(false)
  const [customUnit, setCustomUnit] = useState(false)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [iosDraftDate, setIosDraftDate] = useState(() => startOfToday())

  const footerPad = useMemo(() => Math.max(insets.bottom, 20) + 12, [insets.bottom])

  /** Sabit yükseklik: flex ile ScrollView doldurulur, aksiyon çubuğu alta yapışır */
  const sheetBodyHeight = Math.round(winH * 0.92)

  useLayoutEffect(() => {
    if (!visible || !item) {
      setDraft(null)
      setUnitPicker(false)
      setDateSheetOpen(false)
      return
    }
    setDraft(buildInitialForm(item, materialClass, materialGroup, editItem))
  }, [visible, item, materialClass, materialGroup, editItem, editIndex])

  useEffect(() => {
    if (!visible || !item) return
    if (editItem) {
      const isCustom = Boolean(
        editItem.unit && !COMMON_UNITS.includes(editItem.unit as (typeof COMMON_UNITS)[number])
      )
      setCustomUnit(isCustom)
    } else {
      setCustomUnit(false)
    }
  }, [visible, item, editItem])

  function patchDraft(updater: (prev: CartItemRn) => CartItemRn) {
    if (!item) return
    setDraft((prev) => updater(prev ?? buildInitialForm(item, materialClass, materialGroup, editItem)))
  }

  function openDeliveryDatePicker() {
    if (!item || Platform.OS === 'web') return
    const currentForm = draft ?? buildInitialForm(item, materialClass, materialGroup, editItem)
    const base = parseYmdToLocalDate(currentForm.delivery_date) ?? startOfToday()
    const min = startOfToday()
    setIosDraftDate(base < min ? min : base)
    setUnitPicker(false)
    setDateSheetOpen(true)
  }

  function applyPickedDate() {
    const min = startOfToday()
    const d = iosDraftDate < min ? min : iosDraftDate
    patchDraft((f) => ({ ...f, delivery_date: toYmd(d) }))
    setDateSheetOpen(false)
  }

  function imageSlotsRemaining(): number {
    if (!item) return 0
    const base = draft ?? buildInitialForm(item, materialClass, materialGroup, editItem)
    return Math.max(0, 3 - base.pendingImageUris.length)
  }

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Galeri erişimi için izin verin.')
      return
    }
    const remain = imageSlotsRemaining()
    if (remain <= 0) {
      Alert.alert('Limit', 'En fazla 3 fotoğraf ekleyebilirsiniz.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remain,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return
    patchDraft((prev) => {
      const add = result.assets!.map((a) => a.uri).slice(0, remain)
      return { ...prev, pendingImageUris: [...prev.pendingImageUris, ...add] }
    })
  }

  async function takePhotoWithCamera() {
    if (Platform.OS === 'web') {
      Alert.alert('Bilgi', 'Kamera bu platformda kullanılamıyor; galeriden seçin.')
      return
    }
    const remain = imageSlotsRemaining()
    if (remain <= 0) {
      Alert.alert('Limit', 'En fazla 3 fotoğraf ekleyebilirsiniz.')
      return
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf çekmek için kamera izni verin.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.[0]?.uri) return
    const uri = result.assets[0].uri
    patchDraft((prev) => ({ ...prev, pendingImageUris: [...prev.pendingImageUris, uri] }))
  }

  function removeImage(i: number) {
    patchDraft((prev) => {
      const next = [...prev.pendingImageUris]
      next.splice(i, 1)
      return { ...prev, pendingImageUris: next }
    })
  }

  function submit() {
    if (!item) return
    const form = draft ?? buildInitialForm(item, materialClass, materialGroup, editItem)
    if (!form.quantity.trim() || parseFloat(form.quantity.replace(',', '.')) <= 0) {
      Alert.alert('Eksik bilgi', 'Geçerli bir miktar girin.')
      return
    }
    const u = customUnit ? form.unit.trim() : form.unit
    if (!u) {
      Alert.alert('Eksik bilgi', 'Birim seçin veya girin.')
      return
    }
    if (!form.delivery_date.trim() || !ISO.test(form.delivery_date.trim())) {
      Alert.alert('Eksik bilgi', 'Teslimat tarihini seçin.')
      return
    }
    if (!form.purpose.trim()) {
      Alert.alert('Eksik bilgi', 'Kullanım amacı girin.')
      return
    }
    const line: CartItemRn = { ...form, unit: u }
    if (editItem && editIndex >= 0) {
      onUpdate(editIndex, line)
    } else {
      onAdd(line)
    }
    onClose()
  }

  if (!visible || !item) return null

  const form = draft ?? buildInitialForm(item, materialClass, materialGroup, editItem)

  const dateDisplay = form.delivery_date.trim() && ISO.test(form.delivery_date.trim())
    ? formatTrDateLabel(form.delivery_date)
    : null

  const subPickerModalVisible = unitPicker || (dateSheetOpen && Platform.OS !== 'web')

  function closeSubPickers() {
    setUnitPicker(false)
    setDateSheetOpen(false)
  }

  return (
    <SwipeDismissSheet
      visible={visible}
      onRequestClose={onClose}
      title={null}
      maxHeightRatio={0.94}
      dismissKeyboardForOverlay={subPickerModalVisible}
      topOverlay={
        subPickerModalVisible ? (
          <View style={styles.subModalRoot}>
            <Pressable style={styles.subModalBackdrop} onPress={closeSubPickers} accessibilityLabel="Kapat" />
            <View style={styles.subModalSheetHost} pointerEvents="box-none">
              {unitPicker ? (
                <View
                  style={[
                    styles.pickerPanel,
                    styles.subPickerPanel,
                    { paddingBottom: Math.max(footerPad, 16), maxHeight: winH * 0.72 },
                  ]}
                >
                  <View style={styles.pickerHandle} />
                  <Text style={styles.pickerTitle}>Birim seçin</Text>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={[styles.pickerScroll, { maxHeight: winH * 0.42 }]}
                    contentContainerStyle={styles.pickerScrollContent}
                  >
                    <Pressable
                      style={({ pressed }) => [styles.unitRow, pressed && styles.unitRowPressed]}
                      onPress={() => {
                        setCustomUnit(true)
                        patchDraft((f) => ({ ...f, unit: '' }))
                        setUnitPicker(false)
                      }}
                    >
                      <MaterialIcons name="edit" size={20} color={stats.primary} style={styles.unitRowIcon} />
                      <Text style={styles.unitOther}>Diğer (elle yaz)</Text>
                    </Pressable>
                    {COMMON_UNITS.map((u) => {
                      const selected = !customUnit && form.unit === u
                      return (
                        <Pressable
                          key={u}
                          style={({ pressed }) => [
                            styles.unitRow,
                            selected && styles.unitRowSelected,
                            pressed && styles.unitRowPressed,
                          ]}
                          onPress={() => {
                            setCustomUnit(false)
                            patchDraft((f) => ({ ...f, unit: u }))
                            setUnitPicker(false)
                          }}
                        >
                          <Text style={[styles.unitLabel, selected && styles.unitLabelSelected]}>{u}</Text>
                          {selected ? (
                            <MaterialIcons name="check-circle" size={22} color={stats.primary} />
                          ) : null}
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                </View>
              ) : dateSheetOpen && Platform.OS !== 'web' ? (
                <View
                  style={[
                    styles.pickerPanel,
                    styles.datePickerPanel,
                    styles.subPickerPanel,
                    { paddingBottom: Math.max(footerPad, 16), maxHeight: winH * 0.72 },
                  ]}
                >
                  <View style={styles.pickerHandle} />
                  <Text style={[styles.pickerTitle, styles.pickerTitleCenter]}>Teslimat tarihi</Text>
                  <View style={styles.datePickerWrap}>
                    <View style={styles.datePickerAligner}>
                      <DateTimePicker
                        value={iosDraftDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                        minimumDate={startOfToday()}
                        onChange={(_, date) => {
                          if (date) setIosDraftDate(date)
                        }}
                        themeVariant="light"
                        style={[
                          Platform.OS === 'ios'
                            ? { width: Math.min(winW - 48, 400) }
                            : { width: Math.min(winW - 48, 420) },
                          styles.datePickerNative,
                        ]}
                      />
                    </View>
                  </View>
                  <Pressable style={styles.dateApplyBtn} onPress={applyPickedDate}>
                    <Text style={styles.dateApplyBtnText}>Tarihi uygula</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        ) : null
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheetRoot, { height: sheetBodyHeight, maxHeight: sheetBodyHeight }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.innerHost}>
          <View style={styles.sheetColumnMain}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.metaRow}>
                {materialGroup ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText} numberOfLines={1}>
                      {materialGroup}
                    </Text>
                  </View>
                ) : null}
                {materialGroup && materialClass ? <Text style={styles.metaSep}>·</Text> : null}
                {materialClass ? (
                  <View style={[styles.metaChip, styles.metaChipMuted]}>
                    <Text style={styles.metaChipTextMuted} numberOfLines={1}>
                      {materialClass}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.scrollFlex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionHeading}>Zorunlu bilgiler</Text>

              <View style={[styles.cardShell, styles.card]}>
                <Text style={styles.fieldLabel}>Miktar *</Text>
                <TextInput
                  style={styles.input}
                  underlineColorAndroid="transparent"
                  keyboardType="decimal-pad"
                  value={form.quantity}
                  placeholder="0"
                  placeholderTextColor={stats.outline}
                  onChangeText={(t) => patchDraft((f) => ({ ...f, quantity: t }))}
                />

                <Text style={[styles.fieldLabel, styles.fieldLabelSpacer]}>Birim *</Text>
                {customUnit ? (
                  <TextInput
                    style={styles.input}
                    underlineColorAndroid="transparent"
                    value={form.unit}
                    placeholder="Örn. Kasa"
                    placeholderTextColor={stats.outline}
                    onChangeText={(t) =>
                      patchDraft((f) => ({ ...f, unit: t.replace(/[0-9]/g, '') }))
                    }
                  />
                ) : (
                  <Pressable
                    style={styles.selectRow}
                    onPress={() => {
                      setDateSheetOpen(false)
                      setUnitPicker(true)
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Birim seç"
                  >
                    <Text style={form.unit ? styles.selectText : styles.selectPlaceholder}>
                      {form.unit || 'Listeden birim seçin'}
                    </Text>
                    <MaterialIcons name="expand-more" size={22} color={stats.onSurfaceVariant} />
                  </Pressable>
                )}
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setCustomUnit((c) => !c)
                    if (!customUnit) patchDraft((f) => ({ ...f, unit: '' }))
                  }}
                  style={styles.inlineLinkWrap}
                >
                  <Text style={styles.inlineLink}>{customUnit ? 'Listeden birim seç' : 'Özel birim yaz'}</Text>
                </Pressable>
              </View>

              <View style={[styles.cardShell, styles.card]}>
                <Text style={styles.fieldLabel}>Teslimat tarihi *</Text>
                {Platform.OS === 'web' ? (
                  <TextInput
                    style={styles.input}
                    underlineColorAndroid="transparent"
                    value={form.delivery_date}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={stats.outline}
                    onChangeText={(t) => patchDraft((f) => ({ ...f, delivery_date: t }))}
                    autoCapitalize="none"
                  />
                ) : (
                  <Pressable
                    style={styles.selectRow}
                    onPress={openDeliveryDatePicker}
                    accessibilityRole="button"
                    accessibilityLabel="Teslimat tarihi seç"
                  >
                    <MaterialIcons name="event" size={22} color={stats.primary} style={styles.selectIconLead} />
                    <View style={styles.dateTextBlock}>
                      {dateDisplay ? (
                        <>
                          <Text style={styles.selectText}>{dateDisplay}</Text>
                          <Text style={styles.dateIsoHint}>{form.delivery_date}</Text>
                        </>
                      ) : (
                        <Text style={styles.selectPlaceholder}>Takvimden seçin</Text>
                      )}
                    </View>
                    <MaterialIcons name="calendar-month" size={22} color={stats.onSurfaceVariant} />
                  </Pressable>
                )}

                <Text style={[styles.fieldLabel, styles.fieldLabelSpacer]}>Kullanım amacı *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  underlineColorAndroid="transparent"
                  value={form.purpose}
                  placeholder="Nerede / ne için kullanılacak?"
                  placeholderTextColor={stats.outline}
                  onChangeText={(t) => patchDraft((f) => ({ ...f, purpose: t }))}
                  multiline
                />
              </View>

              <Text style={styles.sectionHeading}>İsteğe bağlı</Text>

              <View style={[styles.cardShell, styles.card]}>
                <Text style={styles.fieldLabel}>Marka</Text>
                <TextInput
                  style={styles.input}
                  underlineColorAndroid="transparent"
                  value={form.brand}
                  placeholder="Varsa belirtin"
                  placeholderTextColor={stats.outline}
                  onChangeText={(t) => patchDraft((f) => ({ ...f, brand: t }))}
                />

                <Text style={[styles.fieldLabel, styles.fieldLabelSpacer]}>Teknik özellik / not</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  underlineColorAndroid="transparent"
                  value={form.specifications}
                  placeholder="Ölçü, kod, renk…"
                  placeholderTextColor={stats.outline}
                  onChangeText={(t) => patchDraft((f) => ({ ...f, specifications: t }))}
                  multiline
                />
              </View>

              <View style={[styles.cardShell, styles.card]}>
                <View style={styles.imgSectionHead}>
                  <Text style={styles.fieldLabel}>Görseller</Text>
                  <Text style={styles.imgHint}>En fazla 3 fotoğraf</Text>
                </View>
                <View style={styles.imgBtnRow}>
                  <Pressable
                    style={[styles.imgBtn, styles.imgBtnGallery]}
                    onPress={() => void pickImages()}
                    accessibilityRole="button"
                    accessibilityLabel="Galeriden fotoğraf ekle"
                  >
                    <MaterialIcons name="photo-library" size={22} color={stats.primary} />
                    <Text style={styles.imgBtnText}>Galeriden ekle</Text>
                  </Pressable>
                  {Platform.OS !== 'web' ? (
                    <Pressable
                      style={styles.imgBtnCamera}
                      onPress={() => void takePhotoWithCamera()}
                      accessibilityRole="button"
                      accessibilityLabel="Kamera ile çek"
                    >
                      <MaterialIcons name="photo-camera" size={24} color={stats.primary} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.thumbRow}>
                  {form.pendingImageUris.map((uri, i) => (
                    <View key={uri} style={styles.thumbWrap}>
                      <Image source={{ uri }} style={styles.thumb} />
                      <Pressable style={styles.thumbX} onPress={() => removeImage(i)} hitSlop={6}>
                        <MaterialIcons name="close" size={16} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={[styles.actionBar, { paddingBottom: footerPad }]}>
              <Pressable
                style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
                onPress={onClose}
              >
                <Text style={styles.btnSecondaryText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
                onPress={submit}
              >
                <Text style={styles.btnPrimaryText}>{editItem ? 'Güncelle' : 'Sepete ekle'}</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0,
  },
  sheetTitle: {
    fontFamily: statsFont.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: '#111827',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 12, gap: 8 },
  metaChip: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#f0fdf4',
    borderWidth: 0,
  },
  metaChipMuted: {
    backgroundColor: '#f3f4f6',
  },
  metaChipText: {
    fontSize: 13,
    fontFamily: statsFont.semibold,
    color: '#047857',
  },
  metaChipTextMuted: {
    fontSize: 13,
    fontFamily: statsFont.medium,
    color: '#6b7280',
  },
  metaSep: { fontSize: 13, color: '#d1d5db', marginHorizontal: -2 },
  scrollFlex: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: statsFont.bold,
    color: '#9ca3af',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardShell: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  card: {
    padding: 16,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: statsFont.semibold,
    color: '#374151',
    marginBottom: 8,
  },
  fieldLabelSpacer: { marginTop: 16 },
  input: {
    fontFamily: statsFont.medium,
    fontSize: 16,
    lineHeight: 22,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: '#f9fafb',
    minHeight: 52,
    textAlignVertical: 'center',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top',
    lineHeight: 22,
    borderRadius: 20,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
    minHeight: 52,
  },
  selectIconLead: { marginRight: 10 },
  selectText: {
    fontFamily: statsFont.medium,
    fontSize: 16,
    lineHeight: 20,
    color: '#111827',
    flex: 1,
  },
  selectPlaceholder: {
    fontFamily: statsFont.medium,
    fontSize: 16,
    lineHeight: 20,
    color: '#9ca3af',
    flex: 1,
  },
  dateTextBlock: { flex: 1 },
  dateIsoHint: {
    fontSize: 12,
    marginTop: 2,
    color: '#9ca3af',
  },
  inlineLinkWrap: { alignSelf: 'flex-start', marginTop: 12 },
  inlineLink: { fontSize: 14, color: '#01E884', fontFamily: statsFont.semibold },
  imgSectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  imgHint: { fontSize: 12, color: '#9ca3af' },
  imgBtnRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  imgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 52,
  },
  imgBtnGallery: {
    flex: 1,
    minWidth: 0,
  },
  imgBtnCamera: {
    width: 52,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 52,
  },
  imgBtnText: { fontSize: 15, fontFamily: statsFont.semibold, color: '#01E884' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 12 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#f3f4f6' },
  thumbX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  actionBar: {
    flexShrink: 0,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: '#01E884',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#01E884',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: { fontFamily: statsFont.bold, fontSize: 16, color: '#111827' },
  btnSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { fontFamily: statsFont.bold, fontSize: 16, color: '#374151' },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  subModalRoot: {
    flex: 1,
    position: 'relative',
  },
  subModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  subModalSheetHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  subPickerPanel: {
    width: '100%',
    alignSelf: 'stretch',
  },
  pickerPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 0,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  datePickerPanel: {},
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontFamily: statsFont.bold,
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
  },
  pickerTitleCenter: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  pickerScroll: {},
  pickerScrollContent: {
    paddingBottom: 24,
  },
  datePickerWrap: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  datePickerAligner: {
    width: '100%',
    alignItems: 'center',
  },
  datePickerNative: {
    alignSelf: 'center',
  },
  dateApplyBtn: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: '#01E884',
    alignItems: 'center',
  },
  dateApplyBtnText: { fontFamily: statsFont.bold, fontSize: 16, color: '#111827' },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 8,
    borderRadius: 9999,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  unitRowSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#01E884',
  },
  unitRowPressed: { opacity: 0.9 },
  unitRowIcon: { marginRight: 12 },
  unitLabel: { fontSize: 16, fontFamily: statsFont.medium, color: '#374151', flex: 1 },
  unitLabelSelected: { fontFamily: statsFont.semibold, color: '#047857' },
  unitOther: { fontSize: 16, fontFamily: statsFont.bold, color: '#01E884', flex: 1 },
})
