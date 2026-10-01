import { createClient } from '@/lib/supabase/client'
import {
  type ActiveContractOption,
  type ContractItemOverview,
  type ContractMoneyTotal,
  type ContractOverview,
  type ContractPendingOrder,
  type ContractCategory,
  type ContractPartyKind,
  type CreateContractInput,
  type RequestContractBinding,
  type SupplierContractDelivery,
  formatContractQty,
  isContractCurrentlyActive,
  isContractExpired,
  isContractExpiringSoon,
  normalizeMaterialName,
} from '@/lib/contracts'
import { contractProjectLabel } from '@/lib/contract-setup'
import { invalidateContractsCache } from '@/lib/cache'

type RawContract = {
  id: string
  supplier_id: string
  title: string | null
  contract_no: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  document_urls: string[] | null
  status: 'active' | 'cancelled'
  budget_amount: number | null
  budget_currency: string | null
  party_kind: ContractPartyKind | null
  contract_category: ContractCategory | null
  created_by: string | null
  created_at: string
  updated_at: string
  supplier?: { id: string; name: string } | { id: string; name: string }[] | null
  items?: RawItem[] | null
  sites?: RawContractSite[] | null
}

type RawContractSite = {
  site_id: string
  site?: { id: string; name: string } | { id: string; name: string }[] | null
}

type RawItem = {
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

function unwrapSupplier(supplier: RawContract['supplier']): { id: string; name: string } | null {
  if (!supplier) return null
  return Array.isArray(supplier) ? supplier[0] ?? null : supplier
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

type ContractActivity = {
  deliveredByItem: Map<string, number>
  pendingByItem: Map<string, number>
  deliveredByRequestItem: Map<string, number>
  pendingOrderQtyByItem: Map<string, number>
  pendingOrders: Array<ContractPendingOrder & { contract_id: string }>
  invoicedByContract: Map<string, ContractMoneyTotal[]>
}

function unwrapSite(
  site: RawContractSite['site']
): { id: string; name: string } | null {
  if (!site) return null
  return Array.isArray(site) ? site[0] ?? null : site
}

function contractSites(contract: RawContract): { site_ids: string[]; site_labels: string[] } {
  const rows = contract.sites || []
  const site_ids = rows.map((row) => row.site_id).filter(Boolean)
  const site_labels = rows.map((row) => {
    const site = unwrapSite(row.site)
    return contractProjectLabel(row.site_id, site?.name)
  })
  return { site_ids, site_labels }
}

function buildOverview(contracts: RawContract[], activity: ContractActivity): ContractOverview[] {
  return contracts.map((contract) => {
    const supplier = unwrapSupplier(contract.supplier)
    const sites = contractSites(contract)
    const items: ContractItemOverview[] = (contract.items || []).map((item) => {
      const delivered = activity.deliveredByItem.get(item.id) || 0
      const contracted = toNumber(item.contracted_quantity)
      const remaining = Math.max(0, contracted - delivered)
      const orderPending = activity.pendingOrderQtyByItem.get(item.id) || 0
      return {
        ...item,
        unit_price: toNumber(item.unit_price),
        contracted_quantity: contracted,
        delivered_quantity: delivered,
        remaining_quantity: remaining,
        pending_request_quantity: activity.pendingByItem.get(item.id) || 0,
        pending_order_quantity: orderPending,
        usage_ratio: contracted > 0 ? delivered / contracted : 0,
      }
    })

    const totalContracted = items.reduce((sum, item) => sum + item.contracted_quantity, 0)
    const totalDelivered = items.reduce((sum, item) => sum + item.delivered_quantity, 0)
    const budget = contract.budget_amount == null ? null : toNumber(contract.budget_amount)
    const invoiced = activity.invoicedByContract.get(contract.id) || []
    const budgetCurrency = contract.budget_currency || 'TRY'
    const invoicedInBudget = invoiced.find((row) => row.currency === budgetCurrency)?.amount || 0
    const budgetRatio = budget && budget > 0 ? invoicedInBudget / budget : 0
    const quantityRatio = totalContracted > 0 ? totalDelivered / totalContracted : 0

    return {
      ...contract,
      budget_amount: budget,
      budget_currency: budgetCurrency,
      party_kind: contract.party_kind || 'supplier',
      contract_category: contract.contract_category || null,
      document_urls: contract.document_urls || [],
      supplier_name: supplier?.name || (contract.party_kind === 'subcontractor' ? 'Taşeron' : 'Tedarikçi'),
      site_ids: sites.site_ids,
      site_labels: sites.site_labels,
      items,
      total_contracted: totalContracted,
      total_delivered: totalDelivered,
      total_remaining: Math.max(0, totalContracted - totalDelivered),
      invoiced_amounts: invoiced,
      pending_orders: activity.pendingOrders.filter((order) => order.contract_id === contract.id),
      is_expired: contract.status === 'cancelled' || isContractExpired(contract.end_date),
      is_expiring_soon: isContractExpiringSoon(contract.end_date),
      is_nearly_used: quantityRatio >= 0.8 || budgetRatio >= 0.8,
    }
  })
}

function emptyActivity(): ContractActivity {
  return {
    deliveredByItem: new Map(),
    pendingByItem: new Map(),
    deliveredByRequestItem: new Map(),
    pendingOrderQtyByItem: new Map(),
    pendingOrders: [],
    invoicedByContract: new Map(),
  }
}

async function loadContractActivity(
  items: Array<{ id: string; contract_id: string }>
): Promise<ContractActivity> {
  const activity = emptyActivity()
  const itemIds = items.map((item) => item.id)
  if (itemIds.length === 0) return activity

  const contractIdByItem = new Map(items.map((item) => [item.id, item.contract_id]))
  const supabase = createClient()

  const { data: deliveries, error: deliveryError } = await supabase
    .from('supplier_contract_deliveries')
    .select('contract_item_id, purchase_request_item_id, delivered_quantity')
    .in('contract_item_id', itemIds)

  if (deliveryError) throw deliveryError

  for (const row of deliveries || []) {
    activity.deliveredByItem.set(
      row.contract_item_id,
      (activity.deliveredByItem.get(row.contract_item_id) || 0) + toNumber(row.delivered_quantity)
    )
    activity.deliveredByRequestItem.set(
      row.purchase_request_item_id,
      (activity.deliveredByRequestItem.get(row.purchase_request_item_id) || 0) + toNumber(row.delivered_quantity)
    )
  }

  const { data: requestItems, error: requestError } = await supabase
    .from('purchase_request_items')
    .select('id, contract_item_id, item_name, unit, quantity, original_quantity')
    .in('contract_item_id', itemIds)

  if (requestError) throw requestError

  const requestItemById = new Map((requestItems || []).map((row) => [row.id, row]))

  for (const row of requestItems || []) {
    if (!row.contract_item_id) continue
    const requested = toNumber(row.original_quantity ?? row.quantity)
    const delivered = activity.deliveredByRequestItem.get(row.id) || 0
    const pending = Math.max(0, requested - delivered)
    if (pending > 0) {
      activity.pendingByItem.set(
        row.contract_item_id,
        (activity.pendingByItem.get(row.contract_item_id) || 0) + pending
      )
    }
  }

  const requestItemIds = (requestItems || []).map((row) => row.id)
  if (requestItemIds.length === 0) return activity

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, quantity, material_item_id, created_at')
    .in('material_item_id', requestItemIds)

  if (ordersError) throw ordersError

  const orderIds = (orders || []).map((order) => order.id)
  const deliveredByOrder = new Map<string, number>()

  if (orderIds.length > 0) {
    const { data: orderDeliveries, error: orderDeliveryError } = await supabase
      .from('order_deliveries')
      .select('order_id, delivered_quantity')
      .in('order_id', orderIds)

    if (orderDeliveryError) throw orderDeliveryError

    for (const row of orderDeliveries || []) {
      deliveredByOrder.set(
        row.order_id,
        (deliveredByOrder.get(row.order_id) || 0) + toNumber(row.delivered_quantity)
      )
    }

    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('order_id, amount, currency')
      .in('order_id', orderIds)

    if (invoiceError) throw invoiceError

    for (const invoice of invoices || []) {
      const order = (orders || []).find((row) => row.id === invoice.order_id)
      const requestItem = order?.material_item_id ? requestItemById.get(order.material_item_id) : undefined
      const contractItemId = requestItem?.contract_item_id
      if (!contractItemId) continue
      const contractId = contractIdByItem.get(contractItemId)
      if (!contractId) continue

      const currency = invoice.currency || 'TRY'
      const totals = activity.invoicedByContract.get(contractId) || []
      const existing = totals.find((row) => row.currency === currency)
      if (existing) {
        existing.amount += toNumber(invoice.amount)
      } else {
        totals.push({ currency, amount: toNumber(invoice.amount) })
      }
      activity.invoicedByContract.set(contractId, totals)
    }
  }

  for (const order of orders || []) {
    if (!order.material_item_id) continue
    const requestItem = requestItemById.get(order.material_item_id)
    const contractItemId = requestItem?.contract_item_id
    if (!contractItemId) continue
    const contractId = contractIdByItem.get(contractItemId)
    if (!contractId) continue

    const ordered = toNumber(order.quantity)
    const delivered = deliveredByOrder.get(order.id) || 0
    const pending = Math.max(0, ordered - delivered)
    if (pending <= 0) continue

    activity.pendingOrderQtyByItem.set(
      contractItemId,
      (activity.pendingOrderQtyByItem.get(contractItemId) || 0) + pending
    )
    activity.pendingOrders.push({
      order_id: order.id,
      order_number: order.order_number || 'Sipariş',
      contract_item_id: contractItemId,
      contract_id: contractId,
      material_name: requestItem?.item_name || 'Malzeme',
      unit: requestItem?.unit || '',
      ordered_quantity: ordered,
      delivered_quantity: delivered,
      pending_quantity: pending,
    })
  }

  return activity
}

export async function fetchContractOverviews(supplierId?: string): Promise<ContractOverview[]> {
  const supabase = createClient()
  let query = supabase
    .from('supplier_contracts')
    .select(`
      *,
      supplier:suppliers(id, name),
      items:supplier_contract_items(*),
      sites:supplier_contract_sites(site_id, site:sites(id, name))
    `)
    .order('created_at', { ascending: false })

  if (supplierId) {
    query = query.eq('supplier_id', supplierId)
  }

  const { data, error } = await query
  if (error) throw error

  const contracts = (data || []) as RawContract[]
  const activity = await loadContractActivity(
    contracts.flatMap((contract) =>
      (contract.items || []).map((item) => ({ id: item.id, contract_id: item.contract_id }))
    )
  )
  return buildOverview(contracts, activity)
}

export async function fetchContractOverviewById(contractId: string): Promise<ContractOverview | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplier_contracts')
    .select(`
      *,
      supplier:suppliers(id, name),
      items:supplier_contract_items(*),
      sites:supplier_contract_sites(site_id, site:sites(id, name))
    `)
    .eq('id', contractId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const contract = data as RawContract
  const activity = await loadContractActivity(
    (contract.items || []).map((item) => ({ id: item.id, contract_id: item.contract_id }))
  )
  return buildOverview([contract], activity)[0] || null
}

type ActiveContractItemRow = RawItem & {
  contract:
    | {
        id: string
        supplier_id: string
        title: string | null
        start_date: string | null
        end_date: string | null
        status: 'active' | 'cancelled'
        supplier?: RawContract['supplier']
      }
    | Array<{
        id: string
        supplier_id: string
        title: string | null
        start_date: string | null
        end_date: string | null
        status: 'active' | 'cancelled'
        supplier?: RawContract['supplier']
      }>
    | null
}

/**
 * Görünen malzemeler için aktif sözleşme seçenekleri.
 * Tüm sözleşmeleri, teslimatları ve talep kalemlerini çekmez; yalnızca eşleşen kalemlerin kalan miktarını hesaplar.
 */
export async function fetchActiveContractsForMaterials(materialNames?: string[]): Promise<ActiveContractOption[]> {
  const rawNames = [...new Set((materialNames || []).map((name) => String(name).trim()).filter(Boolean))]
  const wanted = new Set(rawNames.map(normalizeMaterialName))
  if (wanted.size === 0) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplier_contract_items')
    .select(`
      id,
      contract_id,
      material_class,
      material_group,
      material_item,
      unit,
      unit_price,
      currency,
      contracted_quantity,
      created_at,
      updated_at,
      contract:supplier_contracts!inner (
        id,
        supplier_id,
        title,
        start_date,
        end_date,
        status,
        supplier:suppliers ( id, name )
      )
    `)
    .in('material_item', rawNames)
    .eq('contract.status', 'active')

  if (error) throw error

  const matched = ((data || []) as ActiveContractItemRow[])
    .map((row) => {
      const contract = Array.isArray(row.contract) ? row.contract[0] : row.contract
      return { row, contract }
    })
    .filter(({ row, contract }) => {
      if (!contract || !row.material_item) return false
      if (!wanted.has(normalizeMaterialName(row.material_item))) return false
      return isContractCurrentlyActive(contract)
    })

  if (matched.length === 0) return []

  const activity = await loadContractActivity(
    matched.map(({ row }) => ({ id: row.id, contract_id: row.contract_id }))
  )

  return matched.map(({ row, contract }) => {
    const supplier = unwrapSupplier(contract?.supplier)
    const contracted = toNumber(row.contracted_quantity)
    const delivered = activity.deliveredByItem.get(row.id) || 0
    return {
      contract_item_id: row.id,
      contract_id: row.contract_id,
      supplier_id: contract?.supplier_id || '',
      supplier_name: supplier?.name || 'Tedarikçi',
      material_item: row.material_item,
      material_class: row.material_class,
      material_group: row.material_group,
      unit: row.unit,
      unit_price: toNumber(row.unit_price),
      currency: row.currency,
      contracted_quantity: contracted,
      remaining_quantity: Math.max(0, contracted - delivered),
      end_date: contract?.end_date || null,
      title: contract?.title || null,
    }
  })
}

export async function fetchRequestContractBindings(
  requestItemIds: string[]
): Promise<RequestContractBinding[]> {
  if (requestItemIds.length === 0) return []

  const supabase = createClient()
  const { data: items, error } = await supabase
    .from('purchase_request_items')
    .select('id, contract_item_id, quantity, original_quantity')
    .in('id', requestItemIds)
    .not('contract_item_id', 'is', null)

  if (error) throw error
  if (!items || items.length === 0) return []

  const contractItemIds = Array.from(
    new Set(items.map((item) => item.contract_item_id).filter(Boolean) as string[])
  )
  const { data: contractItems, error: itemError } = await supabase
    .from('supplier_contract_items')
    .select('id, contract_id')
    .in('id', contractItemIds)

  if (itemError) throw itemError

  const contractIds = Array.from(new Set((contractItems || []).map((row) => row.contract_id)))
  const overviews = await Promise.all(contractIds.map((id) => fetchContractOverviewById(id)))
  const overviewByItem = new Map<string, { contract: ContractOverview; item: ContractItemOverview }>()

  for (const contract of overviews) {
    if (!contract) continue
    for (const item of contract.items) {
      overviewByItem.set(item.id, { contract, item })
    }
  }

  const activity = await loadContractActivity(
    (contractItems || []).map((row) => ({ id: row.id, contract_id: row.contract_id }))
  )

  return items.flatMap((row) => {
    if (!row.contract_item_id) return []
    const found = overviewByItem.get(row.contract_item_id)
    if (!found) return []
    const deliveredForRequest = activity.deliveredByRequestItem.get(row.id) || 0
    const requested = toNumber(row.original_quantity ?? row.quantity)
    return [{
      request_item_id: row.id,
      contract_item_id: row.contract_item_id,
      overview: found.item,
      contract: found.contract,
      delivered_for_request: deliveredForRequest,
      remaining_for_request: Math.max(0, requested - deliveredForRequest),
    }]
  })
}

export async function fetchContractDeliveries(contractItemId: string): Promise<SupplierContractDelivery[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplier_contract_deliveries')
    .select('*')
    .eq('contract_item_id', contractItemId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as SupplierContractDelivery[]
}

export async function fetchLinkedRequests(contractId: string) {
  const supabase = createClient()
  const { data: items, error: itemsError } = await supabase
    .from('supplier_contract_items')
    .select('id')
    .eq('contract_id', contractId)

  if (itemsError) throw itemsError
  const itemIds = (items || []).map((item) => item.id)
  if (itemIds.length === 0) return []

  const { data, error } = await supabase
    .from('purchase_request_items')
    .select(`
      id,
      item_name,
      quantity,
      original_quantity,
      unit,
      contract_item_id,
      purchase_request:purchase_requests(
        id,
        request_number,
        status,
        site_name,
        created_at
      )
    `)
    .in('contract_item_id', itemIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createSupplierContract(input: CreateContractInput): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: contract, error } = await supabase
    .from('supplier_contracts')
    .insert({
      supplier_id: input.supplier_id,
      title: input.title?.trim() || null,
      contract_no: input.contract_no?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      notes: input.notes?.trim() || null,
      budget_amount: input.budget_amount,
      budget_currency: input.budget_currency || 'TRY',
      party_kind: input.party_kind || 'supplier',
      contract_category: input.contract_category || null,
      status: 'active',
      created_by: user?.id || null,
    })
    .select('id')
    .single()

  if (error) throw error

  const siteIds = Array.from(new Set((input.site_ids || []).filter(Boolean)))
  if (siteIds.length > 0) {
    const { error: sitesError } = await supabase.from('supplier_contract_sites').insert(
      siteIds.map((siteId) => ({
        contract_id: contract.id,
        site_id: siteId,
      }))
    )
    if (sitesError) {
      await supabase.from('supplier_contracts').delete().eq('id', contract.id)
      throw sitesError
    }
  }

  const { error: itemsError } = await supabase
    .from('supplier_contract_items')
    .insert(
      input.items.map((item) => ({
        contract_id: contract.id,
        material_class: item.material_class || null,
        material_group: item.material_group || null,
        material_item: item.material_item,
        unit: item.unit,
        unit_price: item.unit_price,
        currency: item.currency || 'TRY',
        contracted_quantity: item.contracted_quantity,
      }))
    )

  if (itemsError) {
    await supabase.from('supplier_contracts').delete().eq('id', contract.id)
    throw itemsError
  }

  invalidateContractsCache()
  return contract.id
}

export interface ContractPartyOption {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  tax_number: string | null
}

export async function fetchContractParties(kind: ContractPartyKind): Promise<ContractPartyOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, contact_person, phone, tax_number')
    .eq('kind', kind)
    .order('name')

  if (error) throw error
  return data || []
}

export async function createSubcontractor(input: {
  name: string
  contact_person?: string
  phone?: string
  tax_number?: string
}): Promise<ContractPartyOption> {
  const supabase = createClient()
  const name = input.name.trim()
  if (!name) throw new Error('Taşeron adı gerekli')

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name,
      contact_person: input.contact_person?.trim() || null,
      phone: input.phone?.trim() || null,
      tax_number: input.tax_number?.trim() || null,
      kind: 'subcontractor',
      is_approved: true,
      code: `TAS${Date.now()}`,
    })
    .select('id, name, contact_person, phone, tax_number')
    .single()

  if (error) throw error
  return data
}

export async function updateContractBudget(
  contractId: string,
  budgetAmount: number,
  budgetCurrency: string
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('supplier_contracts')
    .update({
      budget_amount: budgetAmount,
      budget_currency: budgetCurrency || 'TRY',
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (error) throw error
  invalidateContractsCache()
}

export async function cancelSupplierContract(contractId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('supplier_contracts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', contractId)

  if (error) throw error
  invalidateContractsCache()
}

export async function confirmContractDelivery(params: {
  contractItemId: string
  purchaseRequestItemId: string
  deliveredQuantity: number
  waybillPhotos: string[]
  notes?: string
}): Promise<{ success: boolean; error?: string; remaining_quantity?: number; request_status?: string }> {
  const supabase = createClient()
  const { data, error } = await (supabase as any).rpc('confirm_contract_delivery', {
    p_contract_item_id: params.contractItemId,
    p_purchase_request_item_id: params.purchaseRequestItemId,
    p_delivered_quantity: params.deliveredQuantity,
    p_waybill_photos: params.waybillPhotos,
    p_notes: params.notes || null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as {
    success?: boolean
    error?: string
    remaining_quantity?: number
    request_status?: string
  }

  if (!result?.success) {
    return { success: false, error: result?.error || 'İrsaliye kaydı oluşturulamadı' }
  }

  invalidateContractsCache()
  return {
    success: true,
    remaining_quantity: result.remaining_quantity,
    request_status: result.request_status,
  }
}

export function describeContractOption(option: ActiveContractOption): string {
  return `${option.supplier_name} · kalan ${formatContractQty(option.remaining_quantity, option.unit)}`
}
