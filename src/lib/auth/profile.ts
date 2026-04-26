/**
 * Profil Yönetimi
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'
import { DEFAULT_ROLE } from './domain'

type Supabase = SupabaseClient<any, any, any>
const DEFAULT_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7' as const

/**
 * Kullanıcı profili oluştur veya güncelle.
 * Yeni kullanıcılar site_personnel olur.
 * Mevcut user rolündekiler site_personnel'e yükseltilir.
 */
export async function ensureProfile(
  supabase: Supabase,
  userId: string,
  email: string | null | undefined,
  fullName: string | null | undefined
): Promise<UserRole> {
  const userEmail = email?.trim().toLowerCase() || ''
  const userName = fullName || userEmail || 'Kullanıcı'

  // Mevcut profili kontrol et
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id')
    .eq('id', userId)
    .maybeSingle()

  // Profil varsa
  if (profile) {
    const role = (profile.role as UserRole) || DEFAULT_ROLE
    const hasSiteIds = Array.isArray(profile.site_id) && profile.site_id.length > 0
    
    // user rolünü site_personnel'e yükselt
    if (role === 'user') {
      await supabase
        .from('profiles')
        .update({
          role: DEFAULT_ROLE,
          site_id: [DEFAULT_SITE_ID],
        })
        .eq('id', userId)
      return DEFAULT_ROLE
    }

    // site ataması boşsa varsayılan siteyi ata
    if (!hasSiteIds) {
      await supabase
        .from('profiles')
        .update({ site_id: [DEFAULT_SITE_ID] })
        .eq('id', userId)
    }
    
    return role
  }

  // Yeni profil oluştur
  await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: userEmail,
      full_name: userName,
      role: DEFAULT_ROLE,
      site_id: [DEFAULT_SITE_ID],
      created_at: new Date().toISOString(),
    })

  return DEFAULT_ROLE
}
