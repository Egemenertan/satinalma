import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SwipeDismissSheet } from '../island/SwipeDismissSheet'
import type { MaterialCategory } from './createTypes'

type Sub = { id: string; name: string }

type Props = {
  categories: MaterialCategory[]
  selectedCategory: string
  onCategorySelect: (name: string) => void
  subCategories: Sub[]
  selectedSubCategory: string
  onSubCategorySelect: (name: string) => void
  isLoading?: boolean
}

export function CategoryTabsRn({
  categories,
  selectedCategory,
  onCategorySelect,
  subCategories,
  selectedSubCategory,
  onSubCategorySelect,
  isLoading = false,
}: Props) {
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false)

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#9ca3af" />
        <Text style={styles.loadingText}>Kategoriler yükleniyor…</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.categoryHeaderRow}>
        <Text style={styles.sectionTitle}>Kategori</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          style={styles.chipAll}
          onPress={() => setAllCategoriesOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Tüm kategoriler"
        >
          <Text style={styles.chipAllText}>Tümü</Text>
        </Pressable>
        {categories.map((c) => {
          const on = selectedCategory === c.name
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => onCategorySelect(c.name)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {subCategories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.row, styles.subRow]}
        >
          <Pressable
            style={[styles.chipSm, selectedSubCategory === '' && styles.chipOn]}
            onPress={() => onSubCategorySelect('')}
          >
            <Text style={[styles.chipTextSm, selectedSubCategory === '' && styles.chipTextOn]} numberOfLines={1}>
              Tümü
            </Text>
          </Pressable>
          {subCategories.map((s) => {
            const on = selectedSubCategory === s.name
            return (
              <Pressable
                key={s.id}
                style={[styles.chipSm, on && styles.chipOn]}
                onPress={() => onSubCategorySelect(s.name)}
              >
                <Text style={[styles.chipTextSm, on && styles.chipTextOn]} numberOfLines={1}>
                  {s.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}

      <SwipeDismissSheet
        visible={allCategoriesOpen}
        onRequestClose={() => setAllCategoriesOpen(false)}
        title="Kategoriler"
        maxHeightRatio={0.88}
      >
        <ScrollView
          style={styles.sheetScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridContainer}>
            {categories.map((c) => {
              const on = selectedCategory === c.name
              return (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [
                    styles.gridItem,
                    on && styles.gridItemOn,
                    pressed && styles.gridItemPressed,
                  ]}
                  onPress={() => {
                    onCategorySelect(c.name)
                    setAllCategoriesOpen(false)
                  }}
                >
                  <Text style={[styles.gridItemText, on && styles.gridItemTextOn]} numberOfLines={3}>
                    {c.name}
                  </Text>
                  {on ? (
                    <View style={styles.gridCheckBadge}>
                      <Text style={styles.gridCheck}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </SwipeDismissSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  loading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  loadingText: { color: '#6b7280', marginLeft: 10, fontSize: 14 },
  categoryHeaderRow: { marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 8, paddingVertical: 2 },
  subRow: { marginTop: 10, paddingTop: 0 },
  chipAll: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  chipAllText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    maxWidth: 280,
  },
  chipSm: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    maxWidth: 220,
  },
  chipOn: { backgroundColor: '#01E884', borderColor: '#01E884' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextSm: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextOn: { color: '#fff' },
  sheetScroll: { maxHeight: 600, paddingHorizontal: 16, paddingBottom: 4 },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridItemOn: {
    backgroundColor: '#01E884',
    borderColor: '#01E884',
    shadowColor: '#01E884',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  gridItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  gridItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    lineHeight: 20,
  },
  gridItemTextOn: {
    color: '#ffffff',
  },
  gridCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCheck: {
    fontSize: 16,
    fontWeight: '900',
    color: '#01E884',
  },
})
