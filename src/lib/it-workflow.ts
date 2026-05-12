/** Pazarlama IT Yönetim akışı — sabitler ve profil eşlemesi */

export const IT_WORKFLOW_DEPARTMENT_LABEL = 'Pazarlama'

export const IT_STATUS_INCELEMEDE = 'it_incelemesinde' as const
export const IT_STATUS_ONAYLANDI = 'it_onaylandi' as const

export const IT_WORKFLOW_STATUSES = [IT_STATUS_INCELEMEDE, IT_STATUS_ONAYLANDI] as const

export type ItWorkflowStatus = (typeof IT_WORKFLOW_STATUSES)[number]

export function normalizeMaterialGroupToken(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

export function isPazarlamaDepartment(
  department: string | null | undefined
): boolean {
  return normalizeMaterialGroupToken(department) === normalizeMaterialGroupToken(IT_WORKFLOW_DEPARTMENT_LABEL)
}

export function canSeeItWorkflowTab(profile: {
  role?: string | null
  department?: string | null
} | null): boolean {
  if (!profile?.role) return false
  if (profile.role === 'admin' || profile.role === 'manager') return true
  if (!isPazarlamaDepartment(profile.department)) return false
  return profile.role === 'department_head' || profile.role === 'site_manager'
}

/** Ofis ekipmanları — IT akışına düşen malzeme sınıfı ve gruplar (DB ile aynı yazım) */
export const IT_TRIGGER_MATERIAL_CLASS = 'Ofis Ekipmanları'

export const IT_TRIGGER_MATERIAL_GROUPS = [
  'Bilgisayar Donanımları',
  'Elektronik Cihazlar'
] as const

const OFIS_CLASS_TOKEN = normalizeMaterialGroupToken(IT_TRIGGER_MATERIAL_CLASS)
const IT_TRIGGER_GROUP_TOKENS = new Set(
  IT_TRIGGER_MATERIAL_GROUPS.map(g => normalizeMaterialGroupToken(g))
)

/** Ofis Ekipmanları + Bilgisayar Donanımları / Elektronik Cihazlar */
export function matchesOfisEkipmanlariItTrigger(item: {
  material_class?: string | null
  material_group?: string | null
}): boolean {
  if (normalizeMaterialGroupToken(item.material_class) !== OFIS_CLASS_TOKEN) return false
  const g = normalizeMaterialGroupToken(item.material_group)
  return Boolean(g && IT_TRIGGER_GROUP_TOKENS.has(g))
}

/** Admin tablosundaki gruplar VEYA Ofis Ekipmanları sabit tetikleyici */
export function purchaseLinesTriggerItWorkflow(
  dbActiveGroupTokens: Set<string>,
  lines: { material_class?: string | null; material_group?: string | null }[]
): boolean {
  for (const line of lines) {
    if (matchesOfisEkipmanlariItTrigger(line)) return true
    const t = normalizeMaterialGroupToken(line.material_group)
    if (t && dbActiveGroupTokens.has(t)) return true
  }
  return false
}
