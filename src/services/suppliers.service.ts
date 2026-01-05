/**
 * Suppliers Service
 * Tedarikçi yönetimi için service
 */

import { createClient } from '@/lib/supabase/client'

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  tax_number: string | null
  code: string | null
  payment_terms: number | null
  is_approved: boolean | null
  rating: number | null
  total_orders: number | null
  last_order_date: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Tüm tedarikçileri getir
 */
export async function fetchSuppliers() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Suppliers fetch error:', error)
    throw error
  }

  return data as Supplier[]
}

/**
 * Aktif tedarikçileri getir
 */
export async function fetchActiveSuppliers() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('is_approved', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Active suppliers fetch error:', error)
    throw error
  }

  return data as Supplier[]
}

/**
 * Tek bir tedarikçi getir
 */
export async function fetchSupplierById(id: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Supplier fetch by ID error:', error)
    throw error
  }

  return data as Supplier
}




