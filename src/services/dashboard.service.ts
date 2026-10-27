/**
 * Dashboard özet verisi — tek istekte KPI + günlük seri + son talepler
 */

import { format, subDays } from 'date-fns'
import { tr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { ensureFreshSession, isAuthExpiredError } from '@/lib/auth/session'

export interface DashboardDailyPoint {
  dayKey: string
  label: string
  requests: number
  amount: number
}

export interface DashboardStats {
  totalRequests: number
  requestGrowth: number
  pendingRequests: number
  totalSuppliers: number
  totalSites: number
  totalAmount: number
  amountGrowth: number
}

export interface DashboardRecentRequest {
  id: string
  request_number?: string | null
  title: string
  status: string
  created_at: string
  total_amount: number
  site_name?: string
  requester_name?: string | null
  department?: string | null
  urgency_level?: string | null
  item_count?: number
}

export interface DashboardBundle {
  stats: DashboardStats
  dailyPoints: DashboardDailyPoint[]
  recentRequests: DashboardRecentRequest[]
}

function isPendingStatus(status: string | null | undefined): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return (
    s === 'pending' ||
    s === 'onay bekliyor' ||
    s === 'awaiting_offers' ||
    s === 'draft'
  )
}

const PENDING_STATUSES = ['pending', 'onay bekliyor', 'awaiting_offers', 'draft']

function startOfPreviousMonth(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
}

export async function fetchDashboardBundle(): Promise<DashboardBundle> {
  const supabase = createClient()
  const session = await ensureFreshSession(supabase)
  if (!session) {
    throw new Error('Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.')
  }
  const now = new Date()
  const seriesFrom = startOfPreviousMonth(now)

  const [
    totalCountRes,
    pendingCountRes,
    amountSumRes,
    seriesRes,
    suppliersCountRes,
    sitesCountRes,
    recentRes,
  ] = await Promise.all([
    supabase.from('purchase_requests').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('purchase_requests')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .in('status', PENDING_STATUSES),
    supabase
      .from('purchase_requests')
      .select('total_amount.sum()')
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('purchase_requests')
      .select('created_at, total_amount, status')
      .is('deleted_at', null)
      .gte('created_at', seriesFrom),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }),
    supabase.from('sites').select('id', { count: 'exact', head: true }),
    supabase
      .from('purchase_requests')
      .select(
        `
      id,
      request_number,
      title,
      status,
      created_at,
      total_amount,
      department,
      urgency_level,
      sites(name),
      profiles!purchase_requests_requested_by_fkey(full_name),
      purchase_request_items(count)
    `
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const queryError = seriesRes.error || recentRes.error
  if (queryError) {
    if (isAuthExpiredError(queryError)) {
      throw new Error('Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.')
    }
    throw queryError
  }

  const requests = seriesRes.data ?? []
  const totalRequests = totalCountRes.count ?? requests.length
  const pendingRequests = pendingCountRes.count ?? requests.filter(r => isPendingStatus(r.status)).length
  const totalSuppliers = suppliersCountRes.error ? 0 : suppliersCountRes.count ?? 0
  const totalSites = sitesCountRes.error ? 0 : sitesCountRes.count ?? 0
  const aggregatedSum = Number(
    (amountSumRes.data as { sum?: number; total_amount?: number } | null)?.sum ??
      (amountSumRes.data as { sum?: number; total_amount?: number } | null)?.total_amount ??
      NaN
  )
  const totalAmount = Number.isFinite(aggregatedSum)
    ? aggregatedSum
    : requests.reduce((sum, req) => sum + (parseFloat(String(req.total_amount)) || 0), 0)

  const currentMonth = now.getMonth()
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const currentYear = now.getFullYear()
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

  const currentMonthRequests = requests.filter(r => {
    const date = new Date(r.created_at)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })

  const lastMonthRequests = requests.filter(r => {
    const date = new Date(r.created_at)
    return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
  })

  const requestGrowth =
    lastMonthRequests.length > 0
      ? ((currentMonthRequests.length - lastMonthRequests.length) / lastMonthRequests.length) * 100
      : 0

  const currentMonthAmount = currentMonthRequests.reduce(
    (sum, req) => sum + (parseFloat(String(req.total_amount)) || 0),
    0
  )
  const lastMonthAmount = lastMonthRequests.reduce(
    (sum, req) => sum + (parseFloat(String(req.total_amount)) || 0),
    0
  )

  const amountGrowth =
    lastMonthAmount > 0 ? ((currentMonthAmount - lastMonthAmount) / lastMonthAmount) * 100 : 0

  const stats: DashboardStats = {
    totalRequests,
    requestGrowth: Math.round(requestGrowth * 10) / 10,
    pendingRequests,
    totalSuppliers,
    totalSites,
    totalAmount,
    amountGrowth: Math.round(amountGrowth * 10) / 10,
  }

  const dailyPoints: DashboardDailyPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const day = subDays(now, i)
    const dayKey = format(day, 'yyyy-MM-dd')
    const label = format(day, 'd MMM', { locale: tr })

    const dayRequests = requests.filter(r => {
      const reqDate = new Date(r.created_at)
      const dk = format(reqDate, 'yyyy-MM-dd')
      return dk === dayKey
    })

    const amount = dayRequests.reduce((sum, req) => sum + (parseFloat(String(req.total_amount)) || 0), 0)

    dailyPoints.push({
      dayKey,
      label,
      requests: dayRequests.length,
      amount,
    })
  }

  const recentRequests: DashboardRecentRequest[] = (recentRes.data ?? []).map((req: any) => ({
    id: req.id,
    request_number: req.request_number ?? null,
    title: req.title,
    status: req.status,
    created_at: req.created_at,
    total_amount: parseFloat(String(req.total_amount)) || 0,
    site_name: req.sites?.name ?? '—',
    requester_name: req.profiles?.full_name ?? null,
    department: req.department ?? null,
    urgency_level: req.urgency_level ?? null,
    item_count: Array.isArray(req.purchase_request_items) ? req.purchase_request_items[0]?.count ?? 0 : 0,
  }))

  return { stats, dailyPoints, recentRequests }
}
