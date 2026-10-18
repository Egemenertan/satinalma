import { normalizeMaterialName } from '@/lib/contracts'

/** 15'lik tuğla: 1 palet genelde 100–150, yaygın değer 120 adet. */
export const BRICK_15_PER_PALLET = 120

/** 15'lik tuğla: 1 tır 20–26 palet / 2.500–3.500 adet. Ortası 3.000. */
export const BRICK_15_PER_TRUCK = 3000

export type ConvertedQuantity = {
  quantity: number
  unit: string
  originalQuantity: number
  originalUnit: string
  converted: boolean
}

function normalizeUnit(unit: string | null | undefined): string {
  return String(unit || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
}

export function isPalletUnit(unit: string | null | undefined): boolean {
  return normalizeUnit(unit) === 'palet'
}

export function isTruckUnit(unit: string | null | undefined): boolean {
  const value = normalizeUnit(unit)
  return value === 'tir' || value === 'truck' || value === 'tirlik'
}

function foldTr(value: string): string {
  return value
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

export function isBrick15(name: string | null | undefined): boolean {
  const value = foldTr(normalizeMaterialName(name))
  if (!value.includes('tugla')) return false
  if (/\b15\s*[x*×]\s*30/.test(value)) return true
  if (/\b15\s*['`´]?\s*lik/.test(value)) return true
  return false
}

export function convertBrickQuantity(
  name: string,
  quantity: number,
  unit: string
): ConvertedQuantity {
  const originalQuantity = Number(quantity) || 0
  const originalUnit = unit || ''
  const base = {
    originalQuantity,
    originalUnit,
  }

  if (!isBrick15(name)) {
    return { ...base, quantity: originalQuantity, unit: originalUnit || 'Adet', converted: false }
  }

  if (isPalletUnit(unit)) {
    return {
      ...base,
      quantity: originalQuantity * BRICK_15_PER_PALLET,
      unit: 'Adet',
      converted: true,
    }
  }

  if (isTruckUnit(unit)) {
    return {
      ...base,
      quantity: originalQuantity * BRICK_15_PER_TRUCK,
      unit: 'Adet',
      converted: true,
    }
  }

  return { ...base, quantity: originalQuantity, unit: originalUnit || 'Adet', converted: false }
}

export function formatConvertedQty(
  formatQty: (value: number, unit?: string) => string,
  converted: ConvertedQuantity
): string {
  if (!converted.converted) {
    return formatQty(converted.originalQuantity, converted.originalUnit)
  }
  return `${formatQty(converted.originalQuantity, converted.originalUnit)} ≈ ${formatQty(converted.quantity, converted.unit)}`
}
