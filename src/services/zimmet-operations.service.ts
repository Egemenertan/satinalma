import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/auth/session'
import type { Json } from '@/lib/supabase'
import type { ZimmetAssignmentListPdfPayload } from '@/lib/pdf/zimmetAssignmentListPdf'

export type ZimmetOperationType = 'termination' | 'report' | 'delivery'

export type StoredZimmetOperation = {
  id: string
  operationType: ZimmetOperationType
  personName: string
  personEmail: string | null
  performedByName: string | null
  itemCount: number
  createdAt: string
  snapshot: ZimmetAssignmentListPdfPayload
}

const RETURNED_SELECT = `
  id,
  product_id,
  quantity,
  unit,
  assigned_date,
  return_date,
  owner_name,
  owner_email,
  notes,
  serial_number,
  item_name,
  products!user_inventory_product_id_fkey(
    name,
    sku,
    unit,
    product_type,
    images,
    unit_price,
    currency,
    brand:brands(name)
  ),
  warehouse:sites!user_inventory_source_warehouse_id_fkey(name)
`

export function groupInventoryBySite<T extends object>(rows: T[]) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const siteId = (row as { source_warehouse_id?: string | null }).source_warehouse_id
    if (!siteId) continue
    const list = groups.get(siteId) || []
    list.push(row)
    groups.set(siteId, list)
  }
  return groups
}

export function inventoryWarehouseName(row: object) {
  const warehouse = (row as { warehouse?: { name?: string } | { name?: string }[] | null }).warehouse
  const named = Array.isArray(warehouse) ? warehouse[0]?.name : warehouse?.name
  return named?.trim() || 'Depo'
}

export async function recordZimmetOperation(input: {
  operationType: ZimmetOperationType
  personName: string
  personEmail?: string | null
  siteId: string
  snapshot: ZimmetAssignmentListPdfPayload
}) {
  const siteId = input.siteId.trim()
  if (!siteId) return

  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return

  const { error } = await supabase.from('zimmet_operations').insert({
    operation_type: input.operationType,
    person_name: input.personName,
    person_email: input.personEmail || null,
    performed_by: auth.user.id,
    performed_by_name: input.snapshot.exportedByDisplayName || null,
    item_count: input.snapshot.rows.length,
    site_id: siteId,
    snapshot: input.snapshot as unknown as Json,
  })

  if (error) console.error('İşlem geçmişi yazılamadı:', error)
}

/** siteIds null ise çağıranın tüm yetkili siteleri (RLS) döner. Boş dizi hiçbir kayıt döndürmez. */
export async function fetchStoredZimmetOperations(siteIds?: string[] | null): Promise<StoredZimmetOperation[]> {
  const ids = siteIds?.map((id) => id.trim()).filter(Boolean)
  if (ids && ids.length === 0) return []

  const supabase = createClient()
  let query = supabase
    .from('zimmet_operations')
    .select('id, operation_type, person_name, person_email, performed_by_name, item_count, snapshot, created_at, site_id')
    .order('created_at', { ascending: false })
    .limit(100)

  if (ids) {
    const user = await getSessionUser(supabase)
    if (user?.id) {
      query = query.or(`site_id.in.(${ids.join(',')}),performed_by.eq.${user.id}`)
    } else {
      query = query.in('site_id', ids)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('İşlem geçmişi okunamadı:', error)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    operationType: row.operation_type === 'report' ? 'report' : row.operation_type === 'delivery' ? 'delivery' : 'termination',
    personName: row.person_name,
    personEmail: row.person_email,
    performedByName: row.performed_by_name,
    itemCount: row.item_count,
    createdAt: row.created_at,
    snapshot: row.snapshot as unknown as ZimmetAssignmentListPdfPayload,
  }))
}

export async function fetchPastTerminationRows(siteIds?: string[] | null) {
  const ids = siteIds?.map((id) => id.trim()).filter(Boolean)
  if (ids && ids.length === 0) return []

  const supabase = createClient()
  let query = supabase
    .from('user_inventory')
    .select(RETURNED_SELECT)
    .eq('status', 'returned')
    .ilike('notes', '%İlişki kesildi%')
    .order('return_date', { ascending: false })
    .limit(2000)

  if (ids) query = query.in('source_warehouse_id', ids)

  const { data, error } = await query

  if (error) {
    console.error('Eski ilişki kesme kayıtları okunamadı:', error)
    return []
  }
  return data || []
}
