/**
 * Web dashboard/requests/page.tsx fetchWeeklyActivity + fetchPageData ile aynı veri.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { GMO_SITE_ID } from './constants'
import { canSeeItWorkflowTab, isItWorkflowElevatedRole, isPazarlamaDepartment, IT_STATUS_INCELEMEDE, IT_STATUS_ONAYLANDI } from './it-workflow'
import { resolveProfileSiteIds } from './profileSiteIds'
import type { ProfileRow } from './purchaseRequestsQuery'
import {
  isProfileDepartmentIt,
  fetchPurchaseRequestIdsVisibleToItWarehouseManager,
} from './warehouse-it-material-filter'

export type MonthlyDatum = { month: string; count: number }
export type ActivityDatum = { date: string; count: number }

export type RequestsPageData = {
  userInfo: { displayName: string; email?: string | null }
  role: string
  canSeeItWorkflowTab: boolean
  itWorkflowAttentionCount: number
  stats: {
    total: number
    pending: number
    approved: number
    urgent: number
    thisMonth: number
    monthlyData: MonthlyDatum[]
    monthChange: number
  }
  pendingOrdersCount: number
  overdueDeliveriesCount: number
  overdueRequestIds: string[]
  siteId: ProfileRow['site_id']
  weeklyActivity: ActivityDatum[]
  mobileActivity: ActivityDatum[]
}

async function fetchWeeklyActivity(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  isMobile: boolean,
  siteId?: string | string[],
  department?: string,
  wmItScopedIds?: string[]
): Promise<ActivityDatum[]> {
  const days = isMobile ? 10 : 30
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)

  let query = supabase.from('purchase_requests').select('created_at, id').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString())

  if (role === 'site_personnel') {
    query = query.eq('requested_by', userId)
  } else if (role === 'purchasing_officer') {
    const userSiteIds = Array.isArray(siteId) ? siteId : siteId ? [siteId] : []
    if (userSiteIds.length > 0) {
      query = query.or(`requested_by.eq.${userId},site_id.in.(${userSiteIds.join(',')})`)
    } else {
      query = query.eq('requested_by', userId)
    }
  } else if (role === 'santiye_depo' || role === 'santiye_depo_yonetici' || role === 'site_manager') {
    const userSiteIds = Array.isArray(siteId) ? siteId : siteId ? [siteId] : []
    if (userSiteIds.length > 0) query = query.in('site_id', userSiteIds)
  } else if (role === 'department_head') {
    const userDepartment = department || 'Genel'
    query = query.eq('site_id', GMO_SITE_ID).eq('department', userDepartment)
  } else if (role === 'warehouse_manager') {
    query = query.neq('status', 'departman_onayı_bekliyor')
    if (wmItScopedIds !== undefined) {
      if (wmItScopedIds.length === 0) return []
      query = query.in('id', wmItScopedIds)
    }
  }

  if (
    role !== 'department_head' &&
    department &&
    !(role === 'warehouse_manager' && isProfileDepartmentIt(department)) &&
    !isItWorkflowElevatedRole(role)
  ) {
    query = query.eq('department', department)
  }

  const { data: requests, error } = await query
  if (error) return []

  const dailyCounts: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateKey = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
    dailyCounts[dateKey] = 0
  }

  requests?.forEach((request) => {
    const requestDate = new Date(request.created_at)
    const dateKey = requestDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
    if (Object.prototype.hasOwnProperty.call(dailyCounts, dateKey)) {
      dailyCounts[dateKey]++
    }
  })

  return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
}

const PO_STATS_STATUSES = [
  'satın almaya gönderildi',
  'sipariş verildi',
  'teklif bekliyor',
  'onaylandı',
  'eksik malzemeler talep edildi',
  'kısmen teslim alındı',
  'teslim alındı',
  'iade var',
  'iade nedeniyle sipariş',
  'ordered',
] as const

async function fetchMonthlyBucket(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileRow,
  wmItScopedIds: string[] | undefined,
  profileSiteIds: string[],
  monthsBack: number
): Promise<MonthlyDatum> {
  const monthStart = new Date()
  monthStart.setMonth(monthStart.getMonth() - monthsBack)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1)

  let monthQuery = supabase
    .from('purchase_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString())

  if (profile.role === 'site_personnel') {
    monthQuery = monthQuery.eq('requested_by', userId)
  } else if (profile.role === 'department_head') {
    const userDepartment = profile.department || 'Genel'
    monthQuery = monthQuery.eq('site_id', GMO_SITE_ID).eq('department', userDepartment)
  } else if (profile.role === 'purchasing_officer') {
    if (profileSiteIds.length > 0) {
      monthQuery = monthQuery.or(
        `and(site_id.in.(${profileSiteIds.join(',')}),status.in.(${PO_STATS_STATUSES.join(',')})),` +
          `requested_by.eq.${userId}`
      )
    } else {
      monthQuery = monthQuery.eq('requested_by', userId)
    }
  } else if (profile.role === 'warehouse_manager') {
    monthQuery = monthQuery.neq('status', 'departman_onayı_bekliyor')
  } else if (
    profile.role === 'santiye_depo' ||
    profile.role === 'santiye_depo_yonetici' ||
    profile.role === 'site_manager'
  ) {
    if (profileSiteIds.length > 0) monthQuery = monthQuery.in('site_id', profileSiteIds)
  }

  const skipDeptMonthly =
    profile.role === 'warehouse_manager' && isProfileDepartmentIt(profile.department)
  if (
    profile.role !== 'department_head' &&
    profile.department &&
    !skipDeptMonthly &&
    !isItWorkflowElevatedRole(profile.role)
  ) {
    monthQuery = monthQuery.eq('department', profile.department)
  }

  if (wmItScopedIds !== undefined) {
    if (wmItScopedIds.length === 0) {
      monthQuery = monthQuery.eq('id', '00000000-0000-4000-a000-000000000003')
    } else {
      monthQuery = monthQuery.in('id', wmItScopedIds)
    }
  }

  const { count: mc, error } = await monthQuery
  if (error) {
    return { month: monthStart.toLocaleDateString('tr-TR', { month: 'short' }), count: 0 }
  }
  return {
    month: monthStart.toLocaleDateString('tr-TR', { month: 'short' }),
    count: mc || 0,
  }
}

async function fetchOverdueDeliveriesSnapshot(
  supabase: SupabaseClient,
  profile: ProfileRow,
  profileSiteIds: string[]
): Promise<{ overdueDeliveriesCount: number; overdueRequestIds: string[] }> {
  if (
    profile.role !== 'site_manager' &&
    profile.role !== 'santiye_depo' &&
    profile.role !== 'santiye_depo_yonetici'
  ) {
    return { overdueDeliveriesCount: 0, overdueRequestIds: [] }
  }
  if (profileSiteIds.length === 0) return { overdueDeliveriesCount: 0, overdueRequestIds: [] }
  try {
    const { data: overdueData } = await supabase.rpc('get_overdue_deliveries_count', {
      user_site_ids: profileSiteIds,
    })
    return {
      overdueDeliveriesCount: overdueData?.length || 0,
      overdueRequestIds: overdueData?.map((item: { request_id: string }) => item.request_id) || [],
    }
  } catch {
    return { overdueDeliveriesCount: 0, overdueRequestIds: [] }
  }
}

async function fetchItWorkflowAttentionSnapshot(supabase: SupabaseClient, profile: ProfileRow): Promise<number> {
  if (!canSeeItWorkflowTab({ role: profile.role, department: profile.department })) return 0
  try {
    let itAttnQuery = supabase
      .from('purchase_requests')
      .select('id', { count: 'exact', head: true })
      .eq('it_workflow_applies', true)

    if (profile.role === 'site_manager' && isPazarlamaDepartment(profile.department)) {
      itAttnQuery = itAttnQuery.eq('status', IT_STATUS_ONAYLANDI)
    } else {
      itAttnQuery = itAttnQuery.in('status', [IT_STATUS_INCELEMEDE, IT_STATUS_ONAYLANDI])
    }

    const { count: itAttnCount } = await itAttnQuery
    return itAttnCount ?? 0
  } catch {
    return 0
  }
}

export async function fetchRequestsPageData(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileRow | null
): Promise<RequestsPageData> {
  if (!profile) {
    return {
      userInfo: { displayName: 'Kullanıcı', email: '' },
      role: '',
      canSeeItWorkflowTab: false,
      itWorkflowAttentionCount: 0,
      stats: { total: 0, pending: 0, approved: 0, urgent: 0, thisMonth: 0, monthlyData: [], monthChange: 0 },
      pendingOrdersCount: 0,
      overdueDeliveriesCount: 0,
      overdueRequestIds: [],
      siteId: null,
      weeklyActivity: [],
      mobileActivity: [],
    }
  }

  let displayName = profile.full_name
  if (!displayName || displayName.trim() === '') {
    if (profile.email) {
      displayName = profile.email
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    } else {
      displayName = 'Kullanıcı'
    }
  }

  let wmItScopedIds: string[] | undefined
  if (profile.role === 'warehouse_manager' && isProfileDepartmentIt(profile.department)) {
    wmItScopedIds = await fetchPurchaseRequestIdsVisibleToItWarehouseManager(supabase)
  }

  const profileSiteIds = resolveProfileSiteIds(profile)
  const siteIdParam = profileSiteIds.length > 0 ? profileSiteIds : undefined

  let statsQuery = supabase.from('purchase_requests').select('status, urgency_level, id, site_id', { count: 'exact' })

  if (profile.role === 'site_personnel') {
    statsQuery = statsQuery.eq('requested_by', userId)
  } else if (profile.role === 'department_head') {
    const userDepartment = profile.department || 'Genel'
    statsQuery = statsQuery.eq('site_id', GMO_SITE_ID).eq('department', userDepartment)
  } else if (profile.role === 'purchasing_officer') {
    if (profileSiteIds.length > 0) {
      statsQuery = statsQuery.or(
        `and(site_id.in.(${profileSiteIds.join(',')}),status.in.(${PO_STATS_STATUSES.join(',')})),` +
          `requested_by.eq.${userId}`
      )
    } else {
      statsQuery = statsQuery.eq('requested_by', userId)
    }
  } else if (profile.role === 'warehouse_manager') {
    statsQuery = statsQuery.neq('status', 'departman_onayı_bekliyor')
  } else if (
    profile.role === 'santiye_depo' ||
    profile.role === 'santiye_depo_yonetici' ||
    profile.role === 'site_manager'
  ) {
    if (profileSiteIds.length > 0) statsQuery = statsQuery.in('site_id', profileSiteIds)
  }

  const skipDeptFilterItWm =
    profile.role === 'warehouse_manager' && isProfileDepartmentIt(profile.department)

  if (
    profile.role !== 'department_head' &&
    profile.department &&
    !skipDeptFilterItWm &&
    !isItWorkflowElevatedRole(profile.role)
  ) {
    statsQuery = statsQuery.eq('department', profile.department)
  }

  if (wmItScopedIds !== undefined) {
    if (wmItScopedIds.length === 0) {
      statsQuery = statsQuery.eq('id', '00000000-0000-4000-a000-000000000003')
    } else {
      statsQuery = statsQuery.in('id', wmItScopedIds)
    }
  }

  const monthlyPromises = Array.from({ length: 6 }, (_, li) =>
    fetchMonthlyBucket(supabase, userId, profile, wmItScopedIds, profileSiteIds, 5 - li)
  )

  const [
    weeklyActivity,
    mobileActivity,
    statsResult,
    monthlyData,
    overdueBlock,
    itWorkflowAttentionCount,
  ] = await Promise.all([
    fetchWeeklyActivity(
      supabase,
      userId,
      profile.role || '',
      false,
      siteIdParam,
      profile.department ?? undefined,
      wmItScopedIds
    ),
    fetchWeeklyActivity(
      supabase,
      userId,
      profile.role || '',
      true,
      siteIdParam,
      profile.department ?? undefined,
      wmItScopedIds
    ),
    statsQuery,
    Promise.all(monthlyPromises),
    fetchOverdueDeliveriesSnapshot(supabase, profile, profileSiteIds),
    fetchItWorkflowAttentionSnapshot(supabase, profile),
  ])

  const { data: requests, error, count } = statsResult

  const thisMonthCount = monthlyData[5]?.count || 0
  const lastMonthCount = monthlyData[4]?.count || 0
  const monthChange =
    lastMonthCount > 0 ? ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100 : 0

  if (error) {
    return {
      userInfo: { displayName, email: profile.email },
      role: profile.role || '',
      canSeeItWorkflowTab: canSeeItWorkflowTab({ role: profile.role, department: profile.department }),
      itWorkflowAttentionCount,
      stats: {
        total: 0,
        pending: 0,
        approved: 0,
        urgent: 0,
        thisMonth: thisMonthCount,
        monthlyData,
        monthChange: Math.round(monthChange * 10) / 10,
      },
      pendingOrdersCount: 0,
      overdueDeliveriesCount: overdueBlock.overdueDeliveriesCount,
      overdueRequestIds: overdueBlock.overdueRequestIds,
      siteId: profile.site_id,
      weeklyActivity,
      mobileActivity,
    }
  }

  const stats = {
    total: count || 0,
    pending:
      requests?.filter((r) => r.status === 'pending' || r.status === 'onay bekliyor' || r.status === 'onay_bekliyor')
        .length || 0,
    approved:
      requests?.filter((r) =>
        ['onaylandı', 'sipariş verildi', 'gönderildi', 'teslim alındı'].includes(r.status as string)
      ).length || 0,
    urgent:
      requests?.filter((r) => r.urgency_level === 'critical' || r.urgency_level === 'high').length || 0,
    thisMonth: thisMonthCount || 0,
    monthlyData,
    monthChange: Math.round(monthChange * 10) / 10,
  }

  let pendingOrdersCount = 0
  if (profile.role === 'purchasing_officer' && requests && requests.length > 0) {
    try {
      const requestIds = requests.map((r) => r.id)
      const { data: unorderedData } = await supabase.rpc('get_unordered_materials_count', {
        request_ids: requestIds,
      })
      pendingOrdersCount = unorderedData?.filter((item: { unordered_count: number }) => item.unordered_count > 0).length || 0
    } catch {
      /* ignore */
    }
  }

  return {
    userInfo: { displayName, email: profile.email },
    role: profile.role || '',
    canSeeItWorkflowTab: canSeeItWorkflowTab({ role: profile.role, department: profile.department }),
    itWorkflowAttentionCount,
    stats,
    pendingOrdersCount,
    overdueDeliveriesCount: overdueBlock.overdueDeliveriesCount,
    overdueRequestIds: overdueBlock.overdueRequestIds,
    siteId: profile.site_id,
    weeklyActivity,
    mobileActivity,
  }
}
