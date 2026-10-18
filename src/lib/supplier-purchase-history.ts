import { convertBrickQuantity } from '@/lib/brick-quantity'
import { normalizeMaterialName, type ContractOverview } from '@/lib/contracts'

export type SupplierPurchaseProduct = {
  key: string
  name: string
  unit: string
  quantity: number
  amount: number
  currency: string
  orderCount: number
  siteId: string | null
}

export type SupplierPurchaseRequestRow = {
  id: string
  requestId: string
  requestNumber: string
  status: string | null
  siteId: string | null
  siteName: string | null
  createdAt: string | null
  itemName: string
  quantity: number
  unit: string
  amount: number
  currency: string
}

export type SupplierPurchaseHistory = {
  firstDate: string | null
  lastDate: string | null
  invoiceCount: number
  orderCount: number
  totalAmount: number
  currency: string
  products: SupplierPurchaseProduct[]
  requests: SupplierPurchaseRequestRow[]
}

export type ContractItemPurchaseMatch = {
  quantity: number
  amount: number
  currency: string
  products: SupplierPurchaseProduct[]
}

function tokens(value: string): string[] {
  return normalizeMaterialName(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
}

function brickSize(name: string): string | null {
  const value = normalizeMaterialName(name)
  const lik = value.match(/\b(\d+)\s*['`´]?\s*l[iı]k/)
  if (lik) return lik[1]
  const dim = value.match(/\b(\d+)\s*[x*×]\s*\d+/)
  if (dim) return dim[1]
  return null
}

export function productNamesMatch(left: string, right: string): boolean {
  const a = normalizeMaterialName(left)
  const b = normalizeMaterialName(right)
  if (!a || !b) return false

  const sizeA = brickSize(left)
  const sizeB = brickSize(right)
  if (sizeA && sizeB && sizeA !== sizeB) return false

  if (a === b || a.includes(b) || b.includes(a)) return true

  const numsA: string[] = a.match(/\d+/g) ?? []
  const numsB: string[] = b.match(/\d+/g) ?? []
  const wordsA = tokens(a)
  const wordsB = tokens(b)
  const shared = wordsA.filter((word) => wordsB.includes(word) && !/^\d+$/.test(word))
  const numsMatch = numsA.length > 0 && numsA.every((num) => numsB.includes(num))

  if (shared.length >= 1 && numsMatch) return true
  if (shared.length >= 2) return true
  return false
}

export function matchHistoryAmountForContract(
  itemNames: string[],
  products: SupplierPurchaseProduct[]
): { amount: number; currency: string } {
  const matched = products.filter((product) =>
    itemNames.some((name) => productNamesMatch(name, product.name))
  )
  return {
    amount: matched.reduce((sum, product) => sum + product.amount, 0),
    currency: matched[0]?.currency || 'TRY',
  }
}

export function matchHistoryAmountFromRequests(
  itemNames: string[],
  requests: SupplierPurchaseRequestRow[],
  includedKeys: Iterable<string> = []
): { amount: number; currency: string } {
  const included = new Set(includedKeys)
  const counted = requests.filter(
    (row) =>
      included.has(row.id) || itemNames.some((name) => productNamesMatch(name, row.itemName))
  )
  return {
    amount: counted.reduce((sum, row) => sum + row.amount, 0),
    currency: counted[0]?.currency || 'TRY',
  }
}

export function matchHistoryToContractItem(
  itemName: string,
  products: SupplierPurchaseProduct[]
): ContractItemPurchaseMatch {
  const matched = products.filter((product) => productNamesMatch(itemName, product.name))
  const amount = matched.reduce((sum, product) => sum + product.amount, 0)
  const quantity = matched.reduce((sum, product) => {
    return sum + convertBrickQuantity(product.name, product.quantity, product.unit).quantity
  }, 0)
  return {
    quantity,
    amount,
    currency: matched[0]?.currency || 'TRY',
    products: matched,
  }
}

export function matchHistoryUsageForItem(
  itemName: string,
  history: SupplierPurchaseHistory | null | undefined,
  officialDelivered = 0
): number {
  if (!history) return officialDelivered
  const productQty = matchHistoryToContractItem(itemName, history.products).quantity
  const requestQty = history.requests
    .filter((row) => productNamesMatch(itemName, row.itemName))
    .reduce((sum, row) => sum + convertBrickQuantity(row.itemName, row.quantity, row.unit).quantity, 0)
  return Math.max(officialDelivered, productQty, requestQty)
}

export function filterHistoryBySites(
  history: SupplierPurchaseHistory | null | undefined,
  siteIds: string[] = []
): SupplierPurchaseHistory | null {
  if (!history) return null
  if (siteIds.length === 0) return history

  const requests = history.requests.filter((row) => row.siteId != null && siteIds.includes(row.siteId))
  const products = history.products.filter((row) => row.siteId != null && siteIds.includes(row.siteId))
  return {
    ...history,
    requests,
    products,
    orderCount: requests.length,
    invoiceCount: products.reduce((sum, row) => sum + row.orderCount, 0),
    totalAmount: requests.reduce((sum, row) => sum + row.amount, 0),
    currency: requests[0]?.currency || products[0]?.currency || history.currency,
  }
}

export function enrichContractWithHistory(
  contract: ContractOverview,
  history: SupplierPurchaseHistory | null | undefined,
  includedKeys: string[] = []
): ContractOverview {
  const scoped = filterHistoryBySites(history, contract.site_ids)
  const items = contract.items.map((item) => {
    const used = matchHistoryUsageForItem(item.material_item, scoped, item.delivered_quantity)
    return {
      ...item,
      delivered_quantity: used,
      remaining_quantity: Math.max(0, item.contracted_quantity - used),
      usage_ratio: item.contracted_quantity > 0 ? used / item.contracted_quantity : 0,
    }
  })
  const invoiced = matchHistoryAmountFromRequests(
    items.map((item) => item.material_item),
    scoped?.requests || [],
    includedKeys
  )

  return {
    ...contract,
    items,
    total_delivered: items.reduce((sum, item) => sum + item.delivered_quantity, 0),
    total_remaining: items.reduce((sum, item) => sum + item.remaining_quantity, 0),
    invoiced_amounts:
      invoiced.amount > 0
        ? [{ currency: invoiced.currency, amount: invoiced.amount }]
        : contract.invoiced_amounts,
  }
}
