'use client'

import useSWR, { mutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'
import { DEFAULT_ROLE } from './domain'
import { ensureProfile } from './profile'
import { getSessionUser } from './session'

export const CURRENT_PROFILE_KEY = 'current_profile'

export type CurrentProfile = {
  userId: string
  email: string
  fullName: string
  role: UserRole
  siteId: string | string[] | null
  department: string | null
}

function displayNameFrom(profileName: string | null | undefined, email: string): string {
  if (profileName && profileName.trim()) return profileName
  if (!email) return 'Kullanıcı'
  const fromEmail = email.split('@')[0] || 'Kullanıcı'
  return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1)
}

export async function fetchCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = createClient()
  const user = await getSessionUser(supabase)
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, email, role, site_id, department')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error

  let role: UserRole = (profile?.role as UserRole) || DEFAULT_ROLE
  if (!profile || profile.role === 'user') {
    role = await ensureProfile(
      supabase,
      user.id,
      user.email,
      user.user_metadata?.full_name
    )
  }

  const email = profile?.email || user.email || ''

  return {
    userId: user.id,
    email,
    fullName: displayNameFrom(profile?.full_name, email),
    role,
    siteId: profile?.site_id ?? null,
    department: profile?.department ?? null,
  }
}

export function useCurrentProfile() {
  return useSWR(CURRENT_PROFILE_KEY, fetchCurrentProfile, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
    errorRetryCount: 2,
  })
}

export function clearCurrentProfileCache() {
  void mutate(CURRENT_PROFILE_KEY, undefined, { revalidate: false })
}
