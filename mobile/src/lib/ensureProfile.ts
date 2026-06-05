import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_ROLE = 'site_personnel' as const
const DEFAULT_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7' as const

/**
 * Web `ensureProfile` ile aynı mantık — OAuth sonrası profil satırı garanti edilir.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  fullName: string | null | undefined
): Promise<'deactivated' | string> {
  const userEmail = email?.trim().toLowerCase() || ''
  const userName = fullName || userEmail || 'Kullanıcı'

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, site_id, deleted_at, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (profile) {
    if (profile.deleted_at || profile.is_active === false) {
      return 'deactivated'
    }
    const role = (profile.role as string) || DEFAULT_ROLE
    const hasSiteIds = Array.isArray(profile.site_id) && profile.site_id.length > 0

    if (role === 'user') {
      await supabase
        .from('profiles')
        .update({ role: DEFAULT_ROLE, site_id: [DEFAULT_SITE_ID] })
        .eq('id', userId)
      return DEFAULT_ROLE
    }

    if (!hasSiteIds) {
      await supabase.from('profiles').update({ site_id: [DEFAULT_SITE_ID] }).eq('id', userId)
    }

    return role
  }

  await supabase.from('profiles').insert({
    id: userId,
    email: userEmail,
    full_name: userName,
    role: DEFAULT_ROLE,
    site_id: [DEFAULT_SITE_ID],
    created_at: new Date().toISOString(),
  })

  return DEFAULT_ROLE
}
