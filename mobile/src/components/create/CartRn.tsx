import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { ISLAND_CART_BAR_CLEARANCE } from '../island/islandTokens'
import { SwipeDismissSheet } from '../island/SwipeDismissSheet'
import { stats, statsFont, statsType } from '../../theme/statsDesignTokens'
import type { CartItemRn } from './MaterialDetailModalRn'

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

/** Alt yüzen tab ile aynı yatay inset (IslandBottomBar SIDE_INSET) */
const CART_HORIZONTAL_INSET = 20

function cartLinePreviewUris(item: CartItemRn): string[] {
  const local = item.pendingImageUris?.filter(Boolean) ?? []
  if (local.length) return local.slice(0, 3)
  const remote = item.image_urls?.filter(Boolean) ?? []
  return remote.slice(0, 3)
}

type UnitSelectorProps = {
  currentUnit: string
  onSelectUnit: (unit: string) => void
}

function UnitSelector({ currentUnit, onSelectUnit }: UnitSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  function handleSelect(unit: string) {
    onSelectUnit(unit)
    setIsOpen(false)
  }

  return (
    <View style={styles.unitSelectorContainer}>
      <Pressable style={styles.unitButton} onPress={() => setIsOpen(!isOpen)}>
        <Text style={styles.unitButtonText}>{currentUnit}</Text>
        <MaterialIcons name={isOpen ? 'arrow-drop-up' : 'arrow-drop-down'} size={20} color={stats.primary} />
      </Pressable>
      
      {isOpen && (
        <View style={styles.unitDropdown}>
          <ScrollView style={styles.unitDropdownScroll} nestedScrollEnabled>
            {COMMON_UNITS.map((unit) => (
              <Pressable
                key={unit}
                style={[
                  styles.unitOption,
                  unit === currentUnit && styles.unitOptionSelected
                ]}
                onPress={() => handleSelect(unit)}
              >
                <Text style={[
                  styles.unitOptionText,
                  unit === currentUnit && styles.unitOptionTextSelected
                ]}>
                  {unit}
                </Text>
                {unit === currentUnit && (
                  <MaterialIcons name="check" size={18} color={stats.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

type PropsBar = {
  count: number
  onOpenCart: () => void
}

export function CartBottomBarRn({ count, onOpenCart }: PropsBar) {
  const insets = useSafeAreaInsets()
  const bottom = insets.bottom + ISLAND_CART_BAR_CLEARANCE

  if (count <= 0) return null

  return (
    <View style={[styles.barWrap, { paddingBottom: bottom }]} pointerEvents="box-none">
      <Pressable style={styles.bar} onPress={onOpenCart}>
        <View style={styles.barBadge}>
          <Text style={styles.barBadgeText}>{count}</Text>
        </View>
        <Text style={styles.barText}>Sepeti görüntüle</Text>
      </Pressable>
    </View>
  )
}

type PropsDrawer = {
  open: boolean
  onClose: () => void
  items: CartItemRn[]
  onRemove: (id: string) => void
  onEdit: (item: CartItemRn, index: number) => void
  onUpdateUnit: (id: string, unit: string) => void
  onUpdateItem: (id: string, updates: Partial<CartItemRn>) => void
  onSubmit: () => void
  submitting: boolean
}

export function CartDrawerRn({ open, onClose, items, onRemove, onEdit, onUpdateUnit, onUpdateItem, onSubmit, submitting }: PropsDrawer) {
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  const SHEET_MAX_RATIO = 0.92
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDatePickerFor, setShowDatePickerFor] = useState<string | null>(null)

  /** Liste + alt butonlar: levhada tutamak+başlık için yer bırak (~%92 tavan). */
  const drawerBodyHeight = Math.max(280, Math.min(Math.round(winH * 0.72), Math.round(winH * SHEET_MAX_RATIO - 130)))
  const footerPad = Math.max(insets.bottom, 10)

  async function handlePickImage(itemId: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri
      onUpdateItem(itemId, {
        pendingImageUris: [
          ...(items.find((i) => i.id === itemId)?.pendingImageUris ?? []),
          uri,
        ],
      })
    }
  }

  function handleDateChange(itemId: string, event: any, selectedDate?: Date) {
    setShowDatePickerFor(null)
    if (event.type === 'set' && selectedDate) {
      onUpdateItem(itemId, { delivery_date: toYmd(selectedDate) })
    }
  }

  function toggleExpand(itemId: string) {
    setExpandedId((prev) => (prev === itemId ? null : itemId))
  }

  return (
    <SwipeDismissSheet visible={open} onRequestClose={onClose} title={`Sepet (${items.length})`}>
      <View style={styles.drawerColumn}>
        <ScrollView
          style={[styles.drawerScroll, { height: drawerBodyHeight, maxHeight: drawerBodyHeight }]}
          contentContainerStyle={styles.drawerScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <Text style={styles.empty}>Sepet boş</Text>
          ) : (
            items.map((item, index) => {
              const previews = cartLinePreviewUris(item)
              const isExpanded = expandedId === item.id
              return (
                <View key={item.id} style={styles.line}>
                  {/* Header - Her Zaman Görünür */}
                  <Pressable 
                    style={styles.lineHeader}
                    onPress={() => toggleExpand(item.id)}
                  >
                    <View style={styles.lineHeaderLeft}>
                      <View style={styles.lineQtyRow}>
                        <Text style={styles.lineQtyLabel}>Miktar</Text>
                        <View style={styles.lineQtyBox}>
                          <Text style={styles.lineQtyValue}>{item.quantity}</Text>
                        </View>
                        <Pressable onPress={(e) => e.stopPropagation()}>
                          <UnitSelector 
                            currentUnit={item.unit || 'Adet'}
                            onSelectUnit={(unit) => onUpdateUnit(item.id, unit)}
                          />
                        </Pressable>
                      </View>
                      <Text style={styles.lineTitle} numberOfLines={2}>
                        {item.material_name}
                      </Text>
                      {item.delivery_date ? (
                        <Text style={styles.lineMeta}>Teslim {item.delivery_date}</Text>
                      ) : null}
                    </View>
                    <View style={styles.lineHeaderRight}>
                      <MaterialIcons 
                        name={isExpanded ? 'expand-less' : 'expand-more'} 
                        size={24} 
                        color={stats.onSurfaceVariant} 
                      />
                    </View>
                  </Pressable>

                  {/* Expanded Detail - Sadece Açıksa Görünür */}
                  {isExpanded && (
                    <View style={styles.detailSection}>
                      {/* Ürün Adı */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Ürün adı</Text>
                        <TextInput
                          style={styles.input}
                          value={item.material_name}
                          onChangeText={(text) => onUpdateItem(item.id, { material_name: text })}
                          placeholder="Ürün adını girin"
                        />
                      </View>

                      {/* Açıklama */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Açıklama (opsiyonel)</Text>
                        <TextInput
                          style={[styles.input, styles.inputMultiline]}
                          value={item.material_description}
                          onChangeText={(text) => onUpdateItem(item.id, { material_description: text })}
                          placeholder="Ürün hakkında detay ekleyin"
                          multiline
                          numberOfLines={2}
                        />
                      </View>

                      {/* Marka */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Marka (opsiyonel)</Text>
                        <TextInput
                          style={styles.input}
                          value={item.brand}
                          onChangeText={(text) => onUpdateItem(item.id, { brand: text })}
                          placeholder="Marka adı"
                        />
                      </View>

                      {/* Özellikler */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Özellikler (opsiyonel)</Text>
                        <TextInput
                          style={[styles.input, styles.inputMultiline]}
                          value={item.specifications}
                          onChangeText={(text) => onUpdateItem(item.id, { specifications: text })}
                          placeholder="Boyut, renk, model vb."
                          multiline
                          numberOfLines={2}
                        />
                      </View>

                      {/* Kullanım Amacı */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Kullanım amacı *</Text>
                        <TextInput
                          style={[styles.input, styles.inputMultiline]}
                          value={item.purpose}
                          onChangeText={(text) => onUpdateItem(item.id, { purpose: text })}
                          placeholder="Bu ürün nerede kullanılacak?"
                          multiline
                          numberOfLines={2}
                        />
                      </View>

                      {/* Teslimat Tarihi */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Teslimat tarihi *</Text>
                        <Pressable
                          style={styles.dateButton}
                          onPress={() => setShowDatePickerFor(item.id)}
                        >
                          <Text style={item.delivery_date ? styles.dateText : styles.datePlaceholder}>
                            {item.delivery_date ? formatTrDateLabel(item.delivery_date) : 'Tarih seçin'}
                          </Text>
                          <MaterialIcons name="event" size={20} color={stats.primary} />
                        </Pressable>
                        {showDatePickerFor === item.id && (
                          <DateTimePicker
                            value={item.delivery_date ? parseYmdToLocalDate(item.delivery_date) || startOfToday() : startOfToday()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => handleDateChange(item.id, event, date)}
                            minimumDate={startOfToday()}
                          />
                        )}
                      </View>

                      {/* Fotoğraflar */}
                      {previews.length > 0 && (
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Fotoğraflar</Text>
                          <View style={styles.lineThumbs}>
                            {previews.map((uri, i) => (
                              <Image key={`${item.id}-img-${i}`} source={{ uri }} style={styles.lineThumb} />
                            ))}
                          </View>
                        </View>
                      )}

                      <Pressable 
                        style={styles.photoButton}
                        onPress={() => handlePickImage(item.id)}
                      >
                        <MaterialIcons name="add-photo-alternate" size={20} color={stats.primary} />
                        <Text style={styles.photoButtonText}>Fotoğraf ekle</Text>
                      </Pressable>

                      {/* Aksiyon Butonları */}
                      <View style={styles.detailActions}>
                        <Pressable 
                          style={styles.dangerButton}
                          onPress={() => onRemove(item.id)}
                        >
                          <MaterialIcons name="delete" size={18} color={stats.error} />
                          <Text style={styles.dangerButtonText}>Sil</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
        <View style={[styles.drawerActions, { paddingBottom: footerPad }]}>
          <Pressable style={styles.btnGhost} onPress={onClose}>
            <Text style={styles.btnGhostText}>Kapat</Text>
          </Pressable>
          <Pressable
            style={[styles.btnGo, (items.length === 0 || submitting) && styles.btnDisabled]}
            disabled={items.length === 0 || submitting}
            onPress={onSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={stats.onPrimary} />
            ) : (
              <Text style={styles.btnGoText}>Talebi oluştur</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SwipeDismissSheet>
  )
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    paddingHorizontal: CART_HORIZONTAL_INSET,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: stats.primary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 9999,
    alignSelf: 'stretch',
    borderWidth: 0,
    ...(stats.shadowSm ?? {}),
    elevation: 8,
  },
  barBadge: {
    backgroundColor: stats.surfaceBright,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 12,
  },
  barBadgeText: {
    color: stats.primary,
    fontFamily: statsFont.bold,
    fontSize: 14,
  },
  barText: { ...statsType.bodyLg, fontFamily: statsFont.bold, color: stats.onPrimary },
  drawerColumn: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 20,
  },
  drawerScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  drawerScrollContent: {
    paddingBottom: 12,
  },
  empty: { textAlign: 'center', ...statsType.bodyMd, color: stats.onSurfaceVariant, padding: 24 },
  line: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stats.outlineVariant,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  lineHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  lineHeaderRight: {
    paddingLeft: 12,
    justifyContent: 'center',
  },
  lineTextCol: { flex: 1, minWidth: 0 },
  lineQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lineQtyLabel: {
    ...statsType.labelMd,
    fontFamily: statsFont.semibold,
    color: stats.onSurfaceVariant,
  },
  lineQtyBox: {
    backgroundColor: stats.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lineQtyValue: {
    fontFamily: statsFont.bold,
    fontSize: 15,
    color: stats.primary,
  },
  unitSelectorContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: stats.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: stats.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unitButtonText: {
    fontFamily: statsFont.semibold,
    fontSize: 14,
    color: stats.primary,
  },
  unitDropdown: {
    position: 'absolute',
    top: 32,
    left: 0,
    right: 0,
    maxHeight: 180,
    backgroundColor: stats.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    ...(stats.shadowMd ?? {}),
    elevation: 8,
    zIndex: 2000,
  },
  unitDropdownScroll: {
    maxHeight: 180,
  },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stats.outlineVariant,
  },
  unitOptionSelected: {
    backgroundColor: `${stats.primaryContainer}66`,
  },
  unitOptionText: {
    ...statsType.bodyMd,
    color: stats.onSurface,
  },
  unitOptionTextSelected: {
    fontFamily: statsFont.bold,
    color: stats.primary,
  },
  lineQtyTop: {
    ...statsType.labelMd,
    fontFamily: statsFont.semibold,
    color: stats.primary,
    marginBottom: 6,
  },
  lineQtyTopValue: {
    fontFamily: statsFont.bold,
    fontSize: 16,
    color: stats.primary,
  },
  lineTitle: { fontFamily: statsFont.semibold, fontSize: 16, color: stats.onSurface },
  lineMeta: { ...statsType.labelSm, color: stats.onSurfaceVariant, marginTop: 4 },
  detailSection: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...statsType.labelMd,
    fontFamily: statsFont.semibold,
    color: stats.onSurface,
  },
  input: {
    ...statsType.bodyMd,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: stats.surfaceContainerLowest,
    color: stats.onSurface,
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: stats.surfaceContainerLowest,
  },
  dateText: {
    ...statsType.bodyMd,
    color: stats.onSurface,
  },
  datePlaceholder: {
    ...statsType.bodyMd,
    color: stats.onSurfaceVariant,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: stats.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: `${stats.primaryContainer}33`,
  },
  photoButtonText: {
    fontFamily: statsFont.semibold,
    fontSize: 14,
    color: stats.primary,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: stats.error,
    backgroundColor: `${stats.errorContainer}33`,
  },
  dangerButtonText: {
    fontFamily: statsFont.semibold,
    fontSize: 14,
    color: stats.error,
  },
  lineThumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  lineThumb: {
    width: 44,
    height: 44,
    borderRadius: stats.radiusLg,
    backgroundColor: stats.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: stats.outlineVariant,
    resizeMode: 'cover',
  },
  drawerActions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: stats.outlineVariant,
    backgroundColor: stats.surfaceBright,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    backgroundColor: stats.surfaceContainerLow,
    alignItems: 'center',
  },
  btnGhostText: { fontFamily: statsFont.bold, fontSize: 16, color: stats.onSurface },
  btnGo: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 20,
    backgroundColor: stats.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...(stats.shadowSm ?? {}),
  },
  btnGoText: { fontFamily: statsFont.bold, fontSize: 16, color: stats.onPrimary },
  btnDisabled: { opacity: 0.45 },
})
