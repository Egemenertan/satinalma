const LIST_PREFIX = /^(?:[-–—*•·]|\d+[.)]|[a-zA-ZçğıöşüÇĞİÖŞÜ][.)])\s+/

export function isNotesFeature(feature: string): boolean {
  const key = feature.trim().toLocaleLowerCase('tr-TR')
  return /notlar|açıklama|özel şart|diğer not|^not$/.test(key)
}

function cleanItem(value: string): string {
  return value.replace(LIST_PREFIX, '').replace(/\s+/g, ' ').trim()
}

function nonemptyItems(parts: string[]): string[] {
  return parts.map(cleanItem).filter((part) => part.length > 1)
}

/**
 * Tek paragrafa sıkışmış not / şart metnini maddelere böler.
 * Mevcut kayıtlardaki duvar-metinleri de okunaklı hale getirir.
 */
export function splitReadableItems(value: string, aggressive = false): string[] {
  const text = value.replace(/\r\n/g, '\n').trim()
  if (!text) return []

  if (text.includes('\n')) {
    const lines = nonemptyItems(text.split(/\n+/))
    if (lines.length > 1) return lines
  }

  if (/[•·●]/.test(text)) {
    const parts = nonemptyItems(text.split(/[•·●]+/))
    if (parts.length > 1) return parts
  }

  const numbered = text.match(/(?:^|\s)\d+[.)]\s/g) || []
  if (numbered.length >= 2) {
    const parts = nonemptyItems(text.split(/(?:^|\s)(?=\d+[.)]\s)/))
    if (parts.length > 1) return parts
  }

  if ((text.match(/;/g) || []).length >= 1) {
    const parts = nonemptyItems(text.split(';'))
    if (parts.length > 1) return parts
  }

  const dashParts = nonemptyItems(text.split(/\s+[-–—]\s+/))
  if (dashParts.length >= 3) return dashParts

  const minLength = aggressive ? 24 : 90
  if (text.length >= minLength) {
    const sentences = nonemptyItems(text.split(/(?<=[.!?])\s+/))
    if (sentences.length > 1) return sentences
  }

  if (aggressive && (text.match(/,/g) || []).length >= 2 && text.length >= 40) {
    const parts = nonemptyItems(text.split(','))
    if (parts.length >= 3) return parts
  }

  return [cleanItem(text) || text]
}
