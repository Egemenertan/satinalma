export type SiteImageFields = {
  name: string
  image_url?: string | null
}

export const normalizeSiteDisplayKey = (name: string | null | undefined): string =>
  String(name ?? '').trim().toLocaleLowerCase('tr-TR')

/** Tire/nokta vb. ayıraçları boşluğa çevirir (D-Point, D.Point …) */
export const normalizeSiteNameLoose = (name: string | null | undefined): string =>
  String(name ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[._]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')

/** DB’de kırık URL olsa bile D Point için bucket görseli kullanılır */
export function isDPointSiteLabel(name: string): boolean {
  const n = normalizeSiteNameLoose(name)
  if (n === 'd point' || n === 'dpoint') return true
  const parts = n.split(' ').filter(Boolean)
  if (parts.length >= 2 && parts[0] === 'd' && parts[1] === 'point') return true
  return false
}

/**
 * Tüm sites kataloğuna göre eksik görseli tamamlar.
 * Profil farklı UUID'ye bağlı eski/boş görsel satırını işaret ettiğinde, aynı isimli
 * başka bir sites kaydındaki image_url kullanılır.
 * D Point: DB'de dolu ama yüklenmeyen URL olabiliyor; bu adımda her zaman bucket görseli kullanılır.
 */
export function enrichSiteImagesFromCatalog<T extends SiteImageFields>(
  picked: T[],
  catalog: SiteImageFields[],
  dPointHeroPublicUrl: string
): T[] {
  const imageByName = new Map<string, string>()
  for (const row of catalog) {
    const url = row.image_url?.trim()
    if (!url) continue
    const key = normalizeSiteDisplayKey(row.name)
    if (!imageByName.has(key)) imageByName.set(key, url)
  }

  return picked.map((site) => {
    if (isDPointSiteLabel(site.name)) {
      return { ...site, image_url: dPointHeroPublicUrl }
    }
    const own = site.image_url?.trim()
    if (own) return site
    const fb = imageByName.get(normalizeSiteDisplayKey(site.name))
    if (fb) return { ...site, image_url: fb }
    return site
  })
}

export function getDPointHeroPublicUrl(storage: {
  from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } }
}): string {
  return storage.from('satinalma').getPublicUrl('dpointhero.webp').data.publicUrl
}
