import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  performMaterialSearch,
  type LocalMaterialCandidate,
  type MaterialSearchResult,
} from '../../lib/materialSearch'
import { useTranslation } from 'react-i18next'

type Props = {
  supabase: SupabaseClient
  value: string
  onChange: (v: string) => void
  restrictToStationery: boolean
  allowedCategoryNames: string[]
  localCreatedMaterials: LocalMaterialCandidate[]
  onResultClick: (r: MaterialSearchResult) => void
  onCreateNewClick: () => void
  placeholder?: string
}

export function MaterialSearchBarRn({
  supabase,
  value,
  onChange,
  restrictToStationery,
  allowedCategoryNames,
  localCreatedMaterials,
  onResultClick,
  onCreateNewClick,
  placeholder,
}: Props) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('materialSearch.defaultPh')

  const [isSearching, setIsSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<MaterialSearchResult[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!trimmed || trimmed.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      setIsSearching(true)
      setOpen(true)
      try {
        const r = await performMaterialSearch(supabase, {
          query: trimmed,
          restrictToStationery,
          allowedCategoryNames,
          localCreatedMaterials,
        })
        setResults(r)
      } finally {
        setIsSearching(false)
      }
    },
    [supabase, restrictToStationery, allowedCategoryNames, localCreatedMaterials]
  )

  const onChangeText = useCallback(
    (text: string) => {
      onChange(text)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void runSearch(text)
      }, 300)
    },
    [onChange, runSearch]
  )

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const showDropdown = open && value.trim().length >= 2

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="travel-explore" size={26} color="#01E884" />
        </View>
        <View style={styles.inputSlot}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={resolvedPlaceholder}
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            onFocus={() => {
              setOpen(true)
              if (value.trim().length >= 2) void runSearch(value)
            }}
          />
        </View>
        {isSearching ? <ActivityIndicator style={styles.loader} color="#01E884" /> : null}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {isSearching ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#9ca3af" />
              <Text style={styles.loadingText}>{t('materialSearch.searching')}</Text>
            </View>
          ) : results.length > 0 ? (
            <>
              <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {results.map((r, index) => (
                  <Pressable
                    key={`${r.class}-${r.group}-${r.item_name}-${index}`}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                    onPress={() => {
                      Keyboard.dismiss()
                      setOpen(false)
                      onResultClick(r)
                    }}
                  >
                    <Text style={styles.resultName} numberOfLines={2}>
                      {r.item_name}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {r.group} → {r.class}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.createZone}>
                <Pressable
                  style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed]}
                  onPress={() => {
                    Keyboard.dismiss()
                    setOpen(false)
                    onCreateNewClick()
                  }}
                >
                  <Text style={styles.createTitle}>{t('materialSearch.notFoundPrompt')}</Text>
                  <Text style={styles.createSub}>{t('materialSearch.addNew')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>{t('materialSearch.noResults')}</Text>
                <Text style={styles.emptyHint}>{t('materialSearch.quote', { q: value.trim() })}</Text>
              </View>
              <View style={styles.createZone}>
                <Pressable
                  style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed]}
                  onPress={() => {
                    Keyboard.dismiss()
                    setOpen(false)
                    onCreateNewClick()
                  }}
                >
                  <Text style={styles.createTitle}>{t('materialSearch.addNew')}</Text>
                  <Text style={styles.createSub} numberOfLines={1}>
                    {t('materialSearch.createForQuery', { q: value.trim() })}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, zIndex: 50, elevation: 50 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 6,
    height: 56,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f0fdf4',
  },
  inputSlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
    paddingRight: 12,
    margin: 0,
    color: '#111827',
    fontWeight: '500',
    textAlignVertical: 'center',
    ...Platform.select({
      android: { includeFontPadding: false },
      ios: { lineHeight: 20 },
    }),
  },
  loader: { marginRight: 16 },
  dropdown: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 340,
    overflow: 'hidden',
  },
  dropdownScroll: { maxHeight: 240 },
  resultRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  resultRowPressed: { backgroundColor: '#f9fafb' },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resultMeta: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  createZone: {
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 14,
  },
  createBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#01E884',
    padding: 14,
  },
  createBtnPressed: { backgroundColor: '#f0fdf4' },
  createTitle: { fontSize: 14, fontWeight: '700', color: '#01E884' },
  createSub: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  emptyBox: { padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  emptyHint: { fontSize: 13, color: '#9ca3af' },
  loadingBox: { padding: 28, alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#6b7280', marginTop: 12 },
})
