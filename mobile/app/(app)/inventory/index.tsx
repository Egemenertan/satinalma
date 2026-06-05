import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { SwipeDismissSheet } from '../../../src/components/island/SwipeDismissSheet'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../../../src/components/island/islandTokens'
import { supabase } from '../../../src/lib/supabase'
import { useAuth } from '../../../src/providers/AuthProvider'

type InventoryRow = {
  id: string
  item_name: string
  quantity: number
  unit: string
  assigned_date: string
  status: string
  notes: string | null
  category: string | null
  consumed_quantity: number | null
  product_id: string | null
  assigned_by_profile?: { full_name: string | null; email: string | null } | null
  purchase_request?: { request_number: string; id: string } | null
  product?: { category: string | null } | null
}

export default function InventoryScreen() {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language.startsWith('en') ? 'en-US' : 'tr-TR'
  const { user, profile } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [consumeOpen, setConsumeOpen] = useState(false)
  const [selected, setSelected] = useState<InventoryRow | null>(null)
  const [consumeQty, setConsumeQty] = useState('')
  const [consuming, setConsuming] = useState(false)

  const {
    data: items = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['user_inventory', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_inventory')
        .select(
          `
          *,
          assigned_by_profile:assigned_by ( full_name, email ),
          purchase_request:purchase_requests ( request_number, id ),
          product:products ( category )
        `
        )
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .order('assigned_date', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as InventoryRow[]
    },
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const getUniqueCount = () => new Set(items.map((i) => i.item_name)).size
  const getTotalQty = () => items.reduce((s, i) => s + i.quantity, 0)

  const isConsumable = (item: InventoryRow) => {
    const c = item.category || item.product?.category
    return c === 'kontrollü sarf' || c === 'sarf malzemesi'
  }

  const remaining = (item: InventoryRow) => item.quantity - (item.consumed_quantity || 0)

  const openConsume = (item: InventoryRow) => {
    setSelected(item)
    setConsumeQty('')
    setConsumeOpen(true)
  }

  const handleConsume = async () => {
    if (!selected) return
    const q = parseFloat(consumeQty.replace(',', '.'))
    if (!consumeQty.trim() || isNaN(q) || q <= 0) {
      Alert.alert(t('common.error'), t('inventory.invalidQty'))
      return
    }
    const rem = remaining(selected)
    if (q > rem) {
      Alert.alert(t('common.error'), t('inventory.maxQty', { max: rem, unit: selected.unit }))
      return
    }
    setConsuming(true)
    try {
      const newConsumed = (selected.consumed_quantity || 0) + q
      const newStatus = newConsumed >= selected.quantity ? 'returned' : 'active'
      const { error } = await supabase
        .from('user_inventory')
        .update({
          consumed_quantity: newConsumed,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id)
      if (error) {
        Alert.alert(t('common.error'), error.message)
        return
      }
      Alert.alert(t('common.ok'), t('inventory.saved', { qty: q, unit: selected.unit }))
      setConsumeOpen(false)
      setSelected(null)
      await refetch()
    } finally {
      setConsuming(false)
    }
  }

  if (!user || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#01E884" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.h1}>{t('inventory.title')}</Text>
        <Text style={styles.h2}>{profile.full_name || profile.email || t('common.user')}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('inventory.variety')}</Text>
          <Text style={styles.statVal}>{getUniqueCount()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('inventory.totalQty')}</Text>
          <Text style={styles.statVal}>{getTotalQty()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('inventory.activeRecords')}</Text>
          <Text style={styles.statVal}>{items.length}</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#01E884" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('inventory.empty')}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.item_name}</Text>
                <Text style={styles.cardLine}>
                {t('inventory.qty')}: {item.quantity} {item.unit}
              </Text>
              {isConsumable(item) ? (
                <Text style={styles.cardLine}>
                  {t('inventory.consume')}: {item.consumed_quantity || 0} · {t('inventory.remaining')}:{' '}
                  {remaining(item)} {item.unit}
                </Text>
              ) : null}
              <Text style={styles.cardMuted}>
                {t('inventory.date')}:{' '}
                {new Date(item.assigned_date).toLocaleDateString(dateLocale, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              {item.purchase_request?.request_number ? (
                <Text style={styles.cardMuted}>
                  {t('inventory.request')}: {item.purchase_request.request_number}
                </Text>
              ) : null}
              {isConsumable(item) && remaining(item) > 0 ? (
                <Pressable style={styles.sarfBtn} onPress={() => openConsume(item)}>
                  <Text style={styles.sarfBtnText}>{t('inventory.consumeBtn')}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}

      <SwipeDismissSheet
        visible={consumeOpen}
        onRequestClose={() => {
          setConsumeOpen(false)
          setSelected(null)
        }}
        title={t('inventory.sheetTitle')}
        maxHeightRatio={0.5}
      >
        <View style={{ paddingHorizontal: 20 }}>
          {selected ? (
            <Text style={styles.modalSub}>
              {t('inventory.sheetSub', {
                name: selected.item_name,
                remaining: remaining(selected),
                unit: selected.unit,
              })}
            </Text>
          ) : null}
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder={t('inventory.qtyPh')}
            value={consumeQty}
            onChangeText={setConsumeQty}
          />
          <View style={styles.modalActions}>
            <Pressable
              style={styles.btnGhost}
              onPress={() => {
                setConsumeOpen(false)
                setSelected(null)
              }}
            >
              <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, consuming && styles.btnDisabled]}
              disabled={consuming}
              onPress={() => void handleConsume()}
            >
              <Text style={styles.btnPrimaryText}>{consuming ? '…' : t('common.save')}</Text>
            </Pressable>
          </View>
        </View>
      </SwipeDismissSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  head: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  h1: { fontSize: 22, fontWeight: '800', color: '#111827' },
  h2: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: '800', color: '#111827' },
  list: { paddingHorizontal: 16, paddingBottom: ISLAND_BOTTOM_BAR_CONTENT_INSET + 12 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardLine: { fontSize: 14, color: '#374151', marginTop: 6 },
  cardMuted: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  sarfBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sarfBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalSub: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  btnGhost: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  btnGhostText: { fontWeight: '700', color: '#374151' },
  btnPrimary: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#01E884', alignItems: 'center' },
  btnPrimaryText: { fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
})
