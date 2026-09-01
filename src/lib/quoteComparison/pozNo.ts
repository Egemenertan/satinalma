/**
 * Teklif PDF'lerindeki "Poz No" / "Poz" sütunu (A1, A2, 01.02 vb.).
 * Aynı poz, ürün adları farklı olsa da karşılaştırma tablosunda tek satırda hizalanır.
 * Sıra/S.No gibi düz 1,2,3 numaraları poz sayılmaz — yanlış eşleşmeyi önlemek için.
 */

const POZ_PREFIX_RE = /^(?:poz\s*(?:no\.?|n[o°]|isyon)?\s*[:.\-]?\s*)/i
const LETTER_NUM_RE = /^([A-ZÇĞİÖŞÜ]{1,4})[.\-]?(\d{1,4}(?:[.\-]\d{1,4})*)$/
const DOTTED_NUM_RE = /^\d{1,4}(?:[.\-]\d{1,4}){1,4}$/
const POZ_IN_NAME_RE =
  /^(?:poz\s*(?:no\.?|n[o°]|isyon)?\s*[:.]?\s*)?([A-Za-zÇĞİÖŞÜ]{1,3}\s*[.\-]?\s*\d{1,4}(?:[.\-]\d{1,4})*|\d{1,3}(?:[.\-]\d{1,3}){1,3})\b/i

function compactPoz(raw: string): string {
  return raw.replace(POZ_PREFIX_RE, '').replace(/\s+/g, '').toLocaleUpperCase('tr-TR')
}

/** "01" / "001" → "1", "00" → "0". A01 ile A1 aynı poz olsun diye. */
function normalizeNumericTail(tail: string): string {
  return tail
    .replace(/-/g, '.')
    .split('.')
    .map((part) => {
      const n = Number.parseInt(part, 10)
      return Number.isFinite(n) ? String(n) : part
    })
    .join('.')
}

/** Karşılaştırma anahtarı: "A-1" / "A01" / "a1" / "A.1" → "A1", "01.02" → "1.2". Poz değilse null. */
export function normalizePozKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const compact = compactPoz(raw.trim())
  if (!compact) return null

  const letterNum = compact.match(LETTER_NUM_RE)
  if (letterNum) return `${letterNum[1]}${normalizeNumericTail(letterNum[2])}`

  if (DOTTED_NUM_RE.test(compact)) return normalizeNumericTail(compact)

  return null
}

/** Ekranda/Excel'de gösterilecek poz (normalize edilmiş, yoksa null). */
export function formatPozDisplay(raw: string | null | undefined): string | null {
  return normalizePozKey(raw)
}

/** AI alanı boşsa ürün adının başındaki A1 vb. ifadeden poz çıkarır. */
export function inferPozNo(poz: string | null | undefined, name: string | null | undefined): string | null {
  const fromField = formatPozDisplay(poz)
  if (fromField) return fromField
  if (!name?.trim()) return null
  const match = name.trim().match(POZ_IN_NAME_RE)
  return match ? formatPozDisplay(match[1]) : null
}

/** "A1 — Hidrofor" adından poz önekini siler; sade ürün adı kalsın. */
export function stripPozPrefix(name: string, poz: string | null | undefined): string {
  if (!name.trim()) return name
  const stripped = name
    .trim()
    .replace(
      /^(?:poz\s*(?:no\.?|n[o°]|isyon)?\s*[:.]?\s*)?[A-Za-zÇĞİÖŞÜ]{1,3}\s*[.\-]?\s*\d{1,4}(?:[.\-]\d{1,4})*\s*[-–—:.]?\s*/i,
      ''
    )
    .trim()
  return stripped || name.trim()
}

export function comparePozKeys(a: string, b: string): number {
  const parse = (key: string) => {
    const match = key.match(/^([A-ZÇĞİÖŞÜ]*)(.*)$/)
    const letters = match?.[1] || ''
    const rest = match?.[2] || ''
    const nums = rest.split('.').filter(Boolean).map((part) => Number.parseInt(part, 10) || 0)
    return { letters, nums }
  }
  const left = parse(a)
  const right = parse(b)
  const letterCmp = left.letters.localeCompare(right.letters, 'tr')
  if (letterCmp !== 0) return letterCmp
  const len = Math.max(left.nums.length, right.nums.length)
  for (let i = 0; i < len; i++) {
    const da = left.nums[i] ?? -1
    const db = right.nums[i] ?? -1
    if (da !== db) return da - db
  }
  return 0
}
