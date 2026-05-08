/**
 * Genel Merkez / depo: departmanı IT olan warehouse_manager kullanıcıları
 * yalnızca belirli malzeme gruplarına ait kalemi olan talepleri görmeli.
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

/** Profildeki departman IT olarak kabul edilir (İT / Bilgi Teknolojileri vb. genişletilebilir). */
export function isProfileDepartmentIt(department: string | null | undefined): boolean {
  if (!department || typeof department !== 'string') return false
  const n = normalizeTr(department)
  if (n === 'it') return true
  if (n.includes('bilgi teknoloj')) return true
  if ((n.includes('bilgi') && n.includes('islem')) || n.includes('bilgi işlem')) return true
  // Sık kullanılan departman adları (normalizeTr sonrası ş→s, ı→i)
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

/** Malzeme satırı / talep başlığı IT depo kapsamındaki üç kategoriden biriyle uyumlu mu? */
export function materialLineAllowedForItWarehouse(row: ItWarehouseMaterialRow): boolean {
  const haystack = normalizeTr(
    [
      row.material_group,
      row.material_group_code,
      row.material_class,
      row.material_item_name,
      row.item_name
    ]
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
    (haystack.includes('elektronik') && haystack.includes('cihaz')) ||
    haystack.includes('elektronik cihazlar')

  return computerHardware || computerComponents || electronicDevices
}

/** @deprecated materialLineAllowedForItWarehouse kullanın */
export function materialGroupAllowedForItWarehouse(
  materialGroup: string | null | undefined,
  materialGroupCode: string | null | undefined
): boolean {
  return materialLineAllowedForItWarehouse({ material_group: materialGroup, material_group_code: materialGroupCode })
}

/**
 * IT warehouse_manager için gösterilecek purchase_request id listesi.
 * Sadece en az bir kalemi izin verilen grupta olan talepler.
 */
export async function fetchPurchaseRequestIdsVisibleToItWarehouseManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string[]> {
  const selectCols =
    'purchase_request_id, material_group, material_group_code, material_class, material_item_name, item_name'

  const [
    { data: itemsByGroup, error: err1 },
    { data: itemsByCode, error: err2 },
    { data: itemsByClass, error: err3 },
    { data: prByGroup, error: err4 },
    { data: prByClass, error: err5 }
  ] = await Promise.all([
    supabase.from('purchase_request_items').select(selectCols).not('material_group', 'is', null),
    supabase.from('purchase_request_items').select(selectCols).not('material_group_code', 'is', null),
    supabase.from('purchase_request_items').select(selectCols).not('material_class', 'is', null),
    supabase
      .from('purchase_requests')
      .select('id, material_group, material_class, material_item_name')
      .not('material_group', 'is', null),
    supabase
      .from('purchase_requests')
      .select('id, material_group, material_class, material_item_name')
      .not('material_class', 'is', null)
  ])

  if (err1) console.error('IT warehouse items (material_group) query:', err1)
  if (err2) console.error('IT warehouse items (material_group_code) query:', err2)
  if (err3) console.error('IT warehouse items (material_class) query:', err3)
  if (err4) console.error('IT warehouse requests (material_group) query:', err4)
  if (err5) console.error('IT warehouse requests (material_class) query:', err5)

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
          item_name: row.item_name as string | null
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
        material_group: row.material_group,
        material_class: row.material_class,
        material_item_name: row.material_item_name
      })
    ) {
      ids.add(row.id)
    }
  }
  for (const row of prByClass || []) {
    if (
      materialLineAllowedForItWarehouse({
        material_group: row.material_group,
        material_class: row.material_class,
        material_item_name: row.material_item_name
      })
    ) {
      ids.add(row.id)
    }
  }

  return Array.from(ids)
}

/** Talepteki kalemlerden en az biri IT depo filtresine uyuyor mu? */
export function purchaseRequestHasItWarehouseVisibleItem(
  items: Array<{
    material_group?: string | null
    material_group_code?: string | null
    material_class?: string | null
    material_item_name?: string | null
    item_name?: string | null
  }>
): boolean {
  if (!items?.length) return false
  return items.some((it) => materialLineAllowedForItWarehouse(it))
}
