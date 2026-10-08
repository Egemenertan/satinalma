/**
 * useOrders Hook
 * React Query ile sipariş verilerini yönetir
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchOrders } from '@/services'
import type { OrderFilters } from '../types'

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(filters),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
