/**
 * Product Categories Service
 * Ürün kategorileri yönetimi için service
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type ProductCategory = Database['public']['Tables']['product_categories']['Row']
type ProductCategoryInsert = Database['public']['Tables']['product_categories']['Insert']
type ProductCategoryUpdate = Database['public']['Tables']['product_categories']['Update']

/**
 * Tüm kategorileri getir
 */
export async function fetchCategories() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Categories fetch error:', error)
    throw error
  }

  return data as ProductCategory[]
}

/**
 * Tek bir kategori getir
 */
export async function fetchCategoryById(id: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Category fetch by ID error:', error)
    throw error
  }

  return data as ProductCategory
}

/**
 * Yeni kategori oluştur
 */
export async function createCategory(category: ProductCategoryInsert) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('product_categories')
    .insert(category)
    .select()
    .single()

  if (error) {
    console.error('Category create error:', error)
    throw error
  }

  return data as ProductCategory
}

/**
 * Kategori güncelle
 */
export async function updateCategory(id: string, updates: ProductCategoryUpdate) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('product_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Category update error:', error)
    throw error
  }

  return data as ProductCategory
}

/**
 * Kategori sil
 */
export async function deleteCategory(id: string) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('pro_categories')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Category delete error:', error)
    throw error
  }
}

