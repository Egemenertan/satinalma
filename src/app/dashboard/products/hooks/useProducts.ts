/**
 * useProducts Hook
 * React Query ile products data fetching ve cache yönetimi
 */

import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProducts,
  fetchProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchProductStats,
  fetchProductsInsightsBundle,
  fetchDepotStockSummary,
  fetchZimmetOwnerOptions,
  type ProductFilters,
} from '@/services/products.service'
import type { Database } from '@/types/database.types'

type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

/**
 * Products listesi için hook
 */
export function useProducts(
  filters?: ProductFilters,
  page = 1,
  pageSize = 20,
  enabled = true
) {
  return useQuery({
    queryKey: ['products', filters, page, pageSize],
    queryFn: () => fetchProducts(filters, page, pageSize),
    enabled,
    placeholderData: keepPreviousData,
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
export function useProductsInsights(siteId?: string, enabled = true) {
  const sid = siteId && siteId.trim() !== '' ? siteId : undefined
  return useQuery({
    queryKey: ['products-insights-bundle', sid ?? 'all'],
    queryFn: () => fetchProductsInsightsBundle(sid),
    enabled,
    staleTime: 60000,
  })
}

/** Depo kartlarındaki ürün sayısı ve adet */
export function useDepotStockSummary(warehouseIds: string[], enabled = true) {
  const key = [...warehouseIds].filter(Boolean).sort().join(',')
  return useQuery({
    // 'products' altında: stok/zimmet işlemleri listeyle birlikte bunu da tazeler
    queryKey: ['products', 'depot-stock-summary', key],
    queryFn: () => fetchDepotStockSummary(key ? key.split(',') : []),
    enabled: enabled && key !== '',
    staleTime: 60000,
  })
}

/** Zimmetli kişi filtresinin seçenekleri. Dialog her açıldığında yeniden yüklenmez. */
export function useZimmetOwnerOptions(warehouseIds?: string[]) {
  const key = (warehouseIds || []).filter(Boolean).sort().join(',')
  return useQuery({
    queryKey: ['products', 'zimmet-owner-options', key],
    queryFn: () => fetchZimmetOwnerOptions(key ? key.split(',') : undefined),
    staleTime: 5 * 60000,
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








