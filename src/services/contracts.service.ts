import { createClient } from '@/lib/supabase/client'
import {
  type ActiveContractOption,
  type ContractItemOverview,
  type ContractOverview,
  type CreateContractInput,
  type RequestContractBinding,
  type SupplierContractDelivery,
  formatContractQty,
  isContractCurrentlyActive,
  isContractExpired,
  isContractExpiringSoon,
  normalizeMaterialName,
} from '@/lib/contracts'
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
  created_by: string | null
  created_at: string
  updated_at: string
  supplier?: { id: string; name: string } | { id: string; name: string }[] | null
  items?: RawItem[] | null
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

function buildOverview(
  contracts: RawContract[],
  deliveredByItem: Map<string, number>,
  pendingByItem: Map<string, number>
): ContractOverview[] {
  return contracts.map((contract) => {
    const supplier = unwrapSupplier(contract.supplier)
    const items: ContractItemOverview[] = (contract.items || []).map((item) => {
      const delivered = deliveredByItem.get(item.id) || 0
      const contracted = toNumber(item.contracted_quantity)
      const remaining = Math.max(0, contracted - delivered)
      return {
        ...item,
        unit_price: toNumber(item.unit_price),
        contracted_quantity: contracted,
        delivered_quantity: delivered,
        remaining_quantity: remaining,
        pending_request_quantity: pendingByItem.get(item.id) || 0,
        usage_ratio: contracted > 0 ? delivered / contracted : 0,
      }
    })

    const totalContracted = items.reduce((sum, item) => sum + item.contracted_quantity, 0)
    const totalDelivered = items.reduce((sum, item) => sum + item.delivered_quantity, 0)

    return {
      ...contract,
      document_urls: contract.document_urls || [],
      supplier_name: supplier?.name || 'Tedarikçi',
      items,
      total_contracted: totalContracted,
      total_delivered: totalDelivered,
      total_remaining: Math.max(0, totalContracted - totalDelivered),
      is_expired: contract.status === 'cancelled' || isContractExpired(contract.end_date),
      is_expiring_soon: isContractExpiringSoon(contract.end_date),
      is_nearly_used: totalContracted > 0 && totalDelivered / totalContracted >= 0.8,
    }
  })
}

async function loadDeliveryMaps(itemIds: string[]) {
  const supabase = createClient()
  const deliveredByItem = new Map<string, number>()
  const pendingByItem = new Map<string, number>()
  const deliveredByRequestItem = new Map<string, number>()

  if (itemIds.length === 0) {
    return { deliveredByItem, pendingByItem, deliveredByRequestItem }
  }

  const { data: deliveries, error: deliveryError } = await supabase
    .from('supplier_contract_deliveries')
    .select('contract_item_id, purchase_request_item_id, delivered_quantity')
    .in('contract_item_id', itemIds)

  if (deliveryError) throw deliveryError

  for (const row of deliveries || []) {
    deliveredByItem.set(
      row.contract_item_id,
      (deliveredByItem.get(row.contract_item_id) || 0) + toNumber(row.delivered_quantity)
    )
    deliveredByRequestItem.set(
      row.purchase_request_item_id,
      (deliveredByRequestItem.get(row.purchase_request_item_id) || 0) + toNumber(row.delivered_quantity)
    )
  }

  const { data: requestItems, error: requestError } = await supabase
    .from('purchase_request_items')
    .select('id, contract_item_id, quantity, original_quantity')
    .in('contract_item_id', itemIds)

  if (requestError) throw requestError

  for (const row of requestItems || []) {
    if (!row.contract_item_id) continue
    const requested = toNumber(row.original_quantity ?? row.quantity)
    const delivered = deliveredByRequestItem.get(row.id) || 0
    const pending = Math.max(0, requested - delivered)
    if (pending > 0) {
      pendingByItem.set(
        row.contract_item_id,
        (pendingByItem.get(row.contract_item_id) || 0) + pending
      )
    }
  }

  return { deliveredByItem, pendingByItem, deliveredByRequestItem }
}

export async function fetchContractOverviews(supplierId?: string): Promise<ContractOverview[]> {
  const supabase = createClient()
  let query = supabase
    .from('supplier_contracts')
    .select(`
      *,
      supplier:suppliers(id, name),
      items:supplier_contract_items(*)
    `)
    .order('created_at', { ascending: false })

  if (supplierId) {
    query = query.eq('supplier_id', supplierId)
  }

  const { data, error } = await query
  if (error) throw error

  const contracts = (data || []) as RawContract[]
  const itemIds = contracts.flatMap((contract) => (contract.items || []).map((item) => item.id))
  const maps = await loadDeliveryMaps(itemIds)
  return buildOverview(contracts, maps.deliveredByItem, maps.pendingByItem)
}

export async function fetchContractOverviewById(contractId: string): Promise<ContractOverview | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('supplier_contracts')
    .select(`
      *,
      supplier:suppliers(id, name),
      items:supplier_contract_items(*)
    `)
    .eq('id', contractId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const contract = data as RawContract
  const itemIds = (contract.items || []).map((item) => item.id)
  const maps = await loadDeliveryMaps(itemIds)
  return buildOverview([contract], maps.deliveredByItem, maps.pendingByItem)[0] || null
}

export async function fetchActiveContractsForMaterials(materialNames?: string[]): Promise<ActiveContractOption[]> {
  const names = (materialNames || []).map(normalizeMaterialName).filter(Boolean)

  const overviews = await fetchContractOverviews()
  const options: ActiveContractOption[] = []

  for (const contract of overviews) {
    if (!isContractCurrentlyActive(contract)) continue
    for (const item of contract.items) {
      if (names.length > 0 && !names.includes(normalizeMaterialName(item.material_item))) continue
      options.push({
        contract_item_id: item.id,
        contract_id: contract.id,
        supplier_id: contract.supplier_id,
        supplier_name: contract.supplier_name,
        material_item: item.material_item,
        material_class: item.material_class,
        material_group: item.material_group,
        unit: item.unit,
        unit_price: item.unit_price,
        currency: item.currency,
        contracted_quantity: item.contracted_quantity,
        remaining_quantity: item.remaining_quantity,
        end_date: contract.end_date,
        title: contract.title,
      })
    }
  }

  return options
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
    .select('contract_id')
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

  const maps = await loadDeliveryMaps(contractItemIds)

  return items.flatMap((row) => {
    if (!row.contract_item_id) return []
    const found = overviewByItem.get(row.contract_item_id)
    if (!found) return []
    const deliveredForRequest = maps.deliveredByRequestItem.get(row.id) || 0
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
      status: 'active',
      created_by: user?.id || null,
    })
    .select('id')
    .single()

  if (error) throw error

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
