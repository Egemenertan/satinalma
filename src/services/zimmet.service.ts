/**
 * Zimmet = sorumluluk kaydı.
 * Fiziksel stok depoda kalır; kaldırma/değiştirme depo miktarını değiştirmez.
 */

import { createClient } from '@/lib/supabase/client'

export type EmployeeOption = {
  id: string
  first_name: string | null
  work_email: string | null
}

export type ActiveZimmetRow = {
  id: string
  quantity: number
  serial_number: string | null
  owner_name: string | null
  owner_email: string | null
  source_warehouse_id: string | null
  assigned_date: string
  source_warehouse?: { id: string; name: string } | null
}

export type GroupedZimmetRow<T extends { id: string; quantity: number }> = T & {
  ids: string[]
}

function zimmetOwnerKey(row: {
  owner_email?: string | null
  owner_name?: string | null
  user?: { email?: string | null; full_name?: string | null } | null
  source_warehouse_id?: string | null
}) {
  const email = (row.owner_email || row.user?.email || '').trim().toLowerCase()
  const name = (row.owner_name || row.user?.full_name || '').trim().toLowerCase()
  return `${email || name || 'unknown'}|${row.source_warehouse_id || ''}`
}

function mergeSerials(...raw: Array<string | null | undefined>) {
  const set = new Set<string>()
  for (const value of raw) {
    for (const token of String(value || '').split(',')) {
      const t = token.trim()
      if (t) set.add(t)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr')).join(', ') || null
}

/** Aynı kişi + aynı depo zimmetlerini tek satırda topla */
export function groupZimmetsByOwner<
  T extends {
    id: string
    quantity: number
    serial_number?: string | null
    assigned_date?: string
    owner_email?: string | null
    owner_name?: string | null
    user?: { email?: string | null; full_name?: string | null } | null
    source_warehouse_id?: string | null
  },
>(rows: T[]): GroupedZimmetRow<T>[] {
  const map = new Map<string, GroupedZimmetRow<T>>()
  for (const row of rows) {
    const key = zimmetOwnerKey(row)
    const existing = map.get(key)
    const qty = Number(row.quantity) || 0
    if (!existing) {
      map.set(key, { ...row, quantity: qty, ids: [row.id] })
      continue
    }
    existing.quantity = Number(existing.quantity) + qty
    if (!existing.ids.includes(row.id)) existing.ids.push(row.id)
    existing.serial_number = mergeSerials(existing.serial_number, row.serial_number)
    if (row.assigned_date && (!existing.assigned_date || row.assigned_date > existing.assigned_date)) {
      existing.assigned_date = row.assigned_date
    }
  }
  return [...map.values()]
}

function uniqueInventoryIds(inventoryId: string, extra?: string[]) {
  return [...new Set([inventoryId, ...(extra || [])].filter(Boolean))]
}

async function getActorId() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

const QTY_EPS = 1e-9

function resolveActionQuantity(requested: number | undefined, currentQty: number) {
  const current = Number(currentQty) || 0
  if (!(current > 0)) throw new Error('Bu zimmette işlem yapılacak adet yok')

  const actionQty = requested == null ? current : Number(requested)
  if (!Number.isFinite(actionQty) || actionQty <= 0) {
    throw new Error('Geçerli bir adet girin')
  }
  if (actionQty > current + QTY_EPS) {
    throw new Error(`En fazla ${current} adet işlem yapılabilir`)
  }

  const isFull = actionQty >= current - QTY_EPS
  return {
    actionQty: isFull ? current : actionQty,
    remaining: isFull ? 0 : current - actionQty,
    isFull,
  }
}

function formatQty(qty: number) {
  return Number(qty).toLocaleString('tr-TR')
}

async function closeOrReduceInventoryRow(params: {
  inv: {
    id: string
    product_id: string | null
    quantity: number
    notes: string | null
    owner_name: string | null
    owner_email: string | null
    source_warehouse_id: string | null
    serial_number: string | null
  }
  actionQty: number
  actorId: string | null
  noteFull: string
  notePartial: string
  movementFull: string
  movementPartial: string
}) {
  const supabase = createClient()
  const current = Number(params.inv.quantity) || 0
  const { actionQty, remaining, isFull } = resolveActionQuantity(params.actionQty, current)
  const now = new Date().toISOString()

  if (isFull) {
    const { error: updErr } = await supabase
      .from('user_inventory')
      .update({
        status: 'returned',
        return_date: now,
        returned_quantity: actionQty,
        notes: [params.inv.notes, params.noteFull].filter(Boolean).join(' | '),
        updated_at: now,
      })
      .eq('id', params.inv.id)

    if (updErr) throw new Error('Zimmet kapatılamadı: ' + updErr.message)
  } else {
    const { error: updErr } = await supabase
      .from('user_inventory')
      .update({
        quantity: remaining,
        notes: [params.inv.notes, params.notePartial].filter(Boolean).join(' | '),
        updated_at: now,
      })
      .eq('id', params.inv.id)

    if (updErr) throw new Error('Zimmet güncellenemedi: ' + updErr.message)
  }

  if (params.inv.source_warehouse_id && params.inv.product_id) {
    await supabase.from('stock_movements').insert({
      product_id: params.inv.product_id,
      warehouse_id: params.inv.source_warehouse_id,
      movement_type: 'düzeltme',
      quantity: actionQty,
      reason: isFull ? params.movementFull : params.movementPartial,
      created_by: params.actorId,
      serial_number: isFull ? params.inv.serial_number : null,
    })
  }

  return { actionQty, remaining, isFull }
}

/** Zimmeti kaldır: sadece sorumluluk kaydını kapatır (depo stoğu aynı kalır) */
export async function removeZimmetAssignment(params: {
  inventoryId: string
  inventoryIds?: string[]
  productId: string
  productName?: string
  /** Belirtilmezse üzerindeki tüm adet kalkar */
  quantity?: number
}) {
  const supabase = createClient()
  const actorId = await getActorId()
  const ids = uniqueInventoryIds(params.inventoryId, params.inventoryIds)

  const { data: rows, error: invErr } = await supabase
    .from('user_inventory')
    .select(
      'id, product_id, quantity, status, owner_name, owner_email, source_warehouse_id, serial_number, notes, assigned_date'
    )
    .in('id', ids)
    .eq('status', 'active')
    .order('assigned_date', { ascending: true })

  if (invErr) throw new Error(invErr.message)
  if (!rows?.length) throw new Error('Zimmet kaydı bulunamadı')

  const totalQty = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  const { actionQty } = resolveActionQuantity(params.quantity, totalQty)
  const ownerLabel = rows[0].owner_name || rows[0].owner_email || 'kullanıcı'

  let left = actionQty
  for (const inv of rows) {
    if (left <= 0) break
    const take = Math.min(Number(inv.quantity) || 0, left)
    if (!(take > 0)) continue
    await closeOrReduceInventoryRow({
      inv,
      actionQty: take,
      actorId,
      noteFull: 'Zimmet kaldırıldı (stok depoda kaldı)',
      notePartial: `Kısmi zimmet kaldırma: ${formatQty(take)} adet`,
      movementFull: `Zimmet kaldırıldı: ${ownerLabel} (depo stoğu değişmedi)`,
      movementPartial: `Zimmet kısmen kaldırıldı: ${ownerLabel} (${formatQty(take)} adet) (depo stoğu değişmedi)`,
    })
    left -= take
  }

  return { ok: true, remaining: Math.max(0, totalQty - actionQty) }
}

/** Zimmeti değiştir: eski kaydı kapat, yeni kişiye aç (depo stoğu aynı) */
export async function changeZimmetAssignment(params: {
  inventoryId: string
  inventoryIds?: string[]
  newEmployee: EmployeeOption
  /** Belirtilmezse üzerindeki tüm adet aktarılır */
  quantity?: number
}) {
  const supabase = createClient()
  const actorId = await getActorId()
  const ids = uniqueInventoryIds(params.inventoryId, params.inventoryIds)

  const { data: rows, error: invErr } = await supabase
    .from('user_inventory')
    .select('*')
    .in('id', ids)
    .eq('status', 'active')
    .order('assigned_date', { ascending: true })

  if (invErr) throw new Error(invErr.message)
  if (!rows?.length) throw new Error('Zimmet kaydı bulunamadı')

  const totalQty = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  const { actionQty } = resolveActionQuantity(params.quantity, totalQty)

  const template = rows[0]
  const oldName = template.owner_name || 'eski zimmetli'
  const oldEmail = template.owner_email || ''
  const newName = (params.newEmployee.first_name || '').trim() || 'Çalışan'
  const newEmail = (params.newEmployee.work_email || '').trim() || null
  const now = new Date().toISOString()

  let left = actionQty
  for (const inv of rows) {
    if (left <= 0) break
    const take = Math.min(Number(inv.quantity) || 0, left)
    if (!(take > 0)) continue
    await closeOrReduceInventoryRow({
      inv,
      actionQty: take,
      actorId,
      noteFull: `Zimmet değiştirildi → ${newName}${newEmail ? ` <${newEmail}>` : ''}`,
      notePartial: `Kısmi zimmet aktarımı: ${formatQty(take)} adet → ${newName}`,
      movementFull: `Zimmet değişikliği: ${oldName} → ${newName} (depo stoğu değişmedi)`,
      movementPartial: `Zimmet kısmen aktarıldı: ${oldName} → ${newName} (${formatQty(take)} adet) (depo stoğu değişmedi)`,
    })
    left -= take
  }

  const serialNorm = rows.length === 1 ? rows[0].serial_number : mergeSerials(...rows.map((r) => r.serial_number))
  const ownerEmailNorm = (newEmail || '').toLowerCase()

  const { data: newOwnerRows } = await supabase
    .from('user_inventory')
    .select('id, quantity, notes, serial_number, owner_email')
    .eq('product_id', template.product_id)
    .eq('source_warehouse_id', template.source_warehouse_id)
    .eq('status', 'active')

  const existingForNewOwner = (newOwnerRows || []).find((row) => {
    const rowEmail = (row.owner_email || '').trim().toLowerCase()
    if (ownerEmailNorm) return rowEmail === ownerEmailNorm
    return !rowEmail
  })

  if (existingForNewOwner) {
    const { error: mergeErr } = await supabase
      .from('user_inventory')
      .update({
        quantity: Number(existingForNewOwner.quantity) + actionQty,
        notes: [
          existingForNewOwner.notes,
          `Zimmet aktarımı: ${oldName}${oldEmail ? ` <${oldEmail}>` : ''} → ${newName} (${formatQty(actionQty)} adet)`,
        ]
          .filter(Boolean)
          .join(' | '),
        updated_at: now,
      })
      .eq('id', existingForNewOwner.id)

    if (mergeErr) throw new Error('Yeni zimmet güncellenemedi: ' + mergeErr.message)
  } else {
    const { error: insertErr } = await supabase.from('user_inventory').insert({
      product_id: template.product_id,
      item_name: template.item_name,
      quantity: actionQty,
      unit: template.unit || 'adet',
      assigned_date: now,
      assigned_by: actorId,
      status: 'active',
      notes: `Zimmet değişikliği: ${oldName}${oldEmail ? ` <${oldEmail}>` : ''} → ${newName}`,
      category: template.category,
      consumed_quantity: 0,
      owner_name: newName,
      owner_email: newEmail,
      source_warehouse_id: template.source_warehouse_id,
      serial_number: serialNorm,
    })

    if (insertErr) throw new Error('Yeni zimmet oluşturulamadı: ' + insertErr.message)
  }

  return { ok: true, remaining: Math.max(0, totalQty - actionQty) }
}

/** Depoda zimmet: stok düşülmez, sadece sorumluluk yazılır */
export async function assignZimmetInWarehouse(params: {
  productId: string
  productName: string
  productUnit?: string
  warehouseId: string
  quantity: number
  employee: EmployeeOption
  reason?: string
  serialNumber?: string
}) {
  const supabase = createClient()
  const actorId = await getActorId()
  const qty = params.quantity

  if (!params.warehouseId) throw new Error('Depo seçin')
  if (!params.employee?.id) throw new Error('Çalışan seçin')
  if (!(qty > 0)) throw new Error('Geçerli miktar girin')

  const { data: stock, error: stockErr } = await supabase
    .from('warehouse_stock')
    .select('quantity')
    .eq('product_id', params.productId)
    .eq('warehouse_id', params.warehouseId)
    .is('user_id', null)
    .maybeSingle()

  if (stockErr) throw new Error(stockErr.message)
  const warehouseQty = Number(stock?.quantity) || 0
  if (warehouseQty < qty) {
    throw new Error(`Depoda yeterli stok yok. Mevcut: ${warehouseQty}`)
  }

  const { data: activeZimmets, error: zimmetSumErr } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('product_id', params.productId)
    .eq('source_warehouse_id', params.warehouseId)
    .eq('status', 'active')

  if (zimmetSumErr) throw new Error(zimmetSumErr.message)
  const alreadyZimmet = (activeZimmets || []).reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0
  )
  const availableForZimmet = Math.max(0, warehouseQty - alreadyZimmet)
  if (qty > availableForZimmet) {
    throw new Error(
      `Zimmetlenebilir miktar yetersiz. Depo stoğu: ${warehouseQty}, mevcut zimmet: ${alreadyZimmet}, kalan: ${availableForZimmet}`
    )
  }

  const ownerName = (params.employee.first_name || '').trim() || 'Çalışan'
  const ownerEmail = (params.employee.work_email || '').trim() || null
  const serialNorm = params.serialNumber?.trim() || null
  const ownerEmailNorm = (ownerEmail || '').toLowerCase()

  const { data: ownerRows, error: ownerRowsErr } = await supabase
    .from('user_inventory')
    .select('id, quantity, notes, serial_number, owner_email')
    .eq('product_id', params.productId)
    .eq('source_warehouse_id', params.warehouseId)
    .eq('status', 'active')

  if (ownerRowsErr) throw new Error(ownerRowsErr.message)

  const existingForOwner = (ownerRows || []).find((row) => {
    const rowEmail = (row.owner_email || '').trim().toLowerCase()
    if (ownerEmailNorm) {
      if (rowEmail !== ownerEmailNorm) return false
    } else if (rowEmail) {
      return false
    }
    const rowSerial = (row.serial_number || '').trim()
    const newSerial = serialNorm || ''
    return rowSerial === newSerial
  })

  if (existingForOwner) {
    const { error: updErr } = await supabase
      .from('user_inventory')
      .update({
        quantity: Number(existingForOwner.quantity) + qty,
        notes: [existingForOwner.notes, params.reason || 'Zimmet eklendi']
          .filter(Boolean)
          .join(' | '),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingForOwner.id)

    if (updErr) throw new Error('Zimmet güncellenemedi: ' + updErr.message)
  } else {
    const { error: invErr } = await supabase.from('user_inventory').insert({
      product_id: params.productId,
      item_name: params.productName,
      quantity: qty,
      unit: params.productUnit || 'adet',
      assigned_date: new Date().toISOString(),
      assigned_by: actorId,
      status: 'active',
      notes: params.reason || 'Ürün detayından zimmet (depoda kaldı)',
      consumed_quantity: 0,
      owner_name: ownerName,
      owner_email: ownerEmail,
      source_warehouse_id: params.warehouseId,
      serial_number: serialNorm,
    })

    if (invErr) throw new Error('Zimmet kaydı oluşturulamadı: ' + invErr.message)
  }

  await supabase.from('stock_movements').insert({
    product_id: params.productId,
    warehouse_id: params.warehouseId,
    movement_type: 'düzeltme',
    quantity: qty,
    reason: `Zimmet: ${ownerName}${ownerEmail ? ` <${ownerEmail}>` : ''} — stok depoda kaldı${
      params.reason ? ` | ${params.reason}` : ''
    }`,
    created_by: actorId,
    serial_number: params.serialNumber || null,
  })

  return { ok: true }
}

export async function fetchActiveZimmetsForProduct(
  productId: string
): Promise<ActiveZimmetRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_inventory')
    .select(
      `
      id,
      quantity,
      serial_number,
      owner_name,
      owner_email,
      source_warehouse_id,
      assigned_date,
      source_warehouse:sites!user_inventory_source_warehouse_id_fkey(id, name)
    `
    )
    .eq('product_id', productId)
    .eq('status', 'active')
    .order('assigned_date', { ascending: false })

  if (error) throw error

  return (data || []).map((item: any) => ({
    ...item,
    source_warehouse: Array.isArray(item.source_warehouse)
      ? item.source_warehouse[0]
      : item.source_warehouse,
  }))
}

export type ZimmetWarehouseAvailability = {
  warehouseId: string
  warehouseName: string
  /** Depodaki fiziksel stok */
  stockQty: number
  /** Bu depodan kaynaklı aktif zimmet toplamı */
  zimmetQty: number
  /** Zimmet yapılabilir (stok − mevcut zimmet, min 0) */
  availableQty: number
}

/** Ürün için depo bazında zimmetlenebilir miktar özeti */
export async function fetchZimmetAvailabilityByWarehouse(
  productId: string
): Promise<ZimmetWarehouseAvailability[]> {
  const supabase = createClient()

  const [stockRes, zimmetRes] = await Promise.all([
    supabase
      .from('warehouse_stock')
      .select(
        `
        warehouse_id,
        quantity,
        warehouse:sites(id, name)
      `
      )
      .eq('product_id', productId)
      .is('user_id', null)
      .gt('quantity', 0),
    supabase
      .from('user_inventory')
      .select('source_warehouse_id, quantity')
      .eq('product_id', productId)
      .eq('status', 'active')
      .not('source_warehouse_id', 'is', null),
  ])

  if (stockRes.error) throw new Error(stockRes.error.message)
  if (zimmetRes.error) throw new Error(zimmetRes.error.message)

  const zimmetByWarehouse = new Map<string, number>()
  for (const row of zimmetRes.data || []) {
    const wid = row.source_warehouse_id as string
    if (!wid) continue
    zimmetByWarehouse.set(wid, (zimmetByWarehouse.get(wid) || 0) + Number(row.quantity || 0))
  }

  const byWarehouse = new Map<string, ZimmetWarehouseAvailability>()

  for (const row of stockRes.data || []) {
    const wid = row.warehouse_id as string
    if (!wid) continue
    const wh = Array.isArray(row.warehouse) ? row.warehouse[0] : row.warehouse
    const stockQty = Number(row.quantity) || 0
    const zimmetQty = zimmetByWarehouse.get(wid) || 0
    byWarehouse.set(wid, {
      warehouseId: wid,
      warehouseName: wh?.name || 'Depo',
      stockQty,
      zimmetQty,
      availableQty: Math.max(0, stockQty - zimmetQty),
    })
  }

  // Stok satırı yok ama zimmeti olan depolar (edge)
  const missingWarehouseIds = [...zimmetByWarehouse.keys()].filter((wid) => !byWarehouse.has(wid))
  if (missingWarehouseIds.length > 0) {
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name')
      .in('id', missingWarehouseIds)
    const nameById = new Map((sites || []).map((s) => [s.id, s.name]))
    for (const wid of missingWarehouseIds) {
      const zimmetQty = zimmetByWarehouse.get(wid) || 0
      byWarehouse.set(wid, {
        warehouseId: wid,
        warehouseName: nameById.get(wid) || 'Depo',
        stockQty: 0,
        zimmetQty,
        availableQty: 0,
      })
    }
  }

  return [...byWarehouse.values()].sort((a, b) =>
    a.warehouseName.localeCompare(b.warehouseName, 'tr')
  )
}

export async function fetchEmployeesForZimmet(): Promise<EmployeeOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, work_email')
    .order('first_name')

  if (error) throw error
  return (data || []) as EmployeeOption[]
}
