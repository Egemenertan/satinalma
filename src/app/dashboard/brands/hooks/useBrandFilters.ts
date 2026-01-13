/**
 * useBrandFilters Hook
 * Marka filtreleme logic
 */

import { useState, useCallback, useMemo } from 'react'
import type { BrandFilters } from '@/services/brands.service'

export function useBrandFilters() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isActive, setIsActive] = useState<boolean | undefined>(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Filters objesi
  const filters = useMemo<BrandFilters>(() => {
    const f: BrandFilters = {}

    if (searchTerm) f.search = searchTerm
    if (isActive !== undefined) f.isActive = isActive

    return f
  }, [searchTerm, isActive])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setIsActive(true)
    setCurrentPage(1)
  }, [])

  // Has active filters
  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || isActive !== true)
  }, [searchTerm, isActive])

  return {
    // State
    searchTerm,
    isActive,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,

    // Setters
    setSearchTerm,
    setIsActive,
    setCurrentPage,
    setPageSize,

    // Actions
    clearFilters,
  }
}








