/**
 * Search Utilities
 * Arama işlemleri için yardımcı fonksiyonlar
 */

/**
 * Türkçe karakterleri normalize et (büyük/küçük harf ve özel karakterler)
 * İNŞAAT → insaat, Çimento → cimento
 */
export function normalizeSearchTerm(text: string): string {
  if (!text) return ''
  
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .trim()
}

/**
 * Kelime bazlı arama - her kelime için ayrı arama
 * "inşaat demiri" → ["insaat", "demiri"]
 */
export function splitSearchTerms(text: string): string[] {
  const normalized = normalizeSearchTerm(text)
  return normalized.split(/\s+/).filter(Boolean)
}

/**
 * PostgreSQL için ILIKE pattern oluştur
 * Türkçe karakterleri normalize ederek
 */
export function createSearchPattern(text: string): string {
  const normalized = normalizeSearchTerm(text)
  return `%${normalized}%`
}

/**
 * Çoklu kelime için OR pattern oluştur
 * ["insaat", "demiri"] → "%insaat%|%demiri%"
 */
export function createMultiWordPattern(terms: string[]): string {
  return terms.map(term => `%${term}%`).join('|')
}











