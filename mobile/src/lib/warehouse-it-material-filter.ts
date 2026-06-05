/**
 * IT warehouse_manager malzeme filtresi
 * satinalma/src/lib/warehouse-it-material-filter.ts ile aynı mantık
 */

function normalizeTr(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/\s+/g, ' ')
}

export function isProfileDepartmentIt(department: string | null | undefined): boolean {
  if (!department || typeof department !== 'string') return false
  const n = normalizeTr(department)
  if (n === 'it') return true
  if (n.includes('bilgi teknoloj')) return true
  if ((n.includes('bilgi') && n.includes('islem')) || n.includes('bilgi işlem')) return true
  if (n.includes('bilisim')) return true
  return false
}

export type ItWarehouseMaterialRow = {
  material_group?: string | null
  material_group_code?: string | null
  material_class?: string | null
  material_item_name?: string | null
  item_name?: string | null
}

export function materialLineAllowedForItWarehouse(row: ItWarehouseMaterialRow): boolean {
  const haystack = normalizeTr(
    [row.material_group, row.material_group_code, row.material_class, row.material_item_name, row.item_name]
      .filter(Boolean)
      .join(' ')
  )

  if (!haystack.trim()) return false

  const computerHardware =
    (haystack.includes('bilgisayar') && haystack.includes('donanim')) ||
    haystack.includes('bilgisayar donanimlari') ||
    haystack.includes('pc donanim')

  const computerComponents =
    (haystack.includes('bilgisayar') && haystack.includes('bilesen')) ||
    haystack.includes('bilgisayar bilesenleri')

  const electronicDevices =
    (haystack.includes('elektronik') && haystack.includes('cihaz')) || haystack.includes('elektronik cihazlar')

  return computerHardware || computerComponents || electronicDevices
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPurchaseRequestIdsVisibleToItWarehouseManager(supabase: any): Promise<string[]> {
  const selectCols =
    'purchase_request_id, material_group, material_group_code, material_class, material_item_name, item_name'

  const [
    { data: itemsByGroup },
    { data: itemsByCode },
    { data: itemsByClass },
    { data: prByGroup },
    { data: prByClass },
  ] = await Promise.all([
    supabase.from('purchase_request_items').select(selectCols).not('material_group', 'is', null),
    supabase.from('purchase_request_items').select(selectCols).not('material_group_code', 'is', null),
    supabase.from('purchase_request_items').select(selectCols).not('material_class', 'is', null),
    supabase.from('purchase_requests').select('id, material_group, material_class, material_item_name').not('material_group', 'is', null),
    supabase.from('purchase_requests').select('id, material_group, material_class, material_item_name').not('material_class', 'is', null),
  ])

  const ids = new Set<string>()

  const scanItemRows = (rows: Record<string, unknown>[] | null) => {
    for (const row of rows || []) {
      const reqId = String(row.purchase_request_id || '')
      if (!reqId) continue
      if (
        materialLineAllowedForItWarehouse({
          material_group: row.material_group as string | null,
          material_group_code: row.material_group_code as string | null,
          material_class: row.material_class as string | null,
          material_item_name: row.material_item_name as string | null,
          item_name: row.item_name as string | null,
        })
      ) {
        ids.add(reqId)
      }
    }
  }

  scanItemRows(itemsByGroup as Record<string, unknown>[] | null)
  scanItemRows(itemsByCode as Record<string, unknown>[] | null)
  scanItemRows(itemsByClass as Record<string, unknown>[] | null)

  for (const row of prByGroup || []) {
    if (
      materialLineAllowedForItWarehouse({
        material_group: row.material_group as string | null,
        material_class: row.material_class as string | null,
        material_item_name: row.material_item_name as string | null,
      })
    ) {
      ids.add(row.id as string)
    }
  }
  for (const row of prByClass || []) {
    if (
      materialLineAllowedForItWarehouse({
        material_group: row.material_group as string | null,
        material_class: row.material_class as string | null,
        material_item_name: row.material_item_name as string | null,
      })
    ) {
      ids.add(row.id as string)
    }
  }

  return Array.from(ids)
}
