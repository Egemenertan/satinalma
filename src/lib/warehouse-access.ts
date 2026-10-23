import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/auth/session'

export const WAREHOUSE_ACCESS_SWR_KEY = 'warehouse_access_scope'

export type WarehouseAccessLevel = 'view' | 'manage' | 'operate'

export type WarehouseAccessRow = {
  id: string
  user_id: string
  email: string | null
  warehouse_id: string | null
  access_level: WarehouseAccessLevel
}

export type WarehouseAccessScope = {
  /** Tüm depoları yönetebilir (ürün düzenleme dahil) */
  canManageAll: boolean
  /** Ürün kataloğu ekleme/düzenleme */
  canManageProducts: boolean
  /** Erişilebilir depo id'leri; canManageAll ise boş olabilir (hepsi) */
  warehouseIds: string[]
  /** Stok işlemi yapılabilen depolar (manage veya operate) */
  manageWarehouseIds: string[]
  /** Ürün detayında düzeltme, zimmet ve transfer yapılabilen depolar */
  operateWarehouseIds: string[]
  /** Tek/çoklu depo ile sınırlı kullanıcı */
  isRestricted: boolean
  loaded: boolean
}

export const emptyWarehouseAccessScope = (): WarehouseAccessScope => ({
  canManageAll: false,
  canManageProducts: false,
  warehouseIds: [],
  manageWarehouseIds: [],
  operateWarehouseIds: [],
  isRestricted: true,
  loaded: false,
})

export const EMPTY_WAREHOUSE_ACCESS_SCOPE = emptyWarehouseAccessScope()

/**
 * Ürün/stok sayfaları için depo yetkisi.
 * Talep rolleri bu tablodan bağımsızdır.
 */
export async function fetchMyWarehouseAccessScope(): Promise<WarehouseAccessScope> {
  const supabase = createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return { ...emptyWarehouseAccessScope(), loaded: true }
  }

  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('warehouse_access')
      .select('id, user_id, email, warehouse_id, access_level')
      .eq('user_id', user.id),
  ])

  const roleElevated =
    profile?.role === 'admin' || profile?.role === 'manager'

  if (error) {
    console.error('warehouse_access okunamadı:', error)
    // Admin/manager her zaman manage-all sayılır
    if (roleElevated) {
      return {
        canManageAll: true,
        canManageProducts: true,
        warehouseIds: [],
        manageWarehouseIds: [],
        operateWarehouseIds: [],
        isRestricted: false,
        loaded: true,
      }
    }
    return { ...emptyWarehouseAccessScope(), loaded: true }
  }

  const accessRows = (rows || []) as WarehouseAccessRow[]
  const manageAll =
    roleElevated ||
    accessRows.some((r) => r.warehouse_id === null && r.access_level === 'manage')

  const warehouseIds = Array.from(
    new Set(
      accessRows
        .map((r) => r.warehouse_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )

  const depotPowerIds = (level: WarehouseAccessLevel) =>
    Array.from(
      new Set(
        accessRows
          .filter((r) => r.access_level === level)
          .map((r) => r.warehouse_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )

  const operateWarehouseIds = depotPowerIds('operate')
  const manageWarehouseIds = Array.from(
    new Set([...depotPowerIds('manage'), ...operateWarehouseIds])
  )

  return {
    canManageAll: manageAll,
    canManageProducts: manageAll,
    warehouseIds: manageAll ? [] : warehouseIds,
    manageWarehouseIds: manageAll ? [] : manageWarehouseIds,
    operateWarehouseIds: manageAll ? [] : operateWarehouseIds,
    isRestricted: !manageAll,
    loaded: true,
  }
}

export async function fetchWarehouseAccessForUser(
  userId: string
): Promise<WarehouseAccessRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('warehouse_access')
    .select('id, user_id, email, warehouse_id, access_level')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('warehouse_access (user) okunamadı:', error)
    return []
  }

  return (data || []) as WarehouseAccessRow[]
}

export async function replaceUserWarehouseAccess(params: {
  userId: string
  email?: string | null
  /** null warehouse = manage all */
  mode: 'manage_all' | 'warehouses'
  warehouseIds: string[]
  accessLevel?: WarehouseAccessLevel
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { userId, mode, warehouseIds, accessLevel = 'view' } = params

  let email = params.email?.trim() || null
  if (!email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
    email = profile?.email ?? null
  }

  const { error: deleteError } = await supabase
    .from('warehouse_access')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  if (mode === 'manage_all') {
    const { error } = await supabase.from('warehouse_access').insert({
      user_id: userId,
      email,
      warehouse_id: null,
      access_level: 'manage',
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const uniqueIds = Array.from(new Set(warehouseIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { ok: true }
  }

  const { error } = await supabase.from('warehouse_access').insert(
    uniqueIds.map((warehouse_id) => ({
      user_id: userId,
      email,
      warehouse_id,
      access_level: accessLevel,
    }))
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
