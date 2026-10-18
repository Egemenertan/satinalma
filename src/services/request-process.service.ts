import { createClient } from '@/lib/supabase/client'
import {
  mapApprovalHistoryToActivity,
  type RequestActivityRow,
} from '@/lib/request-activity'
import {
  buildRequestProcess,
  type ProcessAssignees,
  type ProcessPerson,
  type ProcessRequestInput,
  type RequestProcessModel,
} from '@/lib/request-process'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  department: string | null
}

function toPerson(row: ProfileRow | null | undefined): ProcessPerson | null {
  if (!row?.id) return null
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    department: row.department,
  }
}

function unwrapProfile(value: unknown): ProfileRow | null {
  if (!value) return null
  if (Array.isArray(value)) return (value[0] as ProfileRow) ?? null
  return value as ProfileRow
}

async function fetchPeopleByRole(
  supabase: ReturnType<typeof createClient>,
  role: string,
  siteId?: string | null
): Promise<ProcessPerson[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, department')
    .eq('role', role)
    .eq('is_active', true)

  if (siteId) {
    query = query.contains('site_id', [siteId])
  }

  const { data, error } = await query
  if (error) {
    console.error(`request-process ${role} query:`, error)
    return []
  }

  return (data || []).map((row) => toPerson(row as ProfileRow)).filter((person): person is ProcessPerson => Boolean(person))
}

export async function fetchRequestProcess(requestId: string): Promise<RequestProcessModel> {
  const supabase = createClient()

  const { data: requestRow, error: requestError } = await supabase
    .from('purchase_requests')
    .select(
      `
      id,
      title,
      request_number,
      status,
      site_id,
      site_name,
      department,
      created_at,
      total_amount,
      it_workflow_applies,
      requested_by,
      profiles!purchase_requests_requested_by_fkey (
        id,
        full_name,
        email,
        role,
        department
      ),
      sites (name)
    `
    )
    .eq('id', requestId)
    .is('deleted_at', null)
    .single()

  if (requestError) throw requestError
  if (!requestRow) throw new Error('Talep bulunamadı')

  const requester = toPerson(unwrapProfile(requestRow.profiles))
  const site = Array.isArray(requestRow.sites) ? requestRow.sites[0] : requestRow.sites

  const request: ProcessRequestInput = {
    id: requestRow.id,
    title: requestRow.title,
    request_number: requestRow.request_number,
    status: requestRow.status,
    site_id: requestRow.site_id,
    site_name: requestRow.site_name || site?.name || null,
    department: requestRow.department,
    created_at: requestRow.created_at,
    total_amount: requestRow.total_amount != null ? Number(requestRow.total_amount) : null,
    it_workflow_applies: requestRow.it_workflow_applies,
    requester,
  }

  const [historyResult, warehouseManagers, siteManagers, siteWarehouseLeads, departmentHeads] = await Promise.all([
    supabase
      .from('approval_history')
      .select(
        `
        id,
        action,
        comments,
        created_at,
        performed_by,
        profiles:performed_by (
          full_name,
          email,
          role
        )
      `
      )
      .eq('purchase_request_id', requestId)
      .order('created_at', { ascending: true }),
    fetchPeopleByRole(supabase, 'warehouse_manager'),
    request.site_id ? fetchPeopleByRole(supabase, 'site_manager', request.site_id) : Promise.resolve([]),
    request.site_id ? fetchPeopleByRole(supabase, 'santiye_depo_yonetici', request.site_id) : Promise.resolve([]),
    fetchPeopleByRole(supabase, 'department_head', request.site_id),
  ])

  if (historyResult.error) {
    console.error('request-process history query:', historyResult.error)
  }

  const assignees: ProcessAssignees = {
    warehouseManagers,
    siteManagers,
    siteWarehouseLeads,
    departmentHeads,
  }

  const history = mapApprovalHistoryToActivity((historyResult.data || []) as unknown as RequestActivityRow[])
  return buildRequestProcess(request, assignees, history)
}
