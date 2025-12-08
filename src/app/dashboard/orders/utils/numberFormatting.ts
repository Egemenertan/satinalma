/**
 * Number Formatting Utilities
 * Türk formatında sayı işlemleri (1.000,00)
 */

/**
 * Sayıyı Türk formatına çevirir (binlik ayırıcı nokta, ondalık virgül)
 * @param value - Format edilecek string değer
 * @returns Formatlanmış string (örn: "1.234,56")
 */
export function formatNumberWithDots(value: string): string {
  // Boş değer kontrolü
  if (!value) return ''
  
  // Virgül sayısını kontrol et (birden fazla virgül olmasın)
  const commaCount = (value.match(/,/g) || []).length
  if (commaCount > 1) {
    // Fazla virgülleri kaldır, sadece ilkini bırak
    const firstCommaIndex = value.indexOf(',')
    value = value.slice(0, firstCommaIndex + 1) + value.slice(firstCommaIndex + 1).replace(/,/g, '')
  }
  
  // Virgülden sonraki kısmı ayır (ondalık kısım)
  const parts = value.split(',')
  const integerPart = parts[0] || ''
  const decimalPart = parts[1]
  
  // Sadece rakamları al (tam sayı kısmı için)
  const numericValue = integerPart.replace(/[^\d]/g, '')
  
  // Eğer tam sayı kısmı boşsa ve ondalık kısım varsa
  if (!numericValue && decimalPart !== undefined) {
    return '0,' + decimalPart.replace(/[^\d]/g, '').slice(0, 2)
  }
  
  // Eğer hiç rakam yoksa boş döndür
  if (!numericValue) return ''
  
  // Binlik ayırıcı ekle
  const formattedInteger = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  
  // Ondalık kısım varsa ekle
  if (decimalPart !== undefined) {
    // Ondalık kısmı maksimum 2 haneli yap ve sadece rakam olmasını sağla
    const cleanDecimal = decimalPart.replace(/[^\d]/g, '').slice(0, 2)
    return formattedInteger + ',' + cleanDecimal
  }
  
  return formattedInteger
}

/**
 * Türk formatındaki sayıyı standart formata çevirir
 * @param value - Parse edilecek string (örn: "1.234,56")
 * @returns Standart format (örn: "1234.56")
 */
export function parseNumberFromDots(value: string): string {
  // Noktaları kaldır (binlik ayırıcı) ve virgülü noktaya çevir (ondalık ayırıcı)
  return value.replace(/\./g, '').replace(',', '.')
}

/**
 * String'i sayıya çevirir (parse + float)
 * @param value - Parse edilecek string
 * @returns Number değer
 */
export function parseToNumber(value: string): number {
  const parsed = parseNumberFromDots(value)
  return parseFloat(parsed) || 0
}

/**
 * Sayıyı Türk para formatında gösterir
 * @param value - Format edilecek sayı
 * @param currency - Para birimi (TRY, USD, EUR, GBP)
 * @returns Formatlanmış string (örn: "1.234,56 TRY")
 */
export function formatCurrency(value: number, currency: string = 'TRY'): string {
  return value.toLocaleString('tr-TR', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ' + currency
}





















