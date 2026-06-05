import type { SupabaseClient } from '@supabase/supabase-js'
import { SPECIAL_SITE_ID, GMO_SITE_ID } from './constants'
import {
  canSeeItWorkflowTab,
  isItWorkflowElevatedRole,
  isPazarlamaDepartment,
  IT_STATUS_ONAYLANDI,
} from './it-workflow'
import { resolveProfileSiteIds } from './profileSiteIds'
import {
  fetchPurchaseRequestIdsVisibleToItWarehouseManager,
  isProfileDepartmentIt,
} from './warehouse-it-material-filter'

export type ProfileRow = {
  role: string | null
  site_id: string | string[] | null
  department: string | null
  full_name?: string | null
  email?: string | null
  construction_site_id?: string | null
  deleted_at?: string | null
  is_active?: boolean | null
}

export type OrderListItem = {
  id: string
  material_item_id: string | null
  status: string | null
  quantity: number | null
  delivered_quantity: number | null
}

export type PurchaseRequestListRow = {
  id: string
  request_number: string | null
  title: string | null
  description?: string | null
  status: string | null
  urgency_level: string | null
  created_at: string
  delivery_date: string | null
  requested_by: string | null
  site_name: string | null
  site_id: string | null
  it_workflow_applies: boolean | null
  notifications?: string[] | null
  unordered_materials_count?: number
  overdue_deliveries_count?: number
  sites?: { name: string } | { name: string }[] | null
  profiles?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null
  orders?: OrderListItem[] | null
}

const BASE_STATUSES_PURCHASING = [
  'satın almaya gönderildi',
  'sipariş verildi',
  'eksik malzemeler talep edildi',
  'kısmen teslim alındı',
  'teslim alındı',
  'iade var',
  'iade nedeniyle sipariş',
  'ordered',
]

function formatRequestNumber(raw: string | null, id: string): string {
  if (!raw) return `REQ-${id.slice(-6)}`
  const parts = raw.split('-')
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    const secondLastPart = parts[parts.length - 2]
    const lastTwoChars = secondLastPart.slice(-2)
    return `${lastTwoChars}-${lastPart}`
  }
  return raw
}

/** Satınalma PurchaseRequestsTable fetchPurchaseRequests ile aynı rol / IT / siparişsiz / geciken mantığı. */
export async function fetchPurchaseRequestsPage(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  opts: {
    page: number
    pageSize: number
    listView: 'main' | 'it'
    statusFilter: string
    locationFilter: string
    searchTerm?: string
    unorderedOnly?: boolean
    overdueOnly?: boolean
    overdueRequestIds?: string[]
  }
): Promise<{ requests: PurchaseRequestListRow[]; totalCount: number }> {
  const {
    page,
    pageSize,
    listView,
    statusFilter,
    locationFilter,
    searchTerm,
    unorderedOnly,
    overdueOnly,
    overdueRequestIds = [],
  } = opts
  const effectiveRole = profile.role || 'user'

  if (listView === 'it' && !canSeeItWorkflowTab({ role: profile.role, department: profile.department })) {
    return { requests: [], totalCount: 0 }
  }

  const isItWarehouseManager = effectiveRole === 'warehouse_manager' && isProfileDepartmentIt(profile.department)
  const userDepartmentEarly = deptFilter(effectiveRole, profile, isItWarehouseManager)

  let itWarehouseScopedIds: string[] | null = null
  if (isItWarehouseManager) {
    itWarehouseScopedIds = await fetchPurchaseRequestIdsVisibleToItWarehouseManager(supabase)
    if (!itWarehouseScopedIds.length) {
      return { requests: [], totalCount: 0 }
    }
  }

  let mergedRequestIdFilter: string[] | null = itWarehouseScopedIds

  if (searchTerm?.trim()) {
    const t = searchTerm.trim().replace(/%/g, '\\%')
    const searchScope = [
      `request_number.ilike.%${t}%`,
      `title.ilike.%${t}%`,
      `description.ilike.%${t}%`,
    ].join(',')
    const { data: searchRows } = await supabase.from('purchase_requests').select('id').or(searchScope)
    const searchIds = [...new Set((searchRows ?? []).map((r) => r.id))]
    const { data: itemRows } = await supabase
      .from('purchase_request_items')
      .select('purchase_request_id')
      .ilike('item_name', `%${t}%`)
    for (const row of itemRows ?? []) {
      if (row.purchase_request_id && !searchIds.includes(row.purchase_request_id)) {
        searchIds.push(row.purchase_request_id)
      }
    }
    if (!searchIds.length) return { requests: [], totalCount: 0 }
    if (!mergedRequestIdFilter) mergedRequestIdFilter = searchIds
    else {
      const s = new Set(searchIds)
      mergedRequestIdFilter = mergedRequestIdFilter.filter((id) => s.has(id))
    }
    if (!mergedRequestIdFilter.length) return { requests: [], totalCount: 0 }
  }

  let unorderedRequestIds: string[] | null = null
  if (unorderedOnly && effectiveRole === 'purchasing_officer') {
    try {
      let tempQuery = supabase.from('purchase_requests').select('id')
      const userSiteIds = resolveProfileSiteIds(profile)
      if (userSiteIds.length > 0) {
        tempQuery = tempQuery.or(
          `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${BASE_STATUSES_PURCHASING.join(',')})),` +
            `and(site_id.eq.${SPECIAL_SITE_ID},status.in.(kısmen gönderildi,depoda mevcut değil)),` +
            `requested_by.eq.${userId}`
        )
      } else {
        tempQuery = tempQuery.eq('requested_by', userId)
      }
      if (userDepartmentEarly) tempQuery = tempQuery.eq('department', userDepartmentEarly)
      const { data: allRequests } = await tempQuery
      if (allRequests?.length) {
        const { data: unorderedData } = await supabase.rpc('get_unordered_materials_count', {
          request_ids: allRequests.map((r) => r.id),
        })
        const withUnordered =
          unorderedData?.filter((item: { unordered_count: number }) => item.unordered_count > 0).map(
            (item: { request_id: string }) => item.request_id
          ) ?? []
        unorderedRequestIds = withUnordered
        if (!withUnordered.length) return { requests: [], totalCount: 0 }
      } else return { requests: [], totalCount: 0 }
    } catch {
      unorderedRequestIds = []
    }
  }

  let overdueFilterIds: string[] | null = null
  if (overdueOnly) {
    if (!overdueRequestIds.length) {
      return { requests: [], totalCount: 0 }
    }
    overdueFilterIds = overdueRequestIds
  }

  if (unorderedRequestIds !== null) {
    if (!mergedRequestIdFilter) mergedRequestIdFilter = [...unorderedRequestIds]
    else {
      const u = new Set(unorderedRequestIds)
      mergedRequestIdFilter = mergedRequestIdFilter.filter((id) => u.has(id))
    }
    if (!mergedRequestIdFilter.length) return { requests: [], totalCount: 0 }
  }

  if (overdueFilterIds !== null) {
    if (!mergedRequestIdFilter) mergedRequestIdFilter = [...overdueFilterIds]
    else {
      const o = new Set(overdueFilterIds)
      mergedRequestIdFilter = mergedRequestIdFilter.filter((id) => o.has(id))
    }
    if (!mergedRequestIdFilter.length) return { requests: [], totalCount: 0 }
  }

  const selectFields = `
      id,
      request_number,
      title,
      description,
      status,
      urgency_level,
      created_at,
      delivery_date,
      requested_by,
      site_name,
      site_id,
      it_workflow_applies,
      notifications,
      sites:site_id ( name ),
      profiles:requested_by ( full_name, email )
    `

  if (listView === 'it') {
    return fetchItWorkflowList(supabase, userId, profile, effectiveRole, {
      page,
      pageSize,
      statusFilter,
      locationFilter,
      mergedRequestIdFilter,
      selectFields,
    })
  }

  let countQuery = supabase.from('purchase_requests').select('id', { count: 'exact', head: true })

  countQuery = applyRoleScope(countQuery, effectiveRole, userId, profile)

  const userDepartment = userDepartmentEarly
  if (userDepartment) countQuery = countQuery.eq('department', userDepartment)

  if (listView === 'main' && !isItWorkflowElevatedRole(effectiveRole)) {
    countQuery = countQuery.or(
      `requested_by.eq.${userId},it_workflow_applies.eq.false,and(it_workflow_applies.eq.true,status.not.in.(it_incelemesinde,it_onaylandi))`
    )
  }

  if (mergedRequestIdFilter) countQuery = countQuery.in('id', mergedRequestIdFilter)
  if (statusFilter && statusFilter !== 'all') countQuery = countQuery.eq('status', statusFilter)
  if (locationFilter && locationFilter !== 'all') countQuery = countQuery.eq('site_id', locationFilter)

  const { count, error: countError } = await countQuery
  if (countError) throw new Error(countError.message)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dataQuery = supabase
    .from('purchase_requests')
    .select(selectFields)
    .range(from, to)
    .order('created_at', { ascending: false })

  dataQuery = applyRoleScope(dataQuery, effectiveRole, userId, profile)
  if (userDepartment) dataQuery = dataQuery.eq('department', userDepartment)
  if (listView === 'main' && !isItWorkflowElevatedRole(effectiveRole)) {
    dataQuery = dataQuery.or(
      `requested_by.eq.${userId},it_workflow_applies.eq.false,and(it_workflow_applies.eq.true,status.not.in.(it_incelemesinde,it_onaylandi))`
    )
  }
  if (mergedRequestIdFilter) dataQuery = dataQuery.in('id', mergedRequestIdFilter)
  if (statusFilter && statusFilter !== 'all') dataQuery = dataQuery.eq('status', statusFilter)
  if (locationFilter && locationFilter !== 'all') dataQuery = dataQuery.eq('site_id', locationFilter)

  const { data: requests, error } = await dataQuery
  if (error) throw new Error(error.message)

  let formatted = (requests ?? []).map((r: Record<string, unknown>) => {
    let prof = r.profiles as PurchaseRequestListRow['profiles']
    if (Array.isArray(prof) && prof.length) prof = prof[0]
    let site = r.sites as PurchaseRequestListRow['sites']
    if (Array.isArray(site) && site.length) site = site[0]
    return {
      ...r,
      request_number: formatRequestNumber(r.request_number as string | null, r.id as string),
      sites: site,
      profiles: prof,
    } as PurchaseRequestListRow
  })

  formatted = await enrichListRows(supabase, formatted, effectiveRole, profile, overdueRequestIds)

  return { requests: formatted, totalCount: count ?? 0 }
}

async function enrichListRows(
  supabase: SupabaseClient,
  rows: PurchaseRequestListRow[],
  effectiveRole: string,
  profile: ProfileRow,
  overdueRequestIds: string[]
): Promise<PurchaseRequestListRow[]> {
  const ids = rows.map((r) => r.id)

  // "Sipariş verildi" statusundaki talepler için orders'ı ayrı query ile çek
  const orderedRequestIds = rows.filter((r) => r.status === 'sipariş verildi').map((r) => r.id)
  if (orderedRequestIds.length > 0) {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, purchase_request_id, material_item_id, status, quantity, delivered_quantity')
        .in('purchase_request_id', orderedRequestIds)

      if (!ordersError && ordersData) {
        const ordersMap: Record<string, OrderListItem[]> = {}
        ordersData.forEach((o) => {
          const reqId = o.purchase_request_id
          if (!reqId) return
          if (!ordersMap[reqId]) ordersMap[reqId] = []
          ordersMap[reqId].push({
            id: o.id,
            material_item_id: o.material_item_id,
            status: o.status,
            quantity: o.quantity,
            delivered_quantity: o.delivered_quantity,
          })
        })
        rows = rows.map((r) => ({
          ...r,
          orders: r.status === 'sipariş verildi' ? ordersMap[r.id] ?? [] : undefined,
        }))
      }
    } catch {
      /* ignore - non-critical */
    }
  }

  if (effectiveRole === 'purchasing_officer' && ids.length > 0) {
    try {
      const { data } = await supabase.rpc('get_unordered_materials_count', { request_ids: ids })
      const map: Record<string, number> = {}
      data?.forEach((row: { request_id: string; unordered_count: number }) => {
        map[row.request_id] = row.unordered_count || 0
      })
      rows = rows.map((r) => ({ ...r, unordered_materials_count: map[r.id] || 0 }))
    } catch {
      /* ignore */
    }
  }
  if (
    (effectiveRole === 'santiye_depo' ||
      effectiveRole === 'santiye_depo_yonetici' ||
      effectiveRole === 'site_manager') &&
    ids.length > 0 &&
    overdueRequestIds.length > 0
  ) {
    try {
      const userSiteIds = resolveProfileSiteIds(profile)
      if (userSiteIds.length > 0) {
        const { data: overdueData } = await supabase.rpc('get_overdue_deliveries_count', {
          user_site_ids: userSiteIds,
        })
        const map: Record<string, number> = {}
        overdueData?.forEach((item: { request_id: string; overdue_orders_count: number }) => {
          map[item.request_id] = item.overdue_orders_count || 0
        })
        rows = rows.map((r) => ({ ...r, overdue_deliveries_count: map[r.id] || 0 }))
      }
    } catch {
      /* ignore */
    }
  }
  return rows
}

function deptFilter(role: string, profile: ProfileRow, isItWM: boolean): string | null {
  if (role === 'department_head') return null
  if (isItWorkflowElevatedRole(role)) return null
  if (profile.department && !isItWM) return profile.department
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyRoleScope(query: any, effectiveRole: string, userId: string, profile: ProfileRow): any {
  const userSiteIds = resolveProfileSiteIds(profile)

  if (isItWorkflowElevatedRole(effectiveRole)) {
    return query
  }

  if (effectiveRole === 'purchasing_officer') {
    if (userSiteIds.length > 0) {
      return query.or(
        `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${BASE_STATUSES_PURCHASING.join(',')})),` +
          `and(site_id.eq.${SPECIAL_SITE_ID},status.in.(kısmen gönderildi,depoda mevcut değil)),` +
          `requested_by.eq.${userId}`
      )
    }
    return query.eq('requested_by', userId)
  }
  if (effectiveRole === 'site_personnel') {
    return query.eq('requested_by', userId)
  }
  if (effectiveRole === 'department_head') {
    // Department head: Kendi oluşturduğu tüm talepler + GMO departman talepleri
    const headDepartment = profile.department || 'Genel'
    return query.or(
      `requested_by.eq.${userId},` +
      `and(site_id.eq.${GMO_SITE_ID},department.eq.${headDepartment})`
    )
  }
  if (effectiveRole === 'warehouse_manager') {
    return query.neq('status', 'departman_onayı_bekliyor')
  }
  if (effectiveRole === 'santiye_depo') {
    if (userSiteIds.length > 0) {
      return query.in('site_id', userSiteIds).neq('status', 'onay_bekliyor')
    }
    return query
  }
  if (userSiteIds.length > 0) {
    return query.in('site_id', userSiteIds)
  }
  return query
}

async function fetchItWorkflowList(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  effectiveRole: string,
  opts: {
    page: number
    pageSize: number
    statusFilter: string
    locationFilter: string
    mergedRequestIdFilter: string[] | null
    selectFields: string
  }
): Promise<{ requests: PurchaseRequestListRow[]; totalCount: number }> {
  const { page, pageSize, statusFilter, locationFilter, mergedRequestIdFilter, selectFields } = opts

  let itCountQuery = supabase
    .from('purchase_requests')
    .select('id', { count: 'exact', head: true })
    .eq('it_workflow_applies', true)

  if (effectiveRole === 'site_manager' && isPazarlamaDepartment(profile.department)) {
    itCountQuery = itCountQuery.in('status', [IT_STATUS_ONAYLANDI, 'satın almaya gönderildi'])
  }
  if (mergedRequestIdFilter) itCountQuery = itCountQuery.in('id', mergedRequestIdFilter)
  if (statusFilter && statusFilter !== 'all') itCountQuery = itCountQuery.eq('status', statusFilter)
  if (locationFilter && locationFilter !== 'all') itCountQuery = itCountQuery.eq('site_id', locationFilter)

  const { count, error: itCountError } = await itCountQuery
  if (itCountError) throw new Error(itCountError.message)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let itDataQuery = supabase
    .from('purchase_requests')
    .select(selectFields)
    .eq('it_workflow_applies', true)
    .range(from, to)
    .order('created_at', { ascending: false })

  if (effectiveRole === 'site_manager' && isPazarlamaDepartment(profile.department)) {
    itDataQuery = itDataQuery.in('status', [IT_STATUS_ONAYLANDI, 'satın almaya gönderildi'])
  }
  if (mergedRequestIdFilter) itDataQuery = itDataQuery.in('id', mergedRequestIdFilter)
  if (statusFilter && statusFilter !== 'all') itDataQuery = itDataQuery.eq('status', statusFilter)
  if (locationFilter && locationFilter !== 'all') itDataQuery = itDataQuery.eq('site_id', locationFilter)

  const { data: itRequests, error: itReqError } = await itDataQuery
  if (itReqError) throw new Error(itReqError.message)

  const itRows = (itRequests ?? []) as unknown as Record<string, unknown>[]
  let formatted = itRows.map((r) => {
    let prof = r.profiles as PurchaseRequestListRow['profiles']
    if (Array.isArray(prof) && prof.length) prof = prof[0]
    let site = r.sites as PurchaseRequestListRow['sites']
    if (Array.isArray(site) && site.length) site = site[0]
    return {
      ...r,
      request_number: formatRequestNumber(r.request_number as string | null, r.id as string),
      sites: site,
      profiles: prof,
    } as PurchaseRequestListRow
  })

  formatted = await enrichListRows(supabase, formatted, effectiveRole, profile, [])

  void userId
  return { requests: formatted, totalCount: count ?? 0 }
}
