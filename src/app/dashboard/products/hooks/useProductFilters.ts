/**
 * useProductFilters Hook
 * Filtreleme logic (search, brand, category, price range)
 */

import { useState, useCallback, useMemo } from 'react'
import type { ProductFilters, StatusFilter } from '@/services/products.service'

export function useProductFilters() {
  const [searchTerm, setSearchTerm] = useState('')
  const [brandId, setBrandId] = useState<string>('')
  const [siteId, setSiteId] = useState<string>('')
  const [productType, setProductType] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
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
    
    return f
  }, [searchTerm, brandId, siteId, productType, statusFilter, minPrice, maxPrice])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setBrandId('')
    setSiteId('')
    setProductType('')
    setStatusFilter('active')
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
    return !!(searchTerm || brandId || siteId || productType || statusFilter !== 'active' || minPrice !== undefined || maxPrice !== undefined)
  }, [searchTerm, brandId, siteId, productType, statusFilter, minPrice, maxPrice])

  return {
    // State
    searchTerm,
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








