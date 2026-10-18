import { createClient } from '@/lib/supabase/client'
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

export async function recordZimmetOperation(input: {
  operationType: ZimmetOperationType
  personName: string
  personEmail?: string | null
  snapshot: ZimmetAssignmentListPdfPayload
}) {
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
    snapshot: input.snapshot as unknown as Json,
  })

  if (error) console.error('İşlem geçmişi yazılamadı:', error)
}

export async function fetchStoredZimmetOperations(): Promise<StoredZimmetOperation[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('zimmet_operations')
    .select('id, operation_type, person_name, person_email, performed_by_name, item_count, snapshot, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

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

export async function fetchPastTerminationRows() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_inventory')
    .select(RETURNED_SELECT)
    .eq('status', 'returned')
    .ilike('notes', '%İlişki kesildi%')
    .order('return_date', { ascending: false })
    .limit(2000)

  if (error) {
    console.error('Eski ilişki kesme kayıtları okunamadı:', error)
    return []
  }
  return data || []
}
