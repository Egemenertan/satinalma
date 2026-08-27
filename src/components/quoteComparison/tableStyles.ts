import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Karşılaştırma tablolarının (teknik özellik, kalem fiyatı, ticari şartlar) ortak
 * hücre/sütun stilleri. Önerilen teklifin sütununu yeşil çerçeveyle vurgulamak ve
 * çift/tek satır zebra deseni için tüm tablolarda aynı mantık kullanılır.
 */
export const BRAND_GREEN = '#00E676'

export function recommendedColShadow(position: 'head' | 'mid' | 'last'): CSSProperties {
  const sides = `inset 3px 0 0 0 ${BRAND_GREEN}, inset -3px 0 0 0 ${BRAND_GREEN}`
  if (position === 'head') return { boxShadow: `${sides}, inset 0 3px 0 0 ${BRAND_GREEN}` }
  if (position === 'last') return { boxShadow: `${sides}, inset 0 -3px 0 0 ${BRAND_GREEN}` }
  return { boxShadow: sides }
}

export function valueCellClass(odd: boolean, recommended: boolean, altCol: boolean): string {
  if (recommended) return odd ? 'bg-neutral-200/70' : 'bg-neutral-100'
  if (altCol) return odd ? 'bg-neutral-50' : 'bg-[#fafafa]'
  return odd ? 'bg-neutral-50' : 'bg-white'
}

export function featureCellClass(odd: boolean): string {
  return cn(
    'sticky left-0 z-10 px-5 py-[15px] text-[13px] font-bold text-neutral-900 align-top leading-snug',
    odd ? 'bg-neutral-100' : 'bg-neutral-50'
  )
}

export function headerCellClass(colIdx: number, recommended: boolean, colMin: string): string {
  return cn(
    'px-4 py-4 text-left align-bottom',
    colMin,
    recommended ? 'bg-neutral-300/80' : colIdx % 2 === 1 ? 'bg-neutral-100' : 'bg-neutral-200/60'
  )
}
