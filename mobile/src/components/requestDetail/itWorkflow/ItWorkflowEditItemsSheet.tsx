import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SwipeDismissSheet } from '../../island/SwipeDismissSheet'
import type { PurchaseRequestItemRow } from '../../../lib/requestOfferBundle'
import {
  draftsFromItems,
  type ItWorkflowItemDraft,
} from '../../../features/itWorkflow/itWorkflowPersistItemEdits'
import { stats, statsCardSurface, statsFont, statsType } from '../../../theme/statsDesignTokens'

type Props = {
  visible: boolean
  items: PurchaseRequestItemRow[]
  saving: boolean
  onClose: () => void
  onSave: (drafts: Record<string, ItWorkflowItemDraft>) => Promise<void>
}

export function ItWorkflowEditItemsSheet({
  visible,
  items,
  saving,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets()
  /** Sunucudan gelen kalemler — ilk render ile senkron (useEffect beklenmez); modal hemen dolu görünür */
  const baseline = useMemo(() => draftsFromItems(items), [items])
  const [drafts, setDrafts] = useState<Record<string, ItWorkflowItemDraft>>({})

  const lineDraft = (lineId: string): ItWorkflowItemDraft | undefined =>
    drafts[lineId] ?? baseline[lineId]

  const updateLine = (id: string, patch: Partial<ItWorkflowItemDraft>) => {
    setDrafts((prev) => {
      const cur = prev[id] ?? baseline[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, ...patch } }
    })
  }

  const mergedForSave = (): Record<string, ItWorkflowItemDraft> => ({
    ...baseline,
    ...drafts,
  })

  useEffect(() => {
    if (!visible) setDrafts({})
  }, [visible])

  return (
    <SwipeDismissSheet visible={visible} onRequestClose={onClose} title="Sepeti görüntüle / düzenle" maxHeightRatio={0.92}>
      <View style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: stats.marginMobile,
            paddingBottom: 24 + insets.bottom,
            flexGrow: 1,
            minHeight: 280,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hint}>
            Ürün adı ve markayı güncelledikçe kart üstündeki özet de yenilenir. Kaydettiğinizde talep detayında da aynı
            şekilde görünür.
          </Text>

          {items.length === 0 ? (
            <Text style={styles.empty}>Bu talepte düzenlenecek kalem yok.</Text>
          ) : (
            items.map((line) => {
              const d = lineDraft(line.id)
              if (!d) return null
              return (
                <View key={line.id} style={[statsCardSurface.listItem, styles.card]}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {d.item_name.trim() || line.item_name || 'Kalem'}
                    </Text>
                    <View style={styles.brandPreviewRow}>
                      <Text style={styles.brandPreviewLabel}>Marka</Text>
                      <Text style={styles.brandPreviewValue} numberOfLines={3}>
                        {d.brand.trim() ? d.brand.trim() : 'Henüz yok — marka alanına yazdıkça burada görünür'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.label}>Ürün adı</Text>
                  <TextInput
                    style={styles.input}
                    value={d.item_name}
                    onChangeText={(t) => updateLine(line.id, { item_name: t })}
                    placeholder="Ürün adı"
                    placeholderTextColor={stats.outline}
                  />

                  <Text style={styles.label}>Marka</Text>
                  <TextInput
                    style={[styles.input, styles.inputBrand]}
                    value={d.brand}
                    onChangeText={(t) => updateLine(line.id, { brand: t })}
                    placeholder="Örn. Siemens, Schneider, yerli muadil…"
                    placeholderTextColor={stats.outline}
                    autoCapitalize="words"
                    {...Platform.select({
                      android: { includeFontPadding: false },
                      default: {},
                    })}
                  />

                  <Text style={styles.label}>Açıklama</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={d.description}
                    onChangeText={(t) => updateLine(line.id, { description: t })}
                    placeholder="İsteğe bağlı kısa açıklama"
                    placeholderTextColor={stats.outline}
                    multiline
                  />

                  <View style={styles.row2}>
                    <View style={styles.col}>
                      <Text style={styles.label}>Miktar</Text>
                      <TextInput
                        style={styles.input}
                        value={d.quantity}
                        onChangeText={(t) => updateLine(line.id, { quantity: t })}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={stats.outline}
                      />
                    </View>
                    <View style={styles.col}>
                      <Text style={styles.label}>Birim</Text>
                      <TextInput
                        style={styles.input}
                        value={d.unit}
                        onChangeText={(t) => updateLine(line.id, { unit: t })}
                        placeholder="Adet"
                        placeholderTextColor={stats.outline}
                      />
                    </View>
                  </View>

                  <Text style={styles.label}>Teslim tarihi (YYYY-AA-GG)</Text>
                  <TextInput
                    style={styles.input}
                    value={d.delivery_date}
                    onChangeText={(t) => updateLine(line.id, { delivery_date: t })}
                    placeholder="Örn. 2026-06-01"
                    placeholderTextColor={stats.outline}
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>Teknik özellikler</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={d.specifications}
                    onChangeText={(t) => updateLine(line.id, { specifications: t })}
                    placeholder="Özellikler"
                    placeholderTextColor={stats.outline}
                    multiline
                  />

                  <Text style={styles.label}>Kullanım amacı</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={d.purpose}
                    onChangeText={(t) => updateLine(line.id, { purpose: t })}
                    placeholder="Amaç"
                    placeholderTextColor={stats.outline}
                    multiline
                  />
                </View>
              )
            })
          )}

          <View style={styles.footerRow}>
            <Pressable style={styles.btnGhost} onPress={onClose} disabled={saving}>
              <Text style={styles.btnGhostText}>İptal</Text>
            </Pressable>
            <Pressable
              style={[styles.btnOk, saving && styles.btnDisabled]}
              disabled={saving || items.length === 0}
              onPress={() => void onSave(mergedForSave())}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnOkText}>Kaydet</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SwipeDismissSheet>
  )
}

const styles = StyleSheet.create({
  hint: {
    ...statsType.bodyMd,
    color: stats.onSurfaceVariant,
    marginBottom: 14,
  },
  empty: { ...statsType.bodyMd, color: stats.onSurfaceVariant, textAlign: 'center', marginVertical: 24 },
  card: {
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
  },
  cardHead: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stats.outlineVariant,
  },
  brandPreviewRow: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: stats.radiusLg,
    backgroundColor: `${stats.primaryContainer}55`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: stats.outlineVariant,
  },
  brandPreviewLabel: {
    ...statsType.labelSm,
    fontFamily: statsFont.semibold,
    color: stats.onSurfaceVariant,
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  brandPreviewValue: {
    ...statsType.bodyMd,
    fontFamily: statsFont.semibold,
    color: stats.onSurface,
    lineHeight: 22,
  },
  cardTitle: {
    fontFamily: statsFont.bold,
    fontSize: 15,
    color: stats.onSurface,
    marginBottom: 0,
  },
  label: { ...statsType.labelSm, color: stats.onSurfaceVariant, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    borderRadius: stats.radiusLg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...statsType.bodyMd,
    color: stats.onSurface,
    marginBottom: 12,
    ...Platform.select({
      android: { minHeight: 48 },
      default: {},
    }),
  },
  inputBrand: Platform.select({
    android: { paddingVertical: 12 },
    default: {},
  }),
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnGhost: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: stats.radiusXl,
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    backgroundColor: stats.surfaceContainerLowest,
  },
  btnGhostText: { fontFamily: statsFont.semibold, color: stats.onSurface },
  btnOk: {
    flex: 1.2,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: stats.radiusXl,
    backgroundColor: stats.primary,
    ...(stats.shadowSm ?? {}),
  },
  btnOkText: { fontFamily: statsFont.semibold, fontSize: 15, color: stats.onPrimary },
  btnDisabled: { opacity: 0.55 },
})
