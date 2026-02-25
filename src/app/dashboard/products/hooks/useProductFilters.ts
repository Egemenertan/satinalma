/**
 * useProductFilters Hook
 * Filtreleme logic (search, brand, category, price range)
 */

import { useState, useCallback, useMemo } from 'react'
import type { ProductFilters } from '@/services/products.service'

export function useProductFilters() {
  const [searchTerm, setSearchTerm] = useState('')
  const [brandId, setBrandId] = useState<string>('')
  const [siteId, setSiteId] = useState<string>('')
  const [isActive, setIsActive] = useState<boolean | undefined>(true)
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined)
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Filters objesi
  const filters = useMemo<ProductFilters>(() => {
    const f: ProductFilters = {}
    
    if (searchTerm) f.search = searchTerm
    if (brandId) f.brandId = brandId
    if (siteId) f.siteId = siteId
    if (isActive !== undefined) f.isActive = isActive
    if (minPrice !== undefined) f.minPrice = minPrice
    if (maxPrice !== undefined) f.maxPrice = maxPrice
    
    return f
  }, [searchTerm, brandId, siteId, isActive, minPrice, maxPrice])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setBrandId('')
    setSiteId('')
    setIsActive(true)
    setMinPrice(undefined)
    setMaxPrice(undefined)
    setCurrentPage(1)
  }, [])

  // Clear price filters
  const clearPriceFilters = useCallback(() => {
    setMinPrice(undefined)
    setMaxPrice(undefined)
  }, [])

  // Has active filters
  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || brandId || siteId || isActive !== true || minPrice !== undefined || maxPrice !== undefined)
  }, [searchTerm, brandId, siteId, isActive, minPrice, maxPrice])

  return {
    // State
    searchTerm,
    brandId,
    siteId,
    isActive,
    minPrice,
    maxPrice,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,
    
    // Setters
    setSearchTerm,
    setBrandId,
    setSiteId,
    setIsActive,
    setMinPrice,
    setMaxPrice,
    setCurrentPage,
    setPageSize,
    
    // Actions
    clearFilters,
    clearPriceFilters,
  }
}








