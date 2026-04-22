/**
 * Profil Yönetimi
 * 
 * Microsoft OAuth ile giriş yapan kullanıcılar için profil oluşturma ve yönetimi.
 * Single Tenant olduğu için tüm kullanıcılar otomatik olarak site_personnel rolü alır.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types'
import { DEFAULT_MICROSOFT_USER_ROLE, getInitialSiteIds } from './domain'

type Supabase = SupabaseClient<any, any, any>

export interface ProfileEnsureResult {
  role: UserRole
  isNewProfile: boolean
  wasMerged: boolean
}

/**
 * Kullanıcı için profil olduğundan emin olur.
 * 
 * Microsoft OAuth Single Tenant olduğu için:
 * - Yeni kullanıcılar otomatik site_personnel olur
 * - Mevcut "user" rolündeki kullanıcılar site_personnel'e yükseltilir
 * - Diğer roller korunur
 */
export async function ensureUserProfile(
  supabase: Supabase,
  user: { id: string; email?: string | null; user_metadata?: Record<string, any> | null }
): Promise<ProfileEnsureResult> {
  const email = (user.email ?? '').trim().toLowerCase()
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    email ||
    'Yeni Kullanıcı'

  // 1. Mevcut profili kontrol et
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, role, email, site_id')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Profil sorgulanamadı: ${fetchError.message}`)
  }

  // 2. Profil zaten varsa
  if (existingProfile) {
    let role = (existingProfile.role as UserRole) || 'user'

    // "user" rolündeki kullanıcıları otomatik site_personnel'e yükselt
    if (role === 'user') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: DEFAULT_MICROSOFT_USER_ROLE })
        .eq('id', user.id)

      if (updateError) {
        console.warn('⚠️ Rol otomatik güncellenemedi:', updateError.message)
      } else {
        role = DEFAULT_MICROSOFT_USER_ROLE
        console.log('✅ Rol otomatik yükseltildi: user → site_personnel')
      }
    }

    return { role, isNewProfile: false, wasMerged: false }
  }

  // 3. Aynı email ile başka bir profil var mı? (Hesap birleştirme)
  if (email) {
    const { data: orphanProfile } = await supabase
      .from('profiles')
      .select('id, role, email, full_name, site_id, department, phone, created_at')
      .eq('email', email)
      .maybeSingle()

    if (orphanProfile) {
      // Mevcut rolü koru, ama "user" ise yükselt
      let preservedRole = (orphanProfile.role as UserRole) || DEFAULT_MICROSOFT_USER_ROLE
      if (preservedRole === 'user') {
        preservedRole = DEFAULT_MICROSOFT_USER_ROLE
      }
      
      const siteIds = orphanProfile.site_id ?? null

      // Yeni profili oluştur (mevcut bilgileri koru)
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: orphanProfile.email,
          full_name: orphanProfile.full_name,
          role: preservedRole,
          department: orphanProfile.department,
          site_id: siteIds,
          phone: orphanProfile.phone,
          created_at: orphanProfile.created_at,
        })

      if (insertError) {
        throw new Error(`Profil birleştirilemedi: ${insertError.message}`)
      }

      // Eski profili sil
      await supabase.from('profiles').delete().eq('id', orphanProfile.id)

      console.log('🔗 Hesap birleştirildi, rol:', preservedRole)
      return { role: preservedRole, isNewProfile: false, wasMerged: true }
    }
  }

  // 4. Yepyeni profil oluştur - otomatik site_personnel
  const { error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email,
      full_name: fullName,
      role: DEFAULT_MICROSOFT_USER_ROLE,
      site_id: getInitialSiteIds(),
      created_at: new Date().toISOString(),
    })

  if (insertError) {
    throw new Error(`Profil oluşturulamadı: ${insertError.message}`)
  }

  console.log('✅ Yeni profil oluşturuldu, rol:', DEFAULT_MICROSOFT_USER_ROLE)
  return { role: DEFAULT_MICROSOFT_USER_ROLE, isNewProfile: true, wasMerged: false }
}

/**
 * Kullanıcının mevcut profilini getirir.
 */
export async function getUserProfile(
  supabase: Supabase,
  userId: string
): Promise<{ role: UserRole; email: string | null } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  return {
    role: (data.role as UserRole) || DEFAULT_MICROSOFT_USER_ROLE,
    email: data.email,
  }
}
