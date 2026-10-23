import { SPECIAL_SITE_ID } from '@/lib/constants'
import { departmentsMatch, IT_WORKFLOW_STATUSES } from '@/lib/it-workflow'
import {
  getActivityRoleLabel,
  type RequestActivityItem,
} from '@/lib/request-activity'

export type ProcessStepStatus = 'done' | 'current' | 'upcoming' | 'rejected' | 'skipped'

export type ProcessWorkflowKind =
  | 'site_warehouse'
  | 'gmo_department_head'
  | 'gmo_personnel'
  | 'it'
  | 'direct_to_purchasing'
  | 'generic'

export type ProcessPerson = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  department: string | null
}

export type ProcessRequestInput = {
  id: string
  title: string | null
  request_number: string | null
  status: string | null
  site_id: string | null
  site_name: string | null
  department: string | null
  created_at: string | null
  total_amount: number | null
  it_workflow_applies: boolean | null
  requester: ProcessPerson | null
}

export type ProcessAssignees = {
  warehouseManagers: ProcessPerson[]
  siteManagers: ProcessPerson[]
  siteWarehouseLeads: ProcessPerson[]
  departmentHeads: ProcessPerson[]
}

export type RequestProcessStep = {
  id: string
  title: string
  roleLabel: string
  assigneeName: string
  status: ProcessStepStatus
  completedAt?: string | null
}

export type RequestProcessModel = {
  request: ProcessRequestInput
  workflowKind: ProcessWorkflowKind
  steps: RequestProcessStep[]
  currentStepIndex: number
  nextStep: RequestProcessStep | null
  followingStep: RequestProcessStep | null
  isComplete: boolean
  isRejected: boolean
  warehouseFulfilled: boolean
}

export const SENT_TO_PURCHASING_STATUSES = new Set([
  'satın almaya gönderildi',
  'sipariş verildi',
  'teklif bekliyor',
  'eksik malzemeler talep edildi',
  'kısmen teslim alındı',
  'teslim alındı',
  'iade var',
  'iade nedeniyle sipariş',
  'ordered',
])

const WAREHOUSE_FULFILLED_STATUSES = new Set(['onaylandı', 'gönderildi'])

/** Depo yalnızca bu statuslarda "gönder / depoda yok" ile talep statusünü değiştirebilir. */
const WAREHOUSE_DEPOT_ACTION_STATUSES = new Set([
  'pending',
  'onay_bekliyor',
  'awaiting_offers',
  'kısmen gönderildi',
  'depoda mevcut değil',
  'ana depoda yok',
  'bekliyor',
  'beklemede',
])

const PURCHASING_STEP_IDS = new Set([
  'sent_to_purchasing',
  'site_manager_send',
  'unit_supervisor_send',
  'approval',
])

export function isWarehouseFulfilledStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return WAREHOUSE_FULFILLED_STATUSES.has(status.toLowerCase())
}

const REJECTED_STATUSES = new Set(['reddedildi', 'rejected', 'cancelled', 'iptal'])

export function isSentToPurchasingStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return SENT_TO_PURCHASING_STATUSES.has(status.toLowerCase())
}

export function isWarehouseDepotActionAllowed(status: string | null | undefined): boolean {
  if (!status) return false
  return WAREHOUSE_DEPOT_ACTION_STATUSES.has(status.toLowerCase())
}

export function isRejectedStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return REJECTED_STATUSES.has(status.toLowerCase())
}

export function formatPersonName(person: ProcessPerson | null | undefined): string {
  if (!person) return 'Atanacak kişi bekleniyor'
  const name = person.full_name?.trim()
  if (name) return name
  const email = person.email?.trim()
  if (email) return email.split('@')[0]
  return 'Atanacak kişi bekleniyor'
}

export function formatPeopleNames(people: ProcessPerson[]): string {
  if (people.length === 0) return 'Atanacak kişi bekleniyor'
  const names = people.map((person) => formatPersonName(person)).filter((name) => name !== 'Atanacak kişi bekleniyor')
  return names.length > 0 ? names.join(', ') : 'Atanacak kişi bekleniyor'
}

export function pickByDepartment(people: ProcessPerson[], department: string | null | undefined): ProcessPerson[] {
  const requestDepartment = department?.trim()
  if (!requestDepartment) return people
  const matched = people.filter((person) => {
    const personDepartment = person.department?.trim()
    if (!personDepartment) return false
    return departmentsMatch(personDepartment, requestDepartment)
  })
  return matched.length > 0 ? matched : people
}

export function inferWorkflowKind(request: ProcessRequestInput): ProcessWorkflowKind {
  const status = (request.status || '').toLowerCase()
  const requesterRole = request.requester?.role || ''
  const isGmo = request.site_id === SPECIAL_SITE_ID
  const itStatuses = IT_WORKFLOW_STATUSES as readonly string[]

  if (request.it_workflow_applies || itStatuses.includes(status)) {
    return 'it'
  }

  if (
    requesterRole === 'santiye_depo_yonetici' ||
    (requesterRole === 'purchasing_officer' && isSentToPurchasingStatus(status))
  ) {
    return isSentToPurchasingStatus(status) ? 'direct_to_purchasing' : 'site_warehouse'
  }

  if (requesterRole === 'santiye_depo' || requesterRole === 'santiye_depo_siparis' || status === 'depoda mevcut değil') {
    return 'site_warehouse'
  }

  if (requesterRole === 'department_head' && isGmo) {
    return 'gmo_department_head'
  }

  if ((requesterRole === 'site_personnel' || status === 'departman_onayı_bekliyor') && isGmo) {
    return 'gmo_personnel'
  }

  if (isSentToPurchasingStatus(status) && requesterRole !== 'department_head') {
    return 'direct_to_purchasing'
  }

  if (isGmo) {
    return requesterRole === 'department_head' ? 'gmo_department_head' : 'gmo_personnel'
  }

  return 'generic'
}

function commentsInclude(comments: string | null | undefined, needles: string[]): boolean {
  if (!comments) return false
  const value = comments.toLowerCase()
  return needles.some((needle) => value.includes(needle))
}

function historyForStep(stepId: string, history: RequestActivityItem[]): RequestActivityItem | undefined {
  const chronological = [...history].reverse()

  if (stepId === 'created') {
    return history.find((item) => item.action === 'submitted') || history[0]
  }

  if (stepId === 'department_approval') {
    return chronological.find(
      (item) =>
        item.action === 'approved' &&
        commentsInclude(item.comments, ['departman'])
    )
  }

  if (stepId === 'it_review') {
    return chronological.find(
      (item) =>
        item.action !== 'submitted' &&
        commentsInclude(item.comments, ['it yönetim onayı', 'it onay'])
    )
  }

  if (stepId === 'warehouse_check') {
    return chronological.find(
      (item) =>
        item.actorRole === 'Depo Yöneticisi' ||
        commentsInclude(item.comments, ['ana depoda', 'depoda mevcut', 'depo kontrol'])
    )
  }

  if (stepId === 'site_manager_send' || stepId === 'unit_supervisor_send' || stepId === 'sent_to_purchasing') {
    return chronological.find((item) =>
      commentsInclude(item.comments, ['satın almaya gönderildi', 'satin almaya gonderildi'])
    )
  }

  return undefined
}

function buildTemplate(
  kind: ProcessWorkflowKind,
  request: ProcessRequestInput,
  assignees: ProcessAssignees
): Array<Omit<RequestProcessStep, 'status'>> {
  const requesterName = formatPersonName(request.requester)
  const requesterRole = getActivityRoleLabel(request.requester?.role) || 'Talep eden'
  const siteManagers = pickByDepartment(assignees.siteManagers, request.department)
  const departmentHeads = pickByDepartment(assignees.departmentHeads, request.department)
  const warehouseNames = formatPeopleNames(assignees.warehouseManagers)
  const siteManagerNames = formatPeopleNames(siteManagers.length > 0 ? siteManagers : assignees.siteWarehouseLeads)
  const departmentHeadNames = formatPeopleNames(departmentHeads)

  const created = {
    id: 'created',
    title: 'Talep oluşturuldu',
    roleLabel: requesterRole,
    assigneeName: requesterName,
  }

  const sent = {
    id: 'sent_to_purchasing',
    title: 'Satın almaya gönderildi',
    roleLabel: 'Satın Alma',
    assigneeName: 'Satın alma ekibi',
  }

  if (kind === 'site_warehouse') {
    return [
      created,
      {
        id: 'site_manager_send',
        title: 'Satın almaya gönderme',
        roleLabel: 'Şantiye Yöneticisi',
        assigneeName: siteManagerNames,
      },
      sent,
    ]
  }

  if (kind === 'gmo_department_head') {
    return [
      created,
      {
        id: 'warehouse_check',
        title: 'Depo kontrolü',
        roleLabel: 'Depo Yöneticisi',
        assigneeName: warehouseNames,
      },
      {
        id: 'unit_supervisor_send',
        title: 'Satın almaya gönderme',
        roleLabel: 'Birim Amiri',
        assigneeName: siteManagerNames,
      },
      sent,
    ]
  }

  if (kind === 'gmo_personnel') {
    return [
      created,
      {
        id: 'department_approval',
        title: 'Departman onayı',
        roleLabel: 'Departman Yöneticisi',
        assigneeName: departmentHeadNames,
      },
      {
        id: 'warehouse_check',
        title: 'Depo kontrolü',
        roleLabel: 'Depo Yöneticisi',
        assigneeName: warehouseNames,
      },
      {
        id: 'unit_supervisor_send',
        title: 'Satın almaya gönderme',
        roleLabel: 'Birim Amiri',
        assigneeName: siteManagerNames,
      },
      sent,
    ]
  }

  if (kind === 'it') {
    return [
      created,
      {
        id: 'it_review',
        title: 'IT incelemesi',
        roleLabel: 'IT Yönetim',
        assigneeName: departmentHeadNames === 'Atanacak kişi bekleniyor' ? 'IT ekibi' : departmentHeadNames,
      },
      {
        id: 'site_manager_send',
        title: 'Satın almaya gönderme',
        roleLabel: 'Şantiye Yöneticisi',
        assigneeName: siteManagerNames,
      },
      sent,
    ]
  }

  if (kind === 'direct_to_purchasing') {
    return [created, sent]
  }

  return [
    created,
    {
      id: 'approval',
      title: 'Onay',
      roleLabel: 'Sorumlu yönetici',
      assigneeName: siteManagerNames,
    },
    sent,
  ]
}

function statusMarksStepDone(stepId: string, status: string, warehouseFulfilled: boolean): boolean {
  if (stepId === 'created') return true
  if (stepId === 'warehouse_shipped') return warehouseFulfilled
  if (isSentToPurchasingStatus(status) || warehouseFulfilled) {
    if (stepId === 'sent_to_purchasing') return isSentToPurchasingStatus(status)
    if (stepId === 'site_manager_send' || stepId === 'unit_supervisor_send') {
      return isSentToPurchasingStatus(status)
    }
    return true
  }

  switch (stepId) {
    case 'department_approval':
      return status !== 'departman_onayı_bekliyor'
    case 'it_review':
      return status === 'it_onaylandi' || status === 'ana depoda yok' || status === 'depoda mevcut değil'
    case 'warehouse_check':
      return status === 'ana depoda yok' || status === 'onaylandı'
    case 'site_manager_send':
    case 'unit_supervisor_send':
    case 'approval':
    case 'sent_to_purchasing':
      return false
    default:
      return false
  }
}

export function buildRequestProcess(
  request: ProcessRequestInput,
  assignees: ProcessAssignees,
  history: RequestActivityItem[]
): RequestProcessModel {
  const status = (request.status || '').toLowerCase()
  const workflowKind = inferWorkflowKind(request)
  const isRejected = isRejectedStatus(status) || history.some((item) => item.action === 'rejected')
  const isComplete = isSentToPurchasingStatus(status)
  const warehouseFulfilled = isWarehouseFulfilledStatus(status) && !isComplete

  let template = buildTemplate(workflowKind, request, assignees)

  if (warehouseFulfilled) {
    template = template.filter((step) => !PURCHASING_STEP_IDS.has(step.id))
    if (!template.some((step) => step.id === 'warehouse_shipped')) {
      template.push({
        id: 'warehouse_shipped',
        title: status === 'gönderildi' ? 'Ana depoda mevcut' : 'Depodan karşılandı',
        roleLabel: 'Depo',
        assigneeName: formatPeopleNames(assignees.warehouseManagers),
      })
    }
  }

  const steps: RequestProcessStep[] = template.map((step) => {
    const historyItem = historyForStep(step.id, history)
    const doneByStatus = statusMarksStepDone(step.id, status, warehouseFulfilled)
    const doneByHistory = Boolean(historyItem) && step.id !== 'created' ? true : step.id === 'created'

    let stepStatus: ProcessStepStatus = 'upcoming'
    if (step.id === 'sent_to_purchasing') {
      stepStatus = isComplete ? 'done' : warehouseFulfilled ? 'skipped' : 'upcoming'
    } else if (step.id === 'site_manager_send' || step.id === 'unit_supervisor_send') {
      if (warehouseFulfilled && !isComplete) stepStatus = 'skipped'
      else if (isComplete || doneByStatus) stepStatus = 'done'
    } else if (isComplete || doneByStatus || (step.id === 'created' && doneByHistory)) {
      stepStatus = 'done'
    } else if (historyItem && step.id !== 'created') {
      stepStatus = 'done'
    }

    const useHistoryActor = step.id === 'created' || (stepStatus === 'done' && Boolean(historyItem))

    return {
      ...step,
      assigneeName: useHistoryActor ? historyItem?.actorName || step.assigneeName : step.assigneeName,
      roleLabel: useHistoryActor ? historyItem?.actorRole || step.roleLabel : step.roleLabel,
      status: stepStatus,
      completedAt: useHistoryActor
        ? historyItem?.createdAt ?? (step.id === 'created' ? request.created_at : null)
        : null,
    }
  })

  let currentStepIndex = steps.findIndex((step) => step.status === 'upcoming')
  if (isComplete) {
    currentStepIndex = steps.length - 1
    steps.forEach((step, index) => {
      if (step.status !== 'skipped') {
        steps[index] = { ...step, status: 'done' }
      }
    })
  } else if (isRejected) {
    const lastDone = [...steps].map((step, index) => ({ step, index })).reverse().find((entry) => entry.step.status === 'done')
    currentStepIndex = lastDone ? Math.min(lastDone.index + 1, steps.length - 1) : 0
    if (steps[currentStepIndex]) {
      steps[currentStepIndex] = { ...steps[currentStepIndex], status: 'rejected' }
    }
  } else if (currentStepIndex === -1) {
    currentStepIndex = steps.findIndex((step) => step.status === 'skipped')
    if (currentStepIndex === -1) currentStepIndex = steps.length - 1
  } else if (steps[currentStepIndex]) {
    steps[currentStepIndex] = { ...steps[currentStepIndex], status: 'current' }
  }

  const actionable = steps.find((step) => step.status === 'current') || null
  const following = steps.find((step) => step.status === 'upcoming') || null

  return {
    request,
    workflowKind,
    steps,
    currentStepIndex,
    nextStep: actionable || following,
    followingStep: actionable ? following : null,
    isComplete,
    isRejected,
    warehouseFulfilled,
  }
}
