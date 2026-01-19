'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Search, Loader2, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Product {
  id: string
  name: string
  sku: string
  unit: string
  category_id: string
  brand_id?: string
  category?: {
    name: string
  }
  brand?: {
    name: string
  }
}

interface ProductSearchBarProps {
  value: string
  onChange: (value: string) => void
  onProductSelect?: (product: Product) => void
  categoryIds: string[]
  placeholder?: string
  className?: string
}

export function ProductSearchBar({
  value,
  onChange,
  onProductSelect,
  categoryIds,
  placeholder = 'Ürün ara...',
  className = ''
}: ProductSearchBarProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const supabase = createClient()

  // Arama fonksiyonu
  const performSearch = async (query: string) => {
    const trimmedQuery = query.trim()
    
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    setShowResults(true)

    try {
      // Products tablosundan ara - sadece belirtilen kategorilerde
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          unit,
          category_id,
          brand_id,
          category:product_categories(name),
          brand:brands(name)
        `)
        .in('category_id', categoryIds)
        .or(`name.ilike.%${trimmedQuery}%,sku.ilike.%${trimmedQuery}%`)
        .eq('is_active', true)
        .limit(15)
        .order('name')

      if (!error && data) {
        setSearchResults(data as any)
      } else {
        console.error('Ürün arama hatası:', error)
        setSearchResults([])
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
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault()
      if (onProductSelect) {
        onProductSelect(searchResults[0])
      }
      setShowResults(false)
    }
  }

  // Dış tıklamada sonuçları kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.product-search-container')) {
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
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query.trim()})`, 'gi')
    return text.replace(regex, '<span class="text-green-600 font-semibold">$1</span>')
  }

  return (
    <div className={`w-full product-search-container ${className}`}>
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
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    if (onProductSelect) {
                      onProductSelect(product)
                    }
                    setShowResults(false)
                    onChange('')
                  }}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div 
                        className="font-medium text-gray-900 text-sm mb-1"
                        dangerouslySetInnerHTML={{ __html: highlightText(product.name, value) }}
                      />
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {product.sku && (
                          <span 
                            className="font-mono"
                            dangerouslySetInnerHTML={{ __html: highlightText(product.sku, value) }}
                          />
                        )}
                        {product.category?.name && (
                          <>
                            <span>•</span>
                            <span>{product.category.name}</span>
                          </>
                        )}
                        {product.brand?.name && (
                          <>
                            <span>•</span>
                            <span>{product.brand.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                        {product.unit}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {showResults && searchResults.length === 0 && !isSearching && value.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999]">
            <div className="text-center py-8 px-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-50 flex items-center justify-center">
                <Search className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Ürün bulunamadı</p>
              <p className="text-xs text-gray-400">"{value}"</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
