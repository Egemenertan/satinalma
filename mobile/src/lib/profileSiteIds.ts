/** Profil site alanlarını tek listede birleştirir (site_id + construction_site_id). */

export type ProfileSiteSource = {
  site_id?: string | string[] | null
  construction_site_id?: string | null
}

export function resolveProfileSiteIds(profile: ProfileSiteSource | null | undefined): string[] {
  if (!profile) return []
  if (profile.site_id && Array.isArray(profile.site_id) && profile.site_id.length) {
    return profile.site_id as string[]
  }
  if (profile.site_id && typeof profile.site_id === 'string' && profile.site_id.trim()) {
    return [profile.site_id]
  }
  if (profile.construction_site_id?.trim()) {
    return [profile.construction_site_id]
  }
  return []
}
