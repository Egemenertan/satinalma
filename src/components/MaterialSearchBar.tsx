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

interface MaterialSearchBarProps {
  value: string
  onChange: (value: string) => void
  onResultClick?: (result: SearchResult) => void
  onCreateNewClick?: () => void
  onEnterSearch?: (results: SearchResult[]) => void
  placeholder?: string
  className?: string
  restrictToStationery?: boolean  // Genel Merkez Ofisi için ofis malzemeleri filtresi
}

export function MaterialSearchBar({
  value,
  onChange,
  onResultClick,
  onCreateNewClick,
  onEnterSearch,
  placeholder = 'Malzeme, ürün ara',
  className = '',
  restrictToStationery = false
}: MaterialSearchBarProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const supabase = createClient()

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
    if (!query || query.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    setShowResults(true)

    try {
      let searchQuery = supabase
        .from('all_materials')
        .select('class, group, item_name')
        .or(`item_name.ilike.%${query}%,group.ilike.%${query}%,class.ilike.%${query}%`)
      
      // Genel Merkez Ofisi kullanıcıları için tüm ofis kategorileri
      if (restrictToStationery) {
        searchQuery = searchQuery.in('class', [
          'Kırtasiye Malzemeleri',
          'Reklam Ürünleri',
          'Ofis Ekipmanları',
          'Promosyon Ürünleri',
          'Mutfak Malzemeleri',
          'Hijyen ve Temizlik'
        ])
        console.log('🔍 Arama ofis kategorileri ile sınırlandırıldı')
      }
      
      const { data, error } = await searchQuery.limit(10)

      if (!error && data) {
        const results = data.map(item => ({
          class: item.class || '',
          group: item.group || '',
          item_name: item.item_name || '',
          display_text: `${item.item_name} - ${item.group} - ${item.class}`,
          score: 100
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
    
    const queryWords = query.toLowerCase().split(/\s+/)
    let highlightedText = text
    let totalMatches = 0
    
    queryWords.forEach(word => {
      if (word.length >= 2) {
        const regex = new RegExp(`(${word})`, 'gi')
        const matches = text.match(regex)
        if (matches) {
          totalMatches += matches.length
          highlightedText = highlightedText.replace(
            regex, 
            '<mark class="bg-gray-100 px-1 rounded font-medium">$1</mark>'
          )
        }
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

