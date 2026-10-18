/**
 * useProductFilters Hook
 * Filtreleme logic (search, brand, category, price range)
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ProductFilters, StatusFilter } from '@/services/products.service'

export function useProductFilters() {
  const [searchTerm, setSearchTermState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [brandId, setBrandId] = useState<string>('')
  const [siteId, setSiteId] = useState<string>('')
  const [productType, setProductType] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [zimmetOwner, setZimmetOwnerState] = useState('')
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined)
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Filters objesi
  const filters = useMemo<ProductFilters>(() => {
    const f: ProductFilters = {}
    
    if (debouncedSearch) f.search = debouncedSearch
    if (brandId) f.brandId = brandId
    if (siteId) f.siteId = siteId
    if (productType) f.productType = productType
    
    // Status filter logic
    f.statusFilter = statusFilter
    if (statusFilter === 'active') {
      f.isActive = true
    } else if (statusFilter === 'inactive') {
      f.isActive = false
    } else if (statusFilter === 'all') {
      f.isActive = undefined
    }
    // 'available' durumunda isActive undefined kalır, service'de özel işlem yapılır
    
    if (minPrice !== undefined) f.minPrice = minPrice
    if (maxPrice !== undefined) f.maxPrice = maxPrice
    if (zimmetOwner.trim()) f.zimmetOwner = zimmetOwner.trim()
    
    return f
  }, [debouncedSearch, brandId, siteId, productType, statusFilter, minPrice, maxPrice, zimmetOwner])

  const setZimmetOwner = useCallback((value: string) => {
    setZimmetOwnerState(value)
    setCurrentPage(1)
  }, [])

  const setSearchTerm = useCallback((value: string) => {
    setSearchTermState(value)
    setCurrentPage(1)
    if (!value.trim()) setDebouncedSearch('')
  }, [])

  useEffect(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return
    const timer = window.setTimeout(() => setDebouncedSearch(trimmed), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setBrandId('')
    setSiteId('')
    setProductType('')
    setStatusFilter('active')
    setZimmetOwner('')
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
    return !!(searchTerm || zimmetOwner || brandId || siteId || productType || statusFilter !== 'active' || minPrice !== undefined || maxPrice !== undefined)
  }, [searchTerm, zimmetOwner, brandId, siteId, productType, statusFilter, minPrice, maxPrice])

  return {
    // State
    searchTerm,
    zimmetOwner,
    brandId,
    siteId,
    productType,
    statusFilter,
    minPrice,
    maxPrice,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,
    
    // Setters
    setSearchTerm,
    setZimmetOwner,
    setBrandId,
    setSiteId,
    setProductType,
    setStatusFilter,
    setMinPrice,
    setMaxPrice,
    setCurrentPage,
    setPageSize,
    
    // Actions
    clearFilters,
    clearPriceFilters,
  }
}








