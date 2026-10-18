import { NextRequest, NextResponse } from 'next/server'
import { requireReportsAdmin, type ReportsSupabase } from '@/lib/reports/requireAdmin'
import { fetchAllRows, fetchInChunks } from '@/lib/reports/fetchAll'
import { resolveReportDateRange } from '@/lib/reports/departmentSpending'
import {
  ROLE_REPORT_OPTIONS,
  average,
  buildSlaBuckets,
  commentsIndicateDepartmentApproval,
  commentsIndicatePurchasingSend,
  commentsIndicateWarehouseAction,
  getRoleMetricCopy,
  isReportRole,
  median,
  minutesBetween,
  personLabel,
  resolveSentToPurchasingAt,
  roleMeta,
  type RolePerformanceCase,
  type RolePerformanceReport,
  type RolePerformanceUser,
} from '@/lib/reports/rolePerformance'
import { getRoleDescription, getRoleLabel } from '@/lib/roles'
import type { UserRole } from '@/lib/types'
import { titleCaseTr } from '@/lib/reports/titleCase'
import { SENT_TO_PURCHASING_STATUSES } from '@/lib/request-process'

export const dynamic = 'force-dynamic'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  department: string | null
  role: string | null
  is_active: boolean | null
}

type RequestRow = {
  id: string
  request_number: string | null
  status: string | null
  site_name: string | null
  department: string | null
  created_at: string | null
  purchasing_assignment_date: string | null
  assigned_to_purchasing: string | null
  requested_by: string
}

type HistoryRow = {
  id: string
  action: string
  comments: string | null
  created_at: string | null
  performed_by: string
  purchase_request_id: string
}

type OrderRow = {
  id: string
  purchase_request_id: string
  user_id: string | null
  created_at: string
  delivery_confirmed_by: string | null
  delivery_confirmed_at: string | null
  received_by: string | null
}

type ShipmentRow = {
  id: string
  purchase_request_id: string
  shipped_by: string
  shipped_at: string | null
  created_at: string | null
}

type InvoiceGroupRow = {
  id: string
  created_by: string | null
  created_at: string
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))]
}

function emptyUser(profile: ProfileRow): RolePerformanceUser {
  return {
    userId: profile.id,
    fullName: personLabel(profile.full_name, profile.email),
    email: profile.email,
    department: profile.department ? titleCaseTr(profile.department) : null,
    isActive: profile.is_active !== false,
    requestCreatedCount: 0,
    approvalCount: 0,
    rejectionCount: 0,
    sentToPurchasingCount: 0,
    orderCount: 0,
    invoiceGroupCount: 0,
    shipmentCount: 0,
    deliveryConfirmCount: 0,
    completedCaseCount: 0,
    pendingCaseCount: 0,
    avgMinutes: null,
    medianMinutes: null,
    lastActionAt: null,
  }
}

function touchLastAction(user: RolePerformanceUser, iso: string | null | undefined) {
  if (!iso) return
  if (!user.lastActionAt || new Date(iso).getTime() > new Date(user.lastActionAt).getTime()) {
    user.lastActionAt = iso
  }
}

function historyMatchesRole(role: UserRole, row: HistoryRow): boolean {
  const action = (row.action || '').toLowerCase()
  if (role === 'purchasing_officer') return commentsIndicatePurchasingSend(row.comments)
  if (role === 'site_manager') {
    return action === 'approved' || action === 'rejected' || commentsIndicatePurchasingSend(row.comments)
  }
  if (role === 'department_head') {
    return commentsIndicateDepartmentApproval(row.comments) || action === 'approved' || action === 'rejected'
  }
  if (role === 'warehouse_manager' || role === 'santiye_depo' || role === 'santiye_depo_yonetici') {
    return commentsIndicateWarehouseAction(row.comments) || commentsIndicatePurchasingSend(row.comments)
  }
  return action === 'approved' || action === 'rejected' || action === 'submitted'
}

function caseMetricLabel(role: UserRole, pending: boolean): string {
  if (role === 'purchasing_officer') {
    return pending ? 'Sipariş Bekliyor' : 'İlk Sipariş'
  }
  if (role === 'site_personnel') return pending ? 'Teslim Bekliyor' : 'Teslim Onayı'
  if (role === 'santiye_depo') return pending ? 'Sevkiyat Bekliyor' : 'Sevkiyat'
  return pending ? 'İşlem Bekliyor' : 'İlk İşlem'
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireReportsAdmin()
    if ('error' in auth && auth.error) return auth.error
    const supabase = (auth as { supabase: ReportsSupabase }).supabase

    const sp = request.nextUrl.searchParams
    if (sp.get('meta') === 'roles') {
      return NextResponse.json({
        roles: ROLE_REPORT_OPTIONS.map((value) => ({
          value,
          label: titleCaseTr(getRoleLabel(value)),
          description: titleCaseTr(getRoleDescription(value)),
        })),
      })
    }

    const roleParam = (sp.get('role') || 'purchasing_officer').trim()
    if (!isReportRole(roleParam)) {
      return NextResponse.json({ error: titleCaseTr('Geçersiz Rol') }, { status: 400 })
    }
    const role = roleParam
    const userId = sp.get('userId')?.trim() || null
    const { dateFrom, dateTo } = resolveReportDateRange({
      month: sp.get('month'),
      dateFrom: sp.get('dateFrom'),
      dateTo: sp.get('dateTo'),
    })

    const roleProfiles = await fetchAllRows<ProfileRow>((from, to) =>
      supabase
        .from('profiles')
        .select('id, full_name, email, department, role, is_active')
        .eq('role', role)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
        .range(from, to)
    )

    const roleUserIds = new Set(roleProfiles.map((p) => p.id))
    if (userId && !roleUserIds.has(userId)) {
      return NextResponse.json({
        error: titleCaseTr('Seçilen Kullanıcı Bu Rolde Değil'),
      }, { status: 400 })
    }

    const scopedUserIds = userId ? [userId] : [...roleUserIds]

    const [histories, orders, shipments, invoiceGroups, createdRequests] = await Promise.all([
      scopedUserIds.length === 0
        ? Promise.resolve([] as HistoryRow[])
        : fetchInChunks<HistoryRow>(scopedUserIds, (chunk) =>
            supabase
              .from('approval_history')
              .select('id, action, comments, created_at, performed_by, purchase_request_id')
              .in('performed_by', chunk)
              .gte('created_at', dateFrom)
              .lte('created_at', dateTo)
          ),
      role === 'purchasing_officer' || role === 'admin' || role === 'manager'
        ? fetchAllRows<OrderRow>((from, to) => {
            let q = supabase
              .from('orders')
              .select(
                'id, purchase_request_id, user_id, created_at, delivery_confirmed_by, delivery_confirmed_at, received_by'
              )
              .gte('created_at', dateFrom)
              .lte('created_at', dateTo)
              .order('created_at', { ascending: true })
              .range(from, to)
            if (userId) q = q.eq('user_id', userId)
            return q
          })
        : Promise.resolve([] as OrderRow[]),
      role === 'santiye_depo' ||
      role === 'santiye_depo_yonetici' ||
      role === 'warehouse_manager' ||
      role === 'site_personnel'
        ? scopedUserIds.length === 0
          ? Promise.resolve([] as ShipmentRow[])
          : fetchInChunks<ShipmentRow>(scopedUserIds, (chunk) =>
              supabase
                .from('shipments')
                .select('id, purchase_request_id, shipped_by, shipped_at, created_at')
                .in('shipped_by', chunk)
                .gte('created_at', dateFrom)
                .lte('created_at', dateTo)
            )
        : Promise.resolve([] as ShipmentRow[]),
      role === 'purchasing_officer' || role === 'admin' || role === 'manager'
        ? fetchAllRows<InvoiceGroupRow>((from, to) => {
            let q = supabase
              .from('invoice_groups')
              .select('id, created_by, created_at')
              .gte('created_at', dateFrom)
              .lte('created_at', dateTo)
              .order('created_at', { ascending: false })
              .range(from, to)
            if (userId) q = q.eq('created_by', userId)
            return q
          })
        : Promise.resolve([] as InvoiceGroupRow[]),
      scopedUserIds.length === 0
        ? Promise.resolve([] as RequestRow[])
        : fetchInChunks<RequestRow>(scopedUserIds, (chunk) =>
            supabase
              .from('purchase_requests')
              .select(
                'id, request_number, status, site_name, department, created_at, purchasing_assignment_date, assigned_to_purchasing, requested_by'
              )
              .in('requested_by', chunk)
              .is('deleted_at', null)
              .gte('created_at', dateFrom)
              .lte('created_at', dateTo)
          ),
    ])

    const deliveryOrders =
      role === 'site_personnel'
        ? await fetchAllRows<OrderRow>((from, to) => {
            let q = supabase
              .from('orders')
              .select(
                'id, purchase_request_id, user_id, created_at, delivery_confirmed_by, delivery_confirmed_at, received_by'
              )
              .gte('delivery_confirmed_at', dateFrom)
              .lte('delivery_confirmed_at', dateTo)
              .not('delivery_confirmed_at', 'is', null)
              .order('delivery_confirmed_at', { ascending: false })
              .range(from, to)
            if (userId) q = q.eq('delivery_confirmed_by', userId)
            return q
          })
        : []

    const extraRequestIds = new Set<string>()
    if (role === 'purchasing_officer') {
      const [assignedRequests, updatedRequests] = await Promise.all([
        fetchAllRows<RequestRow>((from, to) =>
          supabase
            .from('purchase_requests')
            .select(
              'id, request_number, status, site_name, department, created_at, purchasing_assignment_date, assigned_to_purchasing, requested_by'
            )
            .is('deleted_at', null)
            .gte('purchasing_assignment_date', dateFrom)
            .lte('purchasing_assignment_date', dateTo)
            .order('created_at', { ascending: false })
            .range(from, to)
        ),
        fetchAllRows<RequestRow>((from, to) =>
          supabase
            .from('purchase_requests')
            .select(
              'id, request_number, status, site_name, department, created_at, purchasing_assignment_date, assigned_to_purchasing, requested_by'
            )
            .is('deleted_at', null)
            .in('status', [...SENT_TO_PURCHASING_STATUSES])
            .gte('updated_at', dateFrom)
            .lte('updated_at', dateTo)
            .order('created_at', { ascending: false })
            .range(from, to)
        ),
      ])
      for (const row of [...assignedRequests, ...updatedRequests]) extraRequestIds.add(row.id)
    }

    const requestIds = uniqueIds([
      ...histories.map((row) => row.purchase_request_id),
      ...orders.map((row) => row.purchase_request_id),
      ...shipments.map((row) => row.purchase_request_id),
      ...createdRequests.map((row) => row.id),
      ...deliveryOrders.map((row) => row.purchase_request_id),
      ...extraRequestIds,
    ])

    const requests = await fetchInChunks<RequestRow>(requestIds, (chunk) =>
      supabase
        .from('purchase_requests')
        .select(
          'id, request_number, status, site_name, department, created_at, purchasing_assignment_date, assigned_to_purchasing, requested_by'
        )
        .in('id', chunk)
        .is('deleted_at', null)
    )
    const requestById = new Map(requests.map((row) => [row.id, row]))

    const requestHistory = await fetchInChunks<HistoryRow>(requestIds, (chunk) =>
      supabase
        .from('approval_history')
        .select('id, action, comments, created_at, performed_by, purchase_request_id')
        .in('purchase_request_id', chunk)
        .order('created_at', { ascending: true })
    )
    const historyByRequest = new Map<string, HistoryRow[]>()
    for (const row of requestHistory) {
      const list = historyByRequest.get(row.purchase_request_id) || []
      list.push(row)
      historyByRequest.set(row.purchase_request_id, list)
    }

    const requestOrders =
      role === 'purchasing_officer' || role === 'site_personnel'
        ? await fetchInChunks<OrderRow>(requestIds, (chunk) =>
            supabase
              .from('orders')
              .select(
                'id, purchase_request_id, user_id, created_at, delivery_confirmed_by, delivery_confirmed_at, received_by'
              )
              .in('purchase_request_id', chunk)
              .order('created_at', { ascending: true })
          )
        : orders
    const firstOrderByRequest = new Map<string, OrderRow>()
    for (const order of requestOrders) {
      if (!firstOrderByRequest.has(order.purchase_request_id)) {
        firstOrderByRequest.set(order.purchase_request_id, order)
      }
    }

    const extraProfileIds = uniqueIds([
      ...roleProfiles.map((p) => p.id),
      ...orders.map((o) => o.user_id),
      ...invoiceGroups.map((g) => g.created_by),
      ...requestOrders.map((o) => o.user_id),
      ...requestOrders.map((o) => o.delivery_confirmed_by),
      ...requests.map((r) => r.assigned_to_purchasing),
      ...histories.map((h) => h.performed_by),
    ])
    const extraProfiles = await fetchInChunks<ProfileRow>(extraProfileIds, (chunk) =>
      supabase
        .from('profiles')
        .select('id, full_name, email, department, role, is_active')
        .in('id', chunk)
    )
    const profileById = new Map<string, ProfileRow>()
    for (const profile of [...roleProfiles, ...extraProfiles]) {
      profileById.set(profile.id, profile)
    }

    const users = new Map<string, RolePerformanceUser>()
    for (const profile of roleProfiles) {
      if (userId && profile.id !== userId) continue
      users.set(profile.id, emptyUser(profile))
    }

    const ensureUser = (id: string | null | undefined): RolePerformanceUser | null => {
      if (!id || (userId && id !== userId) || !roleUserIds.has(id)) return null
      const existing = users.get(id)
      if (existing) return existing
      const profile = profileById.get(id)
      if (!profile) return null
      const created = emptyUser(profile)
      users.set(id, created)
      return created
    }

    for (const row of createdRequests) {
      const user = ensureUser(row.requested_by)
      if (!user) continue
      user.requestCreatedCount += 1
      touchLastAction(user, row.created_at)
    }

    for (const row of histories) {
      const user = ensureUser(row.performed_by)
      if (!user) continue
      const action = (row.action || '').toLowerCase()
      if (action === 'approved') user.approvalCount += 1
      if (action === 'rejected') user.rejectionCount += 1
      if (commentsIndicatePurchasingSend(row.comments)) user.sentToPurchasingCount += 1
      touchLastAction(user, row.created_at)
    }

    for (const row of orders) {
      const user = ensureUser(row.user_id)
      if (!user) continue
      user.orderCount += 1
      touchLastAction(user, row.created_at)
    }

    for (const row of invoiceGroups) {
      const user = ensureUser(row.created_by)
      if (!user) continue
      user.invoiceGroupCount += 1
      touchLastAction(user, row.created_at)
    }

    for (const row of shipments) {
      const user = ensureUser(row.shipped_by)
      if (!user) continue
      user.shipmentCount += 1
      touchLastAction(user, row.shipped_at || row.created_at)
    }

    for (const row of deliveryOrders) {
      const user = ensureUser(row.delivery_confirmed_by)
      if (!user) continue
      user.deliveryConfirmCount += 1
      touchLastAction(user, row.delivery_confirmed_at)
    }

    const cases: RolePerformanceCase[] = []
    const userMinutes = new Map<string, number[]>()

    const pushCase = (entry: RolePerformanceCase) => {
      cases.push(entry)
      if (entry.actorId && entry.minutes != null) {
        const list = userMinutes.get(entry.actorId) || []
        list.push(entry.minutes)
        userMinutes.set(entry.actorId, list)
      }
      if (entry.actorId) {
        const user = ensureUser(entry.actorId)
        if (user) {
          if (entry.minutes == null) user.pendingCaseCount += 1
          else user.completedCaseCount += 1
        }
      }
    }

    if (role === 'purchasing_officer') {
      for (const req of requests) {
        const sentAt = resolveSentToPurchasingAt({
          createdAt: req.created_at,
          purchasingAssignmentDate: req.purchasing_assignment_date,
          status: req.status,
          history: historyByRequest.get(req.id) || [],
        })
        if (!sentAt) continue
        const sentMs = new Date(sentAt).getTime()
        if (sentMs < new Date(dateFrom).getTime() || sentMs > new Date(dateTo).getTime()) {
          const firstOrder = firstOrderByRequest.get(req.id)
          if (!firstOrder) continue
          const orderMs = new Date(firstOrder.created_at).getTime()
          if (orderMs < new Date(dateFrom).getTime() || orderMs > new Date(dateTo).getTime()) continue
        }

        const firstOrder = firstOrderByRequest.get(req.id)
        const actorId = firstOrder?.user_id || req.assigned_to_purchasing || null
        if (userId && actorId !== userId && firstOrder?.user_id !== userId) continue
        const actor = actorId ? profileById.get(actorId) : null
        const pending = !firstOrder
        pushCase({
          requestId: req.id,
          requestNumber: req.request_number || req.id.slice(0, 8),
          siteName: req.site_name ? titleCaseTr(req.site_name) : null,
          department: req.department ? titleCaseTr(req.department) : null,
          status: req.status ? titleCaseTr(req.status) : null,
          actorId: actor && roleUserIds.has(actor.id) ? actor.id : actorId,
          actorName: actor
            ? personLabel(actor.full_name, actor.email)
            : titleCaseTr('Atanmamış'),
          startAt: sentAt,
          actionAt: firstOrder?.created_at || null,
          minutes: minutesBetween(sentAt, firstOrder?.created_at),
          metricLabel: caseMetricLabel(role, pending),
        })
      }
    } else if (role === 'site_personnel') {
      for (const req of createdRequests) {
        if (userId && req.requested_by !== userId) continue
        const actor = profileById.get(req.requested_by)
        const deliveries = deliveryOrders.filter((row) => row.purchase_request_id === req.id)
        const firstDelivery = deliveries[0]
        pushCase({
          requestId: req.id,
          requestNumber: req.request_number || req.id.slice(0, 8),
          siteName: req.site_name ? titleCaseTr(req.site_name) : null,
          department: req.department ? titleCaseTr(req.department) : null,
          status: req.status ? titleCaseTr(req.status) : null,
          actorId: req.requested_by,
          actorName: actor ? personLabel(actor.full_name, actor.email) : titleCaseTr('İsimsiz Kullanıcı'),
          startAt: req.created_at,
          actionAt: firstDelivery?.delivery_confirmed_at || null,
          minutes: minutesBetween(req.created_at, firstDelivery?.delivery_confirmed_at),
          metricLabel: caseMetricLabel(role, !firstDelivery),
        })
      }
    } else {
      const seen = new Set<string>()
      for (const row of histories) {
        if (!historyMatchesRole(role, row)) continue
        const req = requestById.get(row.purchase_request_id)
        if (!req) continue
        const key = `${row.performed_by}:${req.id}`
        if (seen.has(key)) continue
        seen.add(key)
        const actor = profileById.get(row.performed_by)
        pushCase({
          requestId: req.id,
          requestNumber: req.request_number || req.id.slice(0, 8),
          siteName: req.site_name ? titleCaseTr(req.site_name) : null,
          department: req.department ? titleCaseTr(req.department) : null,
          status: req.status ? titleCaseTr(req.status) : null,
          actorId: row.performed_by,
          actorName: actor ? personLabel(actor.full_name, actor.email) : titleCaseTr('İsimsiz Kullanıcı'),
          startAt: req.created_at,
          actionAt: row.created_at,
          minutes: minutesBetween(req.created_at, row.created_at),
          metricLabel: caseMetricLabel(role, false),
        })
      }

      if (role === 'santiye_depo' || role === 'warehouse_manager') {
        for (const row of shipments) {
          const req = requestById.get(row.purchase_request_id)
          if (!req) continue
          const key = `${row.shipped_by}:${req.id}:ship`
          if (seen.has(key)) continue
          seen.add(key)
          const actor = profileById.get(row.shipped_by)
          pushCase({
            requestId: req.id,
            requestNumber: req.request_number || req.id.slice(0, 8),
            siteName: req.site_name ? titleCaseTr(req.site_name) : null,
            department: req.department ? titleCaseTr(req.department) : null,
            status: req.status ? titleCaseTr(req.status) : null,
            actorId: row.shipped_by,
            actorName: actor ? personLabel(actor.full_name, actor.email) : titleCaseTr('İsimsiz Kullanıcı'),
            startAt: req.created_at,
            actionAt: row.shipped_at || row.created_at,
            minutes: minutesBetween(req.created_at, row.shipped_at || row.created_at),
            metricLabel: caseMetricLabel(role, false),
          })
        }
      }
    }

    for (const [id, user] of users) {
      const values = userMinutes.get(id) || []
      user.avgMinutes = average(values)
      user.medianMinutes = median(values)
    }

    const completedMinutes = cases.map((row) => row.minutes).filter((value): value is number => value != null)
    const userList = [...users.values()].sort((a, b) => {
      const aScore = a.orderCount + a.approvalCount + a.requestCreatedCount + a.shipmentCount
      const bScore = b.orderCount + b.approvalCount + b.requestCreatedCount + b.shipmentCount
      if (bScore !== aScore) return bScore - aScore
      return a.fullName.localeCompare(b.fullName, 'tr')
    })

    const meta = roleMeta(role)
    const copy = getRoleMetricCopy(role)
    const actionCount = userList.reduce(
      (sum, user) =>
        sum +
        user.approvalCount +
        user.rejectionCount +
        user.orderCount +
        user.shipmentCount +
        user.invoiceGroupCount +
        user.requestCreatedCount +
        user.deliveryConfirmCount,
      0
    )

    const report: RolePerformanceReport = {
      filters: { role, userId, dateFrom, dateTo },
      roleLabel: meta.roleLabel,
      roleDescription: meta.roleDescription,
      metricTitle: titleCaseTr(copy.title),
      metricHint: titleCaseTr(copy.hint),
      summary: {
        userCount: userList.length,
        actionCount,
        caseCount: cases.length,
        completedCaseCount: cases.filter((row) => row.minutes != null).length,
        pendingCaseCount: cases.filter((row) => row.minutes == null).length,
        avgMinutes: average(completedMinutes),
        medianMinutes: median(completedMinutes),
        orderCount: userList.reduce((sum, user) => sum + user.orderCount, 0),
        approvalCount: userList.reduce((sum, user) => sum + user.approvalCount, 0),
        rejectionCount: userList.reduce((sum, user) => sum + user.rejectionCount, 0),
        requestCreatedCount: userList.reduce((sum, user) => sum + user.requestCreatedCount, 0),
        shipmentCount: userList.reduce((sum, user) => sum + user.shipmentCount, 0),
        invoiceGroupCount: userList.reduce((sum, user) => sum + user.invoiceGroupCount, 0),
      },
      slaBuckets: buildSlaBuckets(cases.map((row) => row.minutes)),
      users: userList,
      cases: cases
        .sort((a, b) => {
          const aTime = new Date(a.actionAt || a.startAt || 0).getTime()
          const bTime = new Date(b.actionAt || b.startAt || 0).getTime()
          return bTime - aTime
        })
        .slice(0, 250),
    }

    return NextResponse.json(report)
  } catch (error: any) {
    console.error('role-performance report error:', error)
    return NextResponse.json(
      { error: error?.message || titleCaseTr('Rapor Oluşturulamadı') },
      { status: 500 }
    )
  }
}
