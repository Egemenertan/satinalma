'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Search, Loader2, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SearchResult {
  class: string
  group: string
  item_name: string
  display_text: string
  score?: number
  highlightCount?: number
}

interface LocalMaterialCandidate {
  class: string
  group: string
  item_name: string
}

interface MaterialSearchBarProps {
  value: string
  onChange: (value: string) => void
  onResultClick?: (result: SearchResult) => void
  onCreateNewClick?: () => void
  onEnterSearch?: (results: SearchResult[]) => void
  placeholder?: string
  className?: string
  restrictToStationery?: boolean  // Genel Merkez Ofisi için ofis malzemeleri filtresi
  allowedCategoryNames?: string[]
  localCreatedMaterials?: LocalMaterialCandidate[]
}

export function MaterialSearchBar({
  value,
  onChange,
  onResultClick,
  onCreateNewClick,
  onEnterSearch,
  placeholder = 'Malzeme, ürün ara',
  className = '',
  restrictToStationery = false,
  allowedCategoryNames = [],
  localCreatedMaterials = []
}: MaterialSearchBarProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const supabase = createClient()

  const normalizeCategoryName = (text: string): string =>
    text
      .toLocaleLowerCase('tr-TR')
      .trim()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')

  // Türkçe karakter normalizasyonu
  const normalizeTurkish = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
  }

  // Arama fonksiyonu
  const performSearch = async (query: string) => {
    // Boşlukları temizle ama minimum uzunluk kontrolü yap
    const trimmedQuery = query.trim()
    
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    setShowResults(true)

    try {
      // Requests/create sayfasında görünen kategori seti ile arama filtresi birebir aynı olmalı.
      // allowedCategoryNames varsa bunu kullan; yoksa mevcut davranışı koru.
      const categoryNames = allowedCategoryNames
      
      // Malzeme araması - sadece ilgili kategorilerde
      // Tam eşleşmeleri önceliklendirmek için daha fazla sonuç al
      
      // Türkçe karakter varyasyonları için alternatif aramalar
      const queryVariants = [trimmedQuery]
      
      // "ı" <-> "i" dönüşümü
      if (trimmedQuery.includes('ı')) {
        queryVariants.push(trimmedQuery.replace(/ı/g, 'i'))
      }
      if (trimmedQuery.includes('i')) {
        queryVariants.push(trimmedQuery.replace(/i/g, 'ı'))
      }
      
      // Boşluk normalizasyonu: "pn40" -> "pn 40" ve "pn 40" -> "pn40"
      const spaceNormalizedVariants: string[] = []
      queryVariants.forEach(q => {
        // Rakam ve harf arasına boşluk ekle: "pn40" -> "pn 40"
        const withSpace = q.replace(/([a-zA-ZğüşıöçĞÜŞİÖÇ])(\d)/g, '$1 $2')
        if (withSpace !== q) spaceNormalizedVariants.push(withSpace)
        
        // Boşlukları kaldır: "pn 40" -> "pn40"
        const withoutSpace = q.replace(/\s+/g, '')
        if (withoutSpace !== q) spaceNormalizedVariants.push(withoutSpace)
      })
      
      // Tüm varyantları birleştir
      const allVariants = [...queryVariants, ...spaceNormalizedVariants]
      
      // Tüm varyantlar için OR sorgusu oluştur
      const searchConditions = allVariants.flatMap(q => [
        `item_name.ilike.%${q}%`,
        `group.ilike.%${q}%`,
        `class.ilike.%${q}%`
      ]).join(',')
      
      let searchQuery = supabase
        .from('all_materials')
        .select('class, group, item_name, created_at')
        .or(searchConditions)

      if (categoryNames.length === 0 && restrictToStationery) {
        // Geriye dönük fallback (ofis kullanıcıları)
        searchQuery = searchQuery.in('class', [
          'Kırtasiye Malzemeleri',
          'Reklam Ürünleri',
          'Ofis Ekipmanları',
          'Promosyon Ürünleri',
          'Mutfak Malzemeleri',
          'Hijyen ve Temizlik'
        ])
      } else if (categoryNames.length === 0 && !restrictToStationery) {
        // Geriye dönük fallback (şantiye kullanıcıları)
        searchQuery = searchQuery.not('class', 'in', '("Kırtasiye Malzemeleri","Reklam Ürünleri","Ofis Ekipmanları","Promosyon Ürünleri","Mutfak Malzemeleri","Hijyen ve Temizlik")')
      }
      
      const { data, error } = await searchQuery
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(1000) // Yeni eklenen kayıtların düşmemesi için geniş havuz

      if (!error && data) {
        const filteredData = categoryNames.length > 0
          ? (() => {
              const allowedCategorySet = new Set(
                categoryNames.map((name) => normalizeCategoryName(name))
              )
              return data.filter((item) =>
                allowedCategorySet.has(normalizeCategoryName(item.class || ''))
              )
            })()
          : data

        const localMatches = localCreatedMaterials.filter((item) => {
          const itemName = item.item_name || ''
          const groupName = item.group || ''
          const className = item.class || ''
          const normalizedQuery = normalizeCategoryName(trimmedQuery)

          const categoryMatch =
            categoryNames.length === 0 ||
            categoryNames
              .map((name) => normalizeCategoryName(name))
              .includes(normalizeCategoryName(className))

          if (!categoryMatch) return false

          return (
            normalizeCategoryName(itemName).includes(normalizedQuery) ||
            normalizeCategoryName(groupName).includes(normalizedQuery) ||
            normalizeCategoryName(className).includes(normalizedQuery)
          )
        })

        const mergedDataMap = new Map<string, { class: string | null; group: string | null; item_name: string | null; created_at?: string | null }>()
        filteredData.forEach((item) => {
          const key = `${normalizeCategoryName(item.class || '')}|${normalizeCategoryName(item.group || '')}|${normalizeCategoryName(item.item_name || '')}`
          mergedDataMap.set(key, item)
        })
        localMatches.forEach((item) => {
          const key = `${normalizeCategoryName(item.class || '')}|${normalizeCategoryName(item.group || '')}|${normalizeCategoryName(item.item_name || '')}`
          if (!mergedDataMap.has(key)) {
            mergedDataMap.set(key, item)
          }
        })

        const mergedData = Array.from(mergedDataMap.values())
        const queryLower = trimmedQuery.toLowerCase()
        
        // Sonuçları öncelik sırasına göre sırala
        const sortedData = mergedData
          .map(item => {
            const itemNameLower = (item.item_name || '').toLowerCase()
            const groupLower = (item.group || '').toLowerCase()
            const classLower = (item.class || '').toLowerCase()
            
            // Öncelik hesaplama (küçük sayı = yüksek öncelik)
            let priority = 100
            
            // 1. Tam eşleşme (en yüksek öncelik) - SADECE item_name
            if (itemNameLower === queryLower) priority = 1
            // 2. Başlangıçta eşleşme - item_name
            else if (itemNameLower.startsWith(queryLower + ' ')) priority = 2
            else if (itemNameLower.startsWith(queryLower)) priority = 3
            // 3. Kelime başında eşleşme - item_name
            else if (itemNameLower.includes(' ' + queryLower + ' ')) priority = 4
            else if (itemNameLower.includes(' ' + queryLower)) priority = 5
            // 4. Sonunda eşleşme - item_name
            else if (itemNameLower.endsWith(' ' + queryLower)) priority = 6
            else if (itemNameLower.endsWith(queryLower)) priority = 7
            // 5. Herhangi bir yerde eşleşme - item_name
            else if (itemNameLower.includes(queryLower)) priority = 8
            // 6. Group eşleşmeleri (daha düşük öncelik)
            else if (groupLower === queryLower) priority = 9
            else if (groupLower.startsWith(queryLower)) priority = 10
            else if (groupLower.includes(queryLower)) priority = 11
            // 7. Class eşleşmeleri (en düşük öncelik)
            else if (classLower === queryLower) priority = 12
            else if (classLower.includes(queryLower)) priority = 13
            
            return { ...item, priority }
          })
          .sort((a, b) => {
            // Önce priority'ye göre sırala
            if (a.priority !== b.priority) return a.priority - b.priority
            // Aynı öncelikte ise, daha kısa olanı önce göster (daha spesifik)
            const aLength = (a.item_name || '').length
            const bLength = (b.item_name || '').length
            if (aLength !== bLength) return aLength - bLength
            // Sonra item_name'e göre alfabetik sırala
            return (a.item_name || '').localeCompare(b.item_name || '', 'tr')
          })
          .slice(0, 15) // İlk 15 sonucu al (daha fazla çeşitlilik)
        
        const results = sortedData.map(item => ({
          class: item.class || '',
          group: item.group || '',
          item_name: item.item_name || '',
          display_text: `${item.item_name} - ${item.group} - ${item.class}`,
          score: item.priority
        }))
        setSearchResults(results)
      }
    } catch (error) {
      console.error('Arama hatası:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search
  const handleSearchChange = (newValue: string) => {
    onChange(newValue)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(newValue)
    }, 300)
  }

  // Enter tuşu handler'ı
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault()
      // Modal'ı kapat
      setShowResults(false)
      // Enter callback'i çağır
      if (onEnterSearch) {
        onEnterSearch(searchResults)
      }
    }
  }

  // Dış tıklamada sonuçları kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.material-search-container')) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Text highlighting
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return { html: text, matchCount: 0 }
    
    const queryWords = query.trim().toLowerCase().split(/\s+/)
    let highlightedText = text
    let totalMatches = 0
    
    queryWords.forEach(word => {
      if (word.length >= 2) {
        // Türkçe karakter toleransı için hem "ı" hem "i" versiyonlarını ara
        const wordVariants = [word]
        if (word.includes('ı')) {
          wordVariants.push(word.replace(/ı/g, 'i'))
        }
        if (word.includes('i')) {
          wordVariants.push(word.replace(/i/g, 'ı'))
        }
        
        wordVariants.forEach(variant => {
          const regex = new RegExp(`(${variant})`, 'gi')
          const matches = text.match(regex)
          if (matches) {
            totalMatches += matches.length
            highlightedText = highlightedText.replace(
              regex, 
              '<span class="text-green-600 font-semibold">$1</span>'
            )
          }
        })
      }
    })
    
    return { html: highlightedText, matchCount: totalMatches }
  }

  return (
    <div className={`w-full material-search-container ${className}`}>
      <div className="relative">
        {/* Input */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <Input
            value={value}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full h-12 lg:h-14 pl-12 pr-4 rounded-2xl border border-gray-200 bg-white
              focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 
              text-sm lg:text-base placeholder:text-gray-400
              transition-all duration-200"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-80 overflow-hidden z-[9999]">
            <div className="max-h-64 overflow-y-auto">
              {searchResults.map((result, index) => {
                const itemNameHighlight = highlightText(result.item_name, value)
                const groupHighlight = highlightText(result.group, value)
                const classHighlight = highlightText(result.class, value)

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      if (onResultClick) {
                        onResultClick(result)
                      }
                      setShowResults(false)
                    }}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-all duration-200"
                  >
                    <div className="font-medium text-gray-900 text-sm mb-1"
                      dangerouslySetInnerHTML={{ __html: itemNameHighlight.html }}
                    />
                    <div className="text-xs text-gray-500">
                      <span dangerouslySetInnerHTML={{ __html: groupHighlight.html }} />
                      {' → '}
                      <span dangerouslySetInnerHTML={{ __html: classHighlight.html }} />
                    </div>
                  </button>
                )
              })}
            </div>
            
            {/* Create New Button */}
            {onCreateNewClick && (
              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onCreateNewClick()
                    setShowResults(false)
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Package className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-xs text-gray-900 leading-tight">Aradığınızı bulamadınız mı?</div>
                      <div className="text-xs text-gray-500 leading-tight mt-0.5">Yeni malzeme ekleyin</div>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {showResults && searchResults.length === 0 && !isSearching && value.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999]">
            <div className="text-center py-8 px-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center">
                <Search className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Sonuç bulunamadı</p>
              <p className="text-xs text-gray-400">"{value}"</p>
            </div>
            
            {/* Create New Button */}
            {onCreateNewClick && (
              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onCreateNewClick()
                    setShowResults(false)
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Package className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-xs text-gray-900 leading-tight">Yeni malzeme ekleyin</div>
                      <div className="text-xs text-gray-500 leading-tight mt-0.5 truncate">"{value}" için öğe oluşturun</div>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

