/**
 * useOrderFilters Hook
 * Sipariş filtre state yönetimi
 */

import { useState, useEffect } from 'react'
import type { OrderFilters } from '../types'

export function useOrderFilters() {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [siteFilter, setSiteFilter] = useState<string[]>([]) // Şantiye filtresi
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 24

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Tarih filtrelerini temizle
  const clearDateFilters = () => {
    setDateRange({ from: undefined, to: undefined })
  }

  const filters: OrderFilters = {
    page: currentPage,
    pageSize: itemsPerPage,
    searchTerm: debouncedSearchTerm,
    statusFilter,
    siteFilter,
    dateRange,
  }

  return {
    filters,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    siteFilter,
    setSiteFilter,
    dateRange,
    setDateRange,
    clearDateFilters,
    currentPage,
    setCurrentPage,
    itemsPerPage,
  }
}



