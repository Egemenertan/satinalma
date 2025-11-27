/**
 * useOrders Hook
 * React Query ile sipariş verilerini yönetir
 */

import { useQuery } from '@tanstack/react-query'
import { fetchOrders } from '@/services'
import type { OrderFilters } from '../types'

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(filters),
    staleTime: 30000, // 30 saniye
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  })
}















