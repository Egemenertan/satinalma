/**
 * Sites Service
 * Şantiye/Depo yönetimi için service
 */

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Site = Database['public']['Tables']['sites']['Row']

/**
 * Tüm şantiyeleri getir
 * Ana Depo her zaman en üstte olacak şekilde sıralanır
 */
export async function fetchSites() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Sites fetch error:', error)
    throw error
  }

  // Ana Depo'yu en üste taşı
  const sites = data as Site[]
  const anaDepoIndex = sites.findIndex(site => site.name === 'Ana Depo')
  
  if (anaDepoIndex > 0) {
    const anaDepo = sites.splice(anaDepoIndex, 1)[0]
    sites.unshift(anaDepo)
  }

  return sites
}

/**
 * Tek bir şantiye getir
 */
export async function fetchSiteById(id: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Site fetch by ID error:', error)
    throw error
  }

  return data as Site
}








