import { IT_WORKFLOW_STATUSES, isPazarlamaDepartment } from './it-workflow'

/** Web edit sayfası canEditByRole + IT workflow dallanması */
export function canEditPurchaseRequest(
  status: string,
  userRole: string
): boolean {
  if (userRole === 'site_personnel') return status === 'pending'
  if (userRole === 'site_manager') {
    return ['pending', 'rejected', 'kısmen gönderildi', 'depoda mevcut değil', 'ana depoda yok'].includes(status)
  }
  if (userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici') {
    return ['pending', 'rejected', 'kısmen gönderildi', 'depoda mevcut değil', 'ana depoda yok'].includes(status)
  }
  if (userRole === 'admin') return true
  return ['pending', 'rejected'].includes(status)
}

export function canEditItWorkflowRequest(
  userRole: string,
  userDepartment: string | null | undefined
): boolean {
  if (userRole === 'admin' || userRole === 'manager') return true
  if (userRole === 'department_head' && isPazarlamaDepartment(userDepartment)) return true
  return false
}

export function allowEditForRequest(opts: {
  status: string
  userRole: string
  userDepartment: string | null | undefined
  itWorkflowApplies: boolean
}): boolean {
  const { status, userRole, userDepartment, itWorkflowApplies } = opts
  const itStatuses = IT_WORKFLOW_STATUSES as readonly string[]
  if (itWorkflowApplies && itStatuses.includes(status)) {
    return canEditItWorkflowRequest(userRole, userDepartment)
  }
  return canEditPurchaseRequest(status, userRole)
}
