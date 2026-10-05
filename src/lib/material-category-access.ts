/** material_categories.category_type: insaat | ofis | both */

export const SHARED_MATERIAL_CATEGORY_TYPE = 'both'

export function materialCategoryTypesForCreateModal(restrictToStationery: boolean): string[] {
  return restrictToStationery
    ? ['ofis', SHARED_MATERIAL_CATEGORY_TYPE]
    : ['insaat', SHARED_MATERIAL_CATEGORY_TYPE]
}

function normalizeCategoryKey(value: string | null | undefined): string {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

/** Hem şantiye hem ofis taleplerinde görünen sınıflar (ör. Güvenlik). */
export function isSharedMaterialCategory(category: {
  name?: string | null
  category_type?: string | null
}): boolean {
  const type = String(category.category_type ?? '').trim().toLowerCase()
  if (type === SHARED_MATERIAL_CATEGORY_TYPE) return true
  return normalizeCategoryKey(category.name) === 'guvenlik'
}
