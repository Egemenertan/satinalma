/**
 * PDF'lerde para birimi çoğu zaman standart ISO kodu (USD/EUR) olarak değil, sembol
 * ("$", "€", "£", "₺") veya serbest metin ("dolar", "avro", "sterlin", "TL") olarak
 * geçer. AI çıkarımı bu farklı biçimleri STANDART bir ISO koduna çevirmeye çalışır;
 * bu fonksiyon o çıktıyı normalize eder. Tanınmayan/boş girişlerde null döner —
 * çağıran taraf teklifin genel para birimine (fallback) düşer.
 */
export function normalizeCurrencyCode(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  const upper = value.toUpperCase()
  if (['TRY', 'USD', 'EUR', 'GBP'].includes(upper)) return upper

  const lower = value.toLocaleLowerCase('tr-TR')
  if (value.includes('₺') || lower.includes('tl') || lower.includes('lira')) return 'TRY'
  if (value.includes('$') || lower.includes('usd') || lower.includes('dolar') || lower.includes('dollar')) return 'USD'
  if (value.includes('€') || lower.includes('eur') || lower.includes('avro') || lower.includes('euro')) return 'EUR'
  if (value.includes('£') || lower.includes('gbp') || lower.includes('sterlin') || lower.includes('pound')) return 'GBP'

  return null
}
