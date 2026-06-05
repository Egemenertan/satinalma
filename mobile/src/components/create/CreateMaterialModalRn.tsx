import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SwipeDismissSheet } from '../island/SwipeDismissSheet'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  supabase: SupabaseClient
  visible: boolean
  onClose: () => void
  initialClass: string
  initialGroup: string
  initialItemName: string
  restrictToStationery: boolean
  onCreated: (material: { class: string; group: string; item_name: string }) => void
}

export function CreateMaterialModalRn({
  supabase,
  visible,
  onClose,
  initialClass,
  initialGroup,
  initialItemName,
  restrictToStationery,
  onCreated,
}: Props) {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [cls, setCls] = useState(initialClass)
  const [grp, setGrp] = useState(initialGroup)
  const [itemName, setItemName] = useState(initialItemName)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [creating, setCreating] = useState(false)
  const [expandedPicker, setExpandedPicker] = useState<'class' | 'group' | null>(null)

  useEffect(() => {
    if (!visible) {
      setExpandedPicker(null)
      return
    }
    setCls(initialClass)
    setGrp(initialGroup)
    setItemName(initialItemName)
  }, [visible, initialClass, initialGroup, initialItemName])

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const types = restrictToStationery ? ['ofis'] : ['insaat']
      const { data, error } = await supabase
        .from('material_categories')
        .select('id, name')
        .in('category_type', types)
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      setClasses((data as { id: string; name: string }[]) ?? [])
    } catch {
      setClasses([])
    } finally {
      setLoadingClasses(false)
    }
  }, [supabase, restrictToStationery])

  useEffect(() => {
    if (!visible) return
    void loadClasses()
  }, [visible, loadClasses])

  useEffect(() => {
    if (!visible || !cls) {
      setGroups([])
      return
    }
    setLoadingGroups(true)
    void (async () => {
      const { data, error } = await supabase
        .from('all_materials')
        .select('group')
        .eq('class', cls)
        .not('group', 'is', null)
        .not('group', 'eq', '')
      if (error) {
        setGroups([])
        setLoadingGroups(false)
        return
      }
      const names = [...new Set((data ?? []).map((r: { group: string }) => r.group).filter(Boolean))] as string[]
      names.sort((a, b) => a.localeCompare(b, 'tr'))
      setGroups(names)
      setLoadingGroups(false)
    })()
  }, [cls, visible, supabase])

  async function handleCreate() {
    if (!cls || !grp || !itemName.trim()) {
      return
    }
    setCreating(true)
    try {
      const { error } = await supabase.from('all_materials').insert({
        class: cls,
        group: grp,
        item_name: itemName.trim(),
      })
      if (error) throw error
      
      const createdMaterial = { class: cls, group: grp, item_name: itemName.trim() }
      setItemName('')
      setCreating(false)
      onClose()
      
      // Modal kapandıktan sonra callback'i çağır
      setTimeout(() => {
        onCreated(createdMaterial)
      }, 350)
    } catch {
      setCreating(false)
    }
  }

  const togglePicker = (type: 'class' | 'group') => {
    if (type === 'group' && !cls) return
    setExpandedPicker(expandedPicker === type ? null : type)
  }

  return (
    <SwipeDismissSheet visible={visible} onRequestClose={onClose} title="Yeni malzeme ekle" maxHeightRatio={0.9}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Aradığınız malzemeyi sisteme ekleyin</Text>

        {/* Malzeme Sınıfı */}
        <Text style={styles.label}>Malzeme sınıfı</Text>
        <Pressable 
          style={[styles.select, expandedPicker === 'class' && styles.selectActive]} 
          onPress={() => togglePicker('class')}
        >
          <Text style={cls ? styles.selectText : styles.selectPlaceholder}>
            {cls || 'Sınıf seçin…'}
          </Text>
          <Text style={styles.chevron}>{expandedPicker === 'class' ? '▲' : '▼'}</Text>
        </Pressable>

        {expandedPicker === 'class' && (
          <View style={styles.pickerContainer}>
            {loadingClasses ? (
              <ActivityIndicator style={{ padding: 20 }} color="#01E884" />
            ) : classes.length === 0 ? (
              <Text style={styles.pickerEmpty}>Sınıf bulunamadı</Text>
            ) : (
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {classes.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.pickerRow, cls === c.name && styles.pickerRowSelected]}
                    onPress={() => {
                      setCls(c.name)
                      setGrp('')
                      setExpandedPicker(null)
                    }}
                  >
                    <Text style={[styles.pickerRowText, cls === c.name && styles.pickerRowTextSelected]}>
                      {c.name}
                    </Text>
                    {cls === c.name && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Malzeme Grubu */}
        <Text style={styles.label}>Malzeme grubu</Text>
        <Pressable 
          style={[
            styles.select, 
            !cls && styles.selectDisabled,
            expandedPicker === 'group' && styles.selectActive
          ]} 
          onPress={() => togglePicker('group')}
          disabled={!cls}
        >
          <Text style={grp ? styles.selectText : styles.selectPlaceholder}>
            {grp || (cls ? 'Grup seçin…' : 'Önce sınıf seçin')}
          </Text>
          <Text style={[styles.chevron, !cls && { opacity: 0.4 }]}>{expandedPicker === 'group' ? '▲' : '▼'}</Text>
        </Pressable>

        {expandedPicker === 'group' && (
          <View style={styles.pickerContainer}>
            {loadingGroups ? (
              <ActivityIndicator style={{ padding: 20 }} color="#01E884" />
            ) : groups.length === 0 ? (
              <Text style={styles.pickerEmpty}>Grup bulunamadı</Text>
            ) : (
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {groups.map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.pickerRow, grp === g && styles.pickerRowSelected]}
                    onPress={() => {
                      setGrp(g)
                      setExpandedPicker(null)
                    }}
                  >
                    <Text style={[styles.pickerRowText, grp === g && styles.pickerRowTextSelected]}>
                      {g}
                    </Text>
                    {grp === g && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Malzeme Adı */}
        <Text style={styles.label}>Malzeme adı</Text>
        <TextInput
          style={styles.input}
          value={itemName}
          onChangeText={setItemName}
          placeholder="Örn. vida M6"
          placeholderTextColor="#9ca3af"
          onFocus={() => setExpandedPicker(null)}
        />

        {/* Butonlar */}
        <View style={styles.actions}>
          <Pressable style={styles.btnGhost} onPress={onClose} disabled={creating}>
            <Text style={styles.btnGhostText}>İptal</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, (!cls || !grp || !itemName.trim() || creating) && styles.btnDisabled]}
            disabled={!cls || !grp || !itemName.trim() || creating}
            onPress={() => void handleCreate()}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Oluştur</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SwipeDismissSheet>
  )
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  select: {
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectActive: {
    borderColor: '#01E884',
    backgroundColor: '#f0fdf4',
  },
  selectDisabled: { opacity: 0.5 },
  selectText: { fontSize: 16, color: '#111827', flex: 1 },
  selectPlaceholder: { fontSize: 16, color: '#9ca3af', flex: 1 },
  chevron: { fontSize: 12, color: '#6b7280', marginLeft: 8 },
  pickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    maxHeight: 220,
    overflow: 'hidden',
  },
  pickerScroll: {
    maxHeight: 218,
  },
  pickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerRowSelected: {
    backgroundColor: '#f0fdf4',
  },
  pickerRowText: {
    fontSize: 15,
    color: '#374151',
  },
  pickerRowTextSelected: {
    color: '#047857',
    fontWeight: '600',
  },
  checkmark: {
    color: '#01E884',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerEmpty: {
    padding: 20,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
  },
  input: {
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: '#111827',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnGhost: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  btnGhostText: { fontWeight: '600', color: '#374151' },
  btnPrimary: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#01E884', alignItems: 'center' },
  btnPrimaryText: { fontWeight: '700', color: '#111827' },
  btnDisabled: { opacity: 0.45 },
})
