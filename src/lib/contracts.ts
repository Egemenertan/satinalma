export type ContractStatus = 'active' | 'cancelled'
export type ContractPartyKind = 'supplier' | 'subcontractor'
export type ContractCategory = 'goods_and_services' | 'goods' | 'services'

export interface SupplierContract {
  id: string
  supplier_id: string
  title: string | null
  contract_no: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  document_urls: string[]
  status: ContractStatus
  budget_amount: number | null
  budget_currency: string
  party_kind: ContractPartyKind
  contract_category: ContractCategory | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SupplierContractItem {
  id: string
  contract_id: string
  material_class: string | null
  material_group: string | null
  material_item: string
  unit: string
  unit_price: number
  currency: string
  contracted_quantity: number
  created_at: string
  updated_at: string
}

export interface SupplierContractDelivery {
  id: string
  contract_item_id: string
  purchase_request_id: string
  purchase_request_item_id: string
  delivered_quantity: number
  waybill_photos: string[]
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export interface ContractMoneyTotal {
  currency: string
  amount: number
}

export interface ContractPendingOrder {
  order_id: string
  order_number: string
  contract_item_id: string
  material_name: string
  unit: string
  ordered_quantity: number
  delivered_quantity: number
  pending_quantity: number
}

export interface ContractItemOverview extends SupplierContractItem {
  delivered_quantity: number
  remaining_quantity: number
  pending_request_quantity: number
  pending_order_quantity: number
  usage_ratio: number
}

export interface ContractOverview extends SupplierContract {
  supplier_name: string
  site_ids: string[]
  site_labels: string[]
  items: ContractItemOverview[]
  total_contracted: number
  total_delivered: number
  total_remaining: number
  invoiced_amounts: ContractMoneyTotal[]
  pending_orders: ContractPendingOrder[]
  is_expired: boolean
  is_expiring_soon: boolean
  is_nearly_used: boolean
}

export interface ActiveContractOption {
  contract_item_id: string
  contract_id: string
  supplier_id: string
  supplier_name: string
  material_item: string
  material_class: string | null
  material_group: string | null
  unit: string
  unit_price: number
  currency: string
  contracted_quantity: number
  remaining_quantity: number
  end_date: string | null
  title: string | null
}

export interface RequestContractBinding {
  request_item_id: string
  contract_item_id: string
  overview: ContractItemOverview
  contract: ContractOverview
  delivered_for_request: number
  remaining_for_request: number
}

export interface CreateContractItemInput {
  material_class: string
  material_group: string
  material_item: string
  unit: string
  unit_price: number
  currency?: string
  contracted_quantity: number
}

export interface CreateContractInput {
  supplier_id: string
  party_kind?: ContractPartyKind
  contract_category?: ContractCategory | null
  site_ids?: string[]
  title?: string
  contract_no?: string
  start_date?: string
  end_date?: string
  notes?: string
  budget_amount: number
  budget_currency: string
  items: CreateContractItemInput[]
}

export const CONTRACT_UNITS = [
  'Adet',
  'Kg',
  'Gram',
  'Ton',
  'Litre',
  'M',
  'M²',
  'M³',
  'Paket',
  'Kutu',
  'Koli',
  'Çuval',
  'Top',
  'Rulo',
  'Palet',
  'Torba',
] as const

export function normalizeMaterialName(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value).trim().toLocaleLowerCase('tr-TR')
}

export function isContractCurrentlyActive(contract: Pick<SupplierContract, 'status' | 'start_date' | 'end_date'>): boolean {
  if (contract.status !== 'active') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (contract.start_date) {
    const start = new Date(contract.start_date)
    start.setHours(0, 0, 0, 0)
    if (start > today) return false
  }
  if (contract.end_date) {
    const end = new Date(contract.end_date)
    end.setHours(0, 0, 0, 0)
    if (end < today) return false
  }
  return true
}

export function isContractExpired(endDate: string | null): boolean {
  if (!endDate) return false
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end < today
}

export function isContractExpiringSoon(endDate: string | null, days = 30): boolean {
  if (!endDate || isContractExpired(endDate)) return false
  const end = new Date(endDate)
  const limit = new Date()
  limit.setDate(limit.getDate() + days)
  return end <= limit
}

export function formatContractQty(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 3,
  }).format(Number(value) || 0)
  return unit ? `${formatted} ${unit}` : formatted
}

export function formatContractMoney(value: number, currency = 'TRY'): string {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0)
  } catch {
    return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency}`
  }
}

export function formatContractDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR')
}
