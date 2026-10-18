const PRESERVE_UPPER = new Set(['PDF', 'USD', 'EUR', 'TRY', 'IT', 'SLA', 'GMO', 'ID', 'API'])

/** Her kelimenin ilk harfi büyük (TR). Kısaltmalar korunur. */
export function titleCaseTr(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part
      return part
        .split(/([-–—/·:,.])/)
        .filter(Boolean)
        .map((token) => {
          if (/^[-–—/·:,.]$/.test(token)) return token
          const upper = token.toLocaleUpperCase('tr-TR')
          if (PRESERVE_UPPER.has(upper)) return upper
          if (/^\d/.test(token)) return token
          const lower = token.toLocaleLowerCase('tr-TR')
          if (!lower) return token
          return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1)
        })
        .join('')
    })
    .join('')
}
