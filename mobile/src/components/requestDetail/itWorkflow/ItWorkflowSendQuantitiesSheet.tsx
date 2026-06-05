import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
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
import { stats, statsCardSurface, statsFont, statsType } from '../../../theme/statsDesignTokens'

type Props = {
  visible: boolean
  items: PurchaseRequestItemRow[]
  busy: boolean
  onClose: () => void
  onConfirm: (quantities: Record<string, string>) => Promise<void>
}

export function ItWorkflowSendQuantitiesSheet({ visible, items, busy, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets()
  const [qty, setQty] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visible) {
      const init: Record<string, string> = {}
      for (const it of items) {
        init[it.id] = it.quantity > 0 ? String(it.quantity) : '0'
      }
      setQty(init)
    }
  }, [visible, items])

  const setLine = (id: string, value: string) => {
    setQty((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <SwipeDismissSheet visible={visible} onRequestClose={onClose} title="Gönderim miktarları" maxHeightRatio={0.88}>
      <View style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: stats.marginMobile,
            paddingBottom: 24 + insets.bottom,
          }}
        >
          <Text style={styles.hint}>
            Şantiyeye gönderilecek adedi her kalem için girin. Kayıtlar oluşturulur ve talep &quot;gönderildi&quot; olur.
          </Text>

          {items.map((item) => (
            <View key={item.id} style={[statsCardSurface.listItem, styles.row]}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.item_name}
              </Text>
              <Text style={styles.rem}>
                Kalan: {item.quantity} {item.unit}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={qty[item.id] ?? '0'}
                onChangeText={(t) => setLine(item.id, t)}
                editable={item.quantity > 0 && !busy}
              />
            </View>
          ))}

          <View style={styles.footerRow}>
            <Pressable style={styles.btnGhost} onPress={onClose} disabled={busy}>
              <Text style={styles.btnGhostText}>Vazgeç</Text>
            </Pressable>
            <Pressable
              style={[styles.btnOk, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void onConfirm(qty)}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnOkText}>Gönder</Text>
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
  row: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    gap: 8,
  },
  itemName: { fontFamily: statsFont.semibold, fontSize: 14, color: stats.onSurface },
  rem: { ...statsType.labelSm, color: stats.onSurfaceVariant },
  input: {
    borderWidth: 1,
    borderColor: stats.outlineVariant,
    borderRadius: stats.radiusLg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...statsType.bodyMd,
    color: stats.onSurface,
  },
  footerRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
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
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: stats.radiusXl,
    backgroundColor: '#059669',
    ...(stats.shadowSm ?? {}),
  },
  btnOkText: { fontFamily: statsFont.semibold, fontSize: 15, color: '#ffffff' },
  btnDisabled: { opacity: 0.55 },
})
