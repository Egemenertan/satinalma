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

async function getActorId() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Zimmeti kaldır: sadece sorumluluk kaydını kapatır (depo stoğu aynı kalır) */
export async function removeZimmetAssignment(params: {
  inventoryId: string
  productId: string
  productName?: string
}) {
  const supabase = createClient()
  const actorId = await getActorId()

  const { data: inv, error: invErr } = await supabase
    .from('user_inventory')
    .select(
      'id, product_id, quantity, status, owner_name, owner_email, source_warehouse_id, serial_number, notes'
    )
    .eq('id', params.inventoryId)
    .single()

  if (invErr || !inv) throw new Error(invErr?.message || 'Zimmet kaydı bulunamadı')
  if (inv.status !== 'active') throw new Error('Bu zimmet zaten aktif değil')

  const qty = Number(inv.quantity) || 0

  const { error: updErr } = await supabase
    .from('user_inventory')
    .update({
      status: 'returned',
      return_date: new Date().toISOString(),
      returned_quantity: qty,
      notes: [inv.notes, 'Zimmet kaldırıldı (stok depoda kaldı)'].filter(Boolean).join(' | '),
      updated_at: new Date().toISOString(),
    })
    .eq('id', inv.id)

  if (updErr) throw new Error('Zimmet kapatılamadı: ' + updErr.message)

  if (inv.source_warehouse_id) {
    await supabase.from('stock_movements').insert({
      product_id: inv.product_id,
      warehouse_id: inv.source_warehouse_id,
      movement_type: 'düzeltme',
      quantity: qty,
      reason: `Zimmet kaldırıldı: ${inv.owner_name || inv.owner_email || 'kullanıcı'} (depo stoğu değişmedi)`,
      created_by: actorId,
      serial_number: inv.serial_number,
    })
  }

  return { ok: true }
}

/** Zimmeti değiştir: eski kaydı kapat, yeni kişiye aç (depo stoğu aynı) */
export async function changeZimmetAssignment(params: {
  inventoryId: string
  newEmployee: EmployeeOption
}) {
  const supabase = createClient()
  const actorId = await getActorId()

  const { data: inv, error: invErr } = await supabase
    .from('user_inventory')
    .select('*')
    .eq('id', params.inventoryId)
    .single()

  if (invErr || !inv) throw new Error(invErr?.message || 'Zimmet kaydı bulunamadı')
  if (inv.status !== 'active') throw new Error('Bu zimmet zaten aktif değil')

  const oldName = inv.owner_name || 'eski zimmetli'
  const oldEmail = inv.owner_email || ''
  const newName = (params.newEmployee.first_name || '').trim() || 'Çalışan'
  const newEmail = (params.newEmployee.work_email || '').trim() || null
  const qty = Number(inv.quantity) || 0

  const { error: closeErr } = await supabase
    .from('user_inventory')
    .update({
      status: 'returned',
      return_date: new Date().toISOString(),
      returned_quantity: qty,
      notes: [
        inv.notes,
        `Zimmet değiştirildi → ${newName}${newEmail ? ` <${newEmail}>` : ''}`,
      ]
        .filter(Boolean)
        .join(' | '),
      updated_at: new Date().toISOString(),
    })
    .eq('id', inv.id)

  if (closeErr) throw new Error('Eski zimmet kapatılamadı: ' + closeErr.message)

  const { error: insertErr } = await supabase.from('user_inventory').insert({
    product_id: inv.product_id,
    item_name: inv.item_name,
    quantity: qty,
    unit: inv.unit || 'adet',
    assigned_date: new Date().toISOString(),
    assigned_by: actorId,
    status: 'active',
    notes: `Zimmet değişikliği: ${oldName}${oldEmail ? ` <${oldEmail}>` : ''} → ${newName}`,
    category: inv.category,
    consumed_quantity: 0,
    owner_name: newName,
    owner_email: newEmail,
    source_warehouse_id: inv.source_warehouse_id,
    serial_number: inv.serial_number,
  })

  if (insertErr) throw new Error('Yeni zimmet oluşturulamadı: ' + insertErr.message)

  if (inv.source_warehouse_id) {
    await supabase.from('stock_movements').insert({
      product_id: inv.product_id,
      warehouse_id: inv.source_warehouse_id,
      movement_type: 'düzeltme',
      quantity: qty,
      reason: `Zimmet değişikliği: ${oldName} → ${newName} (depo stoğu değişmedi)`,
      created_by: actorId,
    })
  }

  return { ok: true }
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
    serial_number: params.serialNumber || null,
  })

  if (invErr) throw new Error('Zimmet kaydı oluşturulamadı: ' + invErr.message)

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
