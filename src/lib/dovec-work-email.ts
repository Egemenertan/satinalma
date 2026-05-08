/**
 * Döveç çalışan e-postası: görünen ad soyaddan standart adres.
 * Ör. "Burçin Döveç" → burcin.dovec@dovecgroup.com
 *      "Egemen Yusuf Ertan" → egemen.ertan@dovecgroup.com (ilk + son kelime)
 */

export const DOVECGROUP_EMAIL_DOMAIN = 'dovecgroup.com'

/** İsim parçasını e-posta local kısmına çevir (Türkçe karakter → ASCII, sadece a-z0-9) */
export function slugEmailLocalPart(raw: string): string {
  if (!raw?.trim()) return ''
  let s = raw.trim().toLocaleLowerCase('tr-TR')
  const map: Record<string, string> = {
    ç: 'c',
    ğ: 'g',
    ı: 'i',
    i: 'i',
    ö: 'o',
    ş: 's',
    ü: 'u',
  }
  let out = ''
  for (const ch of s) {
    out += map[ch] ?? ch
  }
  out = out.normalize('NFD').replace(/\p{M}/gu, '')
  return out.replace(/[^a-z0-9]/g, '')
}

/**
 * Tam görünen isimden şirket e-postası üretir.
 * Tek kelime: local tek parça (örn. mehmet@dovecgroup.com)
 * İki+: ilkKelime.sonKelime
 */
export function buildDovecGroupWorkEmailFromDisplayName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''

  const first = slugEmailLocalPart(parts[0])
  if (!first) return ''

  if (parts.length === 1) {
    return `${first}@${DOVECGROUP_EMAIL_DOMAIN}`
  }

  const last = slugEmailLocalPart(parts[parts.length - 1])
  if (!last) {
    return `${first}@${DOVECGROUP_EMAIL_DOMAIN}`
  }

  return `${first}.${last}@${DOVECGROUP_EMAIL_DOMAIN}`
}
