/**
 * useCategories Hook
 * Ürün kategorilerini yönetmek için custom hook
 */

import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '@/services/categories.service'

export function useCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000, // 5 dakika
  })
}




