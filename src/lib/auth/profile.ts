/**
 * Profil Yönetimi
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'
import { DEFAULT_ROLE } from './domain'

type Supabase = SupabaseClient<any, any, any>

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
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  // Profil varsa
  if (profile) {
    const role = (profile.role as UserRole) || DEFAULT_ROLE
    
    // user rolünü site_personnel'e yükselt
    if (role === 'user') {
      await supabase
        .from('profiles')
        .update({ role: DEFAULT_ROLE })
        .eq('id', userId)
      return DEFAULT_ROLE
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
      created_at: new Date().toISOString(),
    })

  return DEFAULT_ROLE
}
