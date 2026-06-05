/**
 * Web MaterialSearchBar performSearch ile aynı sorgu, filtre ve sıralama.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type MaterialSearchResult = {
  class: string
  group: string
  item_name: string
  display_text: string
  score?: number
}

export type LocalMaterialCandidate = {
  class: string
  group: string
  item_name: string
}

const OFFICE_CLASS_FALLBACK = [
  'Kırtasiye Malzemeleri',
  'Reklam Ürünleri',
  'Ofis Ekipmanları',
  'Promosyon Ürünleri',
  'Mutfak Malzemeleri',
  'Hijyen ve Temizlik',
] as const

const OFFICE_EXCLUDE_FILTER =
  '("Kırtasiye Malzemeleri","Reklam Ürünleri","Ofis Ekipmanları","Promosyon Ürünleri","Mutfak Malzemeleri","Hijyen ve Temizlik")'

function normalizeCategoryName(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

function buildQueryVariants(trimmedQuery: string): string[] {
  const queryVariants = [trimmedQuery]
  if (trimmedQuery.includes('ı')) {
    queryVariants.push(trimmedQuery.replace(/ı/g, 'i'))
  }
  if (trimmedQuery.includes('i')) {
    queryVariants.push(trimmedQuery.replace(/i/g, 'ı'))
  }
  const spaceNormalizedVariants: string[] = []
  for (const q of queryVariants) {
    const withSpace = q.replace(/([a-zA-ZğüşıöçĞÜŞİÖÇ])(\d)/g, '$1 $2')
    if (withSpace !== q) spaceNormalizedVariants.push(withSpace)
    const withoutSpace = q.replace(/\s+/g, '')
    if (withoutSpace !== q) spaceNormalizedVariants.push(withoutSpace)
  }
  return [...queryVariants, ...spaceNormalizedVariants]
}

export async function performMaterialSearch(
  supabase: SupabaseClient,
  opts: {
    query: string
    restrictToStationery: boolean
    allowedCategoryNames: string[]
    localCreatedMaterials: LocalMaterialCandidate[]
  }
): Promise<MaterialSearchResult[]> {
  const trimmedQuery = opts.query.trim()
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return []
  }

  const categoryNames = opts.allowedCategoryNames
  const allVariants = buildQueryVariants(trimmedQuery)

  const searchConditions = allVariants
    .flatMap((q) => [`item_name.ilike.%${q}%`, `group.ilike.%${q}%`, `class.ilike.%${q}%`])
    .join(',')

  let searchQuery = supabase
    .from('all_materials')
    .select('class, group, item_name, created_at')
    .or(searchConditions)

  if (categoryNames.length === 0 && opts.restrictToStationery) {
    searchQuery = searchQuery.in('class', [...OFFICE_CLASS_FALLBACK])
  } else if (categoryNames.length === 0 && !opts.restrictToStationery) {
    searchQuery = searchQuery.not('class', 'in', OFFICE_EXCLUDE_FILTER)
  }

  const { data, error } = await searchQuery
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1000)

  if (error || !data) {
    return []
  }

  const filteredData =
    categoryNames.length > 0
      ? (() => {
          const allowed = new Set(categoryNames.map((name) => normalizeCategoryName(name)))
          return data.filter((item) => allowed.has(normalizeCategoryName((item.class as string) || '')))
        })()
      : data

  const normalizedQueryForLocal = normalizeCategoryName(trimmedQuery)

  const localMatches = opts.localCreatedMaterials.filter((item) => {
    const itemName = item.item_name || ''
    const groupName = item.group || ''
    const className = item.class || ''

    const categoryMatch =
      categoryNames.length === 0 ||
      categoryNames.map((name) => normalizeCategoryName(name)).includes(normalizeCategoryName(className))

    if (!categoryMatch) return false

    return (
      normalizeCategoryName(itemName).includes(normalizedQueryForLocal) ||
      normalizeCategoryName(groupName).includes(normalizedQueryForLocal) ||
      normalizeCategoryName(className).includes(normalizedQueryForLocal)
    )
  })

  const mergedDataMap = new Map<
    string,
    { class: string | null; group: string | null; item_name: string | null; created_at?: string | null }
  >()

  for (const item of filteredData) {
    const key = `${normalizeCategoryName((item.class as string) || '')}|${normalizeCategoryName((item.group as string) || '')}|${normalizeCategoryName((item.item_name as string) || '')}`
    mergedDataMap.set(key, item as { class: string | null; group: string | null; item_name: string | null })
  }
  for (const item of localMatches) {
    const key = `${normalizeCategoryName(item.class)}|${normalizeCategoryName(item.group)}|${normalizeCategoryName(item.item_name)}`
    if (!mergedDataMap.has(key)) {
      mergedDataMap.set(key, {
        class: item.class,
        group: item.group,
        item_name: item.item_name,
      })
    }
  }

  const mergedData = Array.from(mergedDataMap.values())
  const queryLower = trimmedQuery.toLowerCase()

  const sortedData = mergedData
    .map((item) => {
      const itemNameLower = (item.item_name || '').toLowerCase()
      const groupLower = (item.group || '').toLowerCase()
      const classLower = (item.class || '').toLowerCase()
      let priority = 100

      if (itemNameLower === queryLower) priority = 1
      else if (itemNameLower.startsWith(queryLower + ' ')) priority = 2
      else if (itemNameLower.startsWith(queryLower)) priority = 3
      else if (itemNameLower.includes(' ' + queryLower + ' ')) priority = 4
      else if (itemNameLower.includes(' ' + queryLower)) priority = 5
      else if (itemNameLower.endsWith(' ' + queryLower)) priority = 6
      else if (itemNameLower.endsWith(queryLower)) priority = 7
      else if (itemNameLower.includes(queryLower)) priority = 8
      else if (groupLower === queryLower) priority = 9
      else if (groupLower.startsWith(queryLower)) priority = 10
      else if (groupLower.includes(queryLower)) priority = 11
      else if (classLower === queryLower) priority = 12
      else if (classLower.includes(queryLower)) priority = 13

      return { ...item, priority }
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      const aLength = (a.item_name || '').length
      const bLength = (b.item_name || '').length
      if (aLength !== bLength) return aLength - bLength
      return (a.item_name || '').localeCompare(b.item_name || '', 'tr')
    })
    .slice(0, 15)

  return sortedData.map((item) => ({
    class: item.class || '',
    group: item.group || '',
    item_name: item.item_name || '',
    display_text: `${item.item_name} - ${item.group} - ${item.class}`,
    score: item.priority,
  }))
}
