/**
 * useProducts Hook
 * React Query ile products data fetching ve cache yönetimi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProducts,
  fetchProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchProductStats,
  fetchProductsInsightsBundle,
  type ProductFilters,
} from '@/services/products.service'
import type { Database } from '@/types/database.types'

type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

/**
 * Products listesi için hook
 */
export function useProducts(filters?: ProductFilters, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['products', filters, page, pageSize],
    queryFn: () => fetchProducts(filters, page, pageSize),
    staleTime: 30000, // 30 saniye
  })
}

/**
 * Tek bir ürün için hook
 */
export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => id ? fetchProductById(id) : null,
    enabled: !!id,
    staleTime: 30000,
  })
}

/**
 * Ürün istatistikleri için hook
 */
export function useProductStats(siteId?: string) {
  return useQuery({
    queryKey: ['product-stats', siteId],
    queryFn: () => fetchProductStats(siteId),
    staleTime: 60000, // 1 dakika
  })
}

/** Ürünler sayfası KPI + grafik özeti (depo filtresine göre) */
export function useProductsInsights(siteId?: string) {
  const sid = siteId && siteId.trim() !== '' ? siteId : undefined
  return useQuery({
    queryKey: ['products-insights-bundle', sid ?? 'all'],
    queryFn: () => fetchProductsInsightsBundle(sid),
    staleTime: 60000,
  })
}

/**
 * Ürün oluşturma mutation
 */
export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (product: ProductInsert) => createProduct(product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-stats'] })
      queryClient.invalidateQueries({ queryKey: ['products-insights-bundle'] })
    },
  })
}

/**
 * Ürün güncelleme mutation
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProductUpdate }) =>
      updateProduct(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['product-stats'] })
      queryClient.invalidateQueries({ queryKey: ['products-insights-bundle'] })
    },
  })
}

/**
 * Ürün silme mutation
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, hardDelete = false }: { id: string; hardDelete?: boolean }) =>
      deleteProduct(id, hardDelete),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product-stats'] })
      queryClient.invalidateQueries({ queryKey: ['products-insights-bundle'] })
    },
  })
}








