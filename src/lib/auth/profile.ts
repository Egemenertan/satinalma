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
 * NOT: Site ataması boşsa otomatik atama YAPILMAZ - admin manuel atamalı.
 */
export async function ensureProfile(
  supabase: Supabase,
  userId: string,
  email: string | null | undefined,
  fullName: string | null | undefined
): Promise<UserRole> {
  const userEmail = email?.trim().toLowerCase() || ''
  const userName = fullName || userEmail || 'Kullanıcı'

  // Mevcut profili kontrol et. Okuma hatasında profil yokmuş gibi
  // davranma: aksi halde satın alma kullanıcısı bu sayfa yüklemesinde
  // site_personnel sayılır.
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('role, site_id')
    .eq('id', userId)
    .maybeSingle()

  if (readError) {
    throw readError
  }

  // Profil varsa
  if (profile) {
    const role = (profile.role as UserRole) || DEFAULT_ROLE
    
    // user rolünü site_personnel'e yükselt (site_id'ye dokunma)
    if (role === 'user') {
      await supabase
        .from('profiles')
        .update({ role: DEFAULT_ROLE })
        .eq('id', userId)
      return DEFAULT_ROLE
    }
    
    return role
  }

  // Yeni profil oluştur (site_id boş bırak - admin atamalı)
  const { error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: userEmail,
      full_name: userName,
      role: DEFAULT_ROLE,
      site_id: null,
      created_at: new Date().toISOString(),
    })

  if (!insertError) {
    return DEFAULT_ROLE
  }

  // Eşzamanlı istek profili bizden önce oluşturmuş olabilir.
  const { data: existing, error: rereadError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (rereadError) throw rereadError
  if (existing?.role) return existing.role as UserRole
  throw insertError
}
