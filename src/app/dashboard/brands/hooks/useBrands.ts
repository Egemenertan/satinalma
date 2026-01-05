/**
 * useBrands Hook
 * React Query ile brands data fetching ve cache yönetimi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchBrands,
  fetchBrandsWithProductCount,
  fetchBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  type BrandFilters,
} from '@/services/brands.service'
import type { Database } from '@/types/database.types'

type BrandInsert = Database['public']['Tables']['brands']['Insert']
type BrandUpdate = Database['public']['Tables']['brands']['Update']

/**
 * Brands listesi için hook
 */
export function useBrands(filters?: BrandFilters, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['brands', filters, page, pageSize],
    queryFn: () => fetchBrands(filters, page, pageSize),
    staleTime: 30000,
  })
}

/**
 * Ürün sayısı ile birlikte brands listesi
 */
export function useBrandsWithProductCount(filters?: BrandFilters) {
  return useQuery({
    queryKey: ['brands-with-count', filters],
    queryFn: () => fetchBrandsWithProductCount(filters),
    staleTime: 30000,
  })
}

/**
 * Tek bir marka için hook
 */
export function useBrand(id: string | null) {
  return useQuery({
    queryKey: ['brand', id],
    queryFn: () => (id ? fetchBrandById(id) : null),
    enabled: !!id,
    staleTime: 30000,
  })
}

/**
 * Marka oluşturma mutation
 */
export function useCreateBrand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (brand: BrandInsert) => createBrand(brand),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      queryClient.invalidateQueries({ queryKey: ['brands-with-count'] })
    },
  })
}

/**
 * Marka güncelleme mutation
 */
export function useUpdateBrand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: BrandUpdate }) =>
      updateBrand(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      queryClient.invalidateQueries({ queryKey: ['brands-with-count'] })
      queryClient.invalidateQueries({ queryKey: ['brand', variables.id] })
    },
  })
}

/**
 * Marka silme mutation
 */
export function useDeleteBrand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, hardDelete = false }: { id: string; hardDelete?: boolean }) =>
      deleteBrand(id, hardDelete),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      queryClient.invalidateQueries({ queryKey: ['brands-with-count'] })
    },
  })
}





