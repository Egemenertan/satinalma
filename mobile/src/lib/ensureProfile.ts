import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_ROLE = 'site_personnel' as const

type EnsureProfileOptions = {
  companyName?: string | null
  isNewRegistration?: boolean
}

/**
 * Web `ensureProfile` ile aynı mantık — OAuth sonrası profil satırı garanti edilir.
 * NOT: Site ataması boşsa otomatik atama YAPILMAZ - admin manuel atamalı.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  fullName: string | null | undefined,
  options?: EnsureProfileOptions
): Promise<'deactivated' | string> {
  const userEmail = email?.trim().toLowerCase() || ''
  const userName = fullName || userEmail || 'Kullanıcı'
  const { companyName } = options ?? {}

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id, deleted_at, is_active, organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile) {
    if (profile.deleted_at || profile.is_active === false) {
      return 'deactivated'
    }
    const role = (profile.role as string) || DEFAULT_ROLE

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
  const profileData: Record<string, unknown> = {
    id: userId,
    email: userEmail,
    full_name: userName,
    role: DEFAULT_ROLE,
    created_at: new Date().toISOString(),
    site_id: null, // Site ataması admin tarafından yapılacak
  }

  // Kayıt formundan geldiyse company_name ekle
  if (companyName) {
    profileData.company_name = companyName
  }

  await supabase.from('profiles').insert(profileData)

  return DEFAULT_ROLE
}
