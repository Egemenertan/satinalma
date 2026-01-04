/**
 * Brands Service
 * Marka yönetimi için temiz ve optimize edilmiş Supabase sorguları
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Brand = Database['public']['Tables']['brands']['Row']
type BrandInsert = Database['public']['Tables']['brands']['Insert']
type BrandUpdate = Database['public']['Tables']['brands']['Update']

export interface BrandFilters {
  search?: string
  isActive?: boolean
}

export interface BrandWithProductCount extends Brand {
  product_count: number
}

/**
 * Markaları listele (filtreleme ve pagination ile)
 */
export async function fetchBrands(
  filters?: BrandFilters,
  page = 1,
  pageSize = 20
) {
  const supabase = createClient()
  
  let query = supabase
    .from('brands')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })

  // Filtreleme
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Brands fetch error:', error)
    throw error
  }

  return {
    brands: data as Brand[],
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    currentPage: page,
  }
}

/**
 * Ürün sayısı ile birlikte markaları getir
 */
export async function fetchBrandsWithProductCount(
  filters?: BrandFilters
): Promise<BrandWithProductCount[]> {
  const supabase = createClient()

  let query = supabase
    .from('brands')
    .select(`
      *,
      products:products(count)
    `)
    .order('name', { ascending: true })

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  const { data, error } = await query

  if (error) {
    console.error('Brands with product count fetch error:', error)
    throw error
  }

  // Transform data to include product count
  const brandsWithCount = (data || []).map((brand: any) => ({
    ...brand,
    product_count: brand.products?.[0]?.count || 0,
    products: undefined, // Remove nested products object
  }))

  return brandsWithCount as BrandWithProductCount[]
}

/**
 * Tek bir markayı ID ile getir
 */
export async function fetchBrandById(id: string): Promise<Brand | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Brand fetch by ID error:', error)
    throw error
  }

  return data as Brand
}

/**
 * Yeni marka oluştur
 */
export async function createBrand(brand: BrandInsert): Promise<Brand> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('brands')
    .insert(brand)
    .select()
    .single()

  if (error) {
    console.error('Brand create error:', error)
    throw error
  }

  return data as Brand
}

/**
 * Marka güncelle
 */
export async function updateBrand(
  id: string,
  updates: BrandUpdate
): Promise<Brand> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('brands')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Brand update error:', error)
    throw error
  }

  return data as Brand
}

/**
 * Marka sil (soft delete - is_active = false)
 */
export async function deleteBrand(id: string, hardDelete = false): Promise<void> {
  const supabase = createClient()

  if (hardDelete) {
    // Hard delete - önce ürünlerin brand_id'sini null yap
    await supabase
      .from('products')
      .update({ brand_id: null })
      .eq('brand_id', id)

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Brand hard delete error:', error)
      throw error
    }
  } else {
    // Soft delete
    const { error } = await supabase
      .from('brands')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Brand soft delete error:', error)
      throw error
    }
  }
}

/**
 * Logo upload için Storage fonksiyonu
 */
export async function uploadBrandLogo(
  file: File,
  brandId: string
): Promise<string> {
  const supabase = createClient()

  const fileExt = file.name.split('.').pop()
  const fileName = `${brandId}-${Date.now()}.${fileExt}`
  const filePath = `brand-logos/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('satinalma')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Brand logo upload error:', uploadError)
    throw uploadError
  }

  const { data: { publicUrl } } = supabase.storage
    .from('satinalma')
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Logo sil
 */
export async function deleteBrandLogo(logoUrl: string): Promise<void> {
  const supabase = createClient()

  // URL'den path'i çıkar
  const path = logoUrl.split('/satinalma/')[1]
  if (!path) return

  const { error } = await supabase.storage
    .from('satinalma')
    .remove([path])

  if (error) {
    console.error('Brand logo delete error:', error)
    throw error
  }
}


