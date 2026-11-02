'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, Minus, Plus, Search, X, Loader2, UserRound, Package, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  assignZimmetInWarehouse,
  changeZimmetAssignment,
  fetchActiveZimmetsForEmployee,
} from '@/services/zimmet.service'
import { transferStock } from '@/services/stock.service'

interface Employee {
  id: string
  first_name: string | null
  work_email: string | null
  department: string | null
  position: string | null
}

interface WarehouseOption {
  id: string
  warehouseId: string
  name: string
  available: number
}

interface ProductDetail {
  id: string
  productId: string
  name: string
  unit: string
  sku: string
  brand: string
  productType: string
  unitPrice: number | null
  currency: string
  quantity: number
  warehouseId: string
  warehouses: WarehouseOption[]
  inventoryIds?: string[]
}

interface BulkZimmetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  selectedProductIds: string[]
  /** teslim: stok aktarılır, zimmet açılmaz, teslim raporu iner */
  mode?: 'zimmet' | 'teslim'
  /** Operate kullanıcısında yalnızca bu depolar */
  allowedWarehouseIds?: string[]
}

async function rowsInChunks<T>(
  ids: string[],
  load: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
) {
  const rows: T[] = []
  for (let index = 0; index < ids.length; index += 80) {
    const { data, error } = await load(ids.slice(index, index + 80))
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

function employeeLabel(employee: Employee) {
  return employee.first_name?.trim() || 'İsimsiz çalışan'
}

function isSanayiDepo(name: string) {
  return name.trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ') === 'sanayi depo'
}

function defaultSourceWarehouseId(warehouses: WarehouseOption[]) {
  const sanayi = warehouses.find((warehouse) => isSanayiDepo(warehouse.name) && warehouse.available > 0)
  if (sanayi) return sanayi.warehouseId
  return [...warehouses].sort((a, b) => b.available - a.available)[0]?.warehouseId || ''
}

function stockPlan(product: ProductDetail, targetWarehouseId: string) {
  const source =
    product.warehouses.find((warehouse) => warehouse.warehouseId === product.warehouseId) ||
    product.warehouses[0]
  return {
    available: source?.available || 0,
    source,
    moves: Boolean(source && targetWarehouseId && source.warehouseId !== targetWarehouseId),
  }
}

type ProductCatalogRow = Omit<ProductDetail, 'quantity' | 'warehouseId' | 'warehouses' | 'inventoryIds'>

function catalogFromProduct(product: {
  id: string
  name: string
  unit: string | null
  sku: string | null
  product_type: string | null
  unit_price: number | null
  currency: string | null
  brand: { name: string } | { name: string }[] | null
}): ProductCatalogRow {
  const brand = Array.isArray(product.brand) ? product.brand[0] : product.brand
  const price = Number(product.unit_price)
  return {
    id: product.id,
    productId: product.id,
    name: product.name,
    unit: product.unit || 'adet',
    sku: product.sku || '',
    brand: brand?.name || '',
    productType: product.product_type || '',
    unitPrice: Number.isFinite(price) && price > 0 ? price : null,
    currency: product.currency || 'TRY',
  }
}

function employeeResultsOf(employees: Employee[], search: string, excludeId?: string) {
  const query = search.trim().toLocaleLowerCase('tr')
  if (query.length < 1) return []
  return employees
    .filter((employee) => {
      if (excludeId && employee.id === excludeId) return false
      const haystack = [employee.first_name, employee.work_email, employee.department, employee.position]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr')
      return haystack.includes(query)
    })
    .slice(0, 8)
}

function PersonPicker({
  label,
  hint,
  selected,
  open,
  onToggle,
  search,
  onSearch,
  results,
  employeeCount,
  onSelect,
  onClear,
  placeholder,
  emptyLabel,
  disabled,
}: {
  label: string
  hint?: string
  selected: Employee | undefined
  open: boolean
  onToggle: () => void
  search: string
  onSearch: (value: string) => void
  results: Employee[]
  employeeCount: number
  onSelect: (employee: Employee) => void
  onClear?: () => void
  placeholder: string
  emptyLabel: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <UserRound className="h-4 w-4 text-gray-500" />
          {label}
        </div>
        {selected && onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            Depodan
          </button>
        )}
      </div>

      {selected && !open ? (
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-gray-300 disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-950 text-sm font-medium text-white">
              {employeeLabel(selected).charAt(0).toLocaleUpperCase('tr')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-950">{employeeLabel(selected)}</p>
              <p className="truncate text-xs text-gray-500">
                {selected.position || selected.department || selected.work_email || 'Çalışan'}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">Değiştirmek için tıklayın</p>
        </button>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={placeholder}
              className="h-11 rounded-xl border-gray-200 bg-white pl-9"
              disabled={disabled}
            />
          </div>
          <div className="max-h-52 overflow-y-auto rounded-2xl border border-gray-200 bg-white">
            {search.trim().length < 1 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-500">
                {employeeCount} çalışan içinden arayın
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-500">{emptyLabel}</p>
            ) : (
              results.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => onSelect(employee)}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                    {employeeLabel(employee).charAt(0).toLocaleUpperCase('tr')}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-950">{employeeLabel(employee)}</p>
                    <p className="truncate text-xs text-gray-500">
                      {[employee.position, employee.department].filter(Boolean).join(' · ') ||
                        employee.work_email}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {hint ? <p className="text-xs leading-5 text-gray-500">{hint}</p> : null}
    </div>
  )
}

export default function BulkZimmetModal({
  open,
  onOpenChange,
  onSuccess,
  showToast,
  selectedProductIds,
  mode = 'zimmet',
  allowedWarehouseIds,
}: BulkZimmetModalProps) {
  const isDelivery = mode === 'teslim'
  const [fromEmployeeId, setFromEmployeeId] = useState('')
  const [fromEmployeeOpen, setFromEmployeeOpen] = useState(true)
  const [fromEmployeeSearch, setFromEmployeeSearch] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeOpen, setEmployeeOpen] = useState(true)
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([])
  const [catalogById, setCatalogById] = useState<Map<string, ProductCatalogRow>>(new Map())
  const [sites, setSites] = useState<{ id: string; name: string }[]>([])
  const [targetWarehouseId, setTargetWarehouseId] = useState('')
  const [managedWarehouseIds, setManagedWarehouseIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [doneIds, setDoneIds] = useState<string[]>([])
  const supabase = createClient()
  const isPersonTransfer = !isDelivery && Boolean(fromEmployeeId)

  useEffect(() => {
    if (!open || selectedProductIds.length === 0) {
      if (!open) resetModal()
      return
    }
    void loadCatalog()
  }, [open, selectedProductIds.join('|')])

  const resetModal = () => {
    setFromEmployeeId('')
    setFromEmployeeOpen(true)
    setFromEmployeeSearch('')
    setSelectedEmployeeId('')
    setEmployeeSearch('')
    setEmployeeOpen(true)
    setProductDetails([])
    setCatalogById(new Map())
    setSites([])
    setTargetWarehouseId('')
    setManagedWarehouseIds([])
    setDoneIds([])
  }

  const allowedSet = useMemo(
    () => new Set((allowedWarehouseIds || []).filter(Boolean)),
    [allowedWarehouseIds?.join('|')]
  )

  const loadCatalog = async () => {
    setLoadingData(true)
    try {
      const [{ data: employeeRows, error: employeeError }, products, { data: siteRows, error: siteError }] =
        await Promise.all([
          supabase
            .from('employees')
            .select('id, first_name, work_email, department, position')
            .order('first_name'),
          rowsInChunks<{
            id: string
            name: string
            unit: string | null
            sku: string | null
            product_type: string | null
            unit_price: number | null
            currency: string | null
            brand: { name: string } | { name: string }[] | null
          }>(selectedProductIds, (chunk) =>
            supabase.from('products').select('id, name, unit, sku, product_type, unit_price, currency, brand:brands(name)').in('id', chunk)
          ),
          supabase.from('sites').select('id, name').order('name'),
        ])

      if (employeeError) throw employeeError
      if (siteError) throw siteError

      setEmployees((employeeRows || []) as Employee[])
      setSites((siteRows || []).filter((site) => site.name))

      const order = new Map(selectedProductIds.map((id, index) => [id, index]))
      const catalog = new Map<string, ProductCatalogRow>()
      for (const product of products || []) {
        catalog.set(product.id, catalogFromProduct(product))
      }
      setCatalogById(catalog)

      if (fromEmployeeId) {
        const from = ((employeeRows || []) as Employee[]).find((employee) => employee.id === fromEmployeeId)
        if (from) {
          await applyFromEmployee(from, catalog, order)
          return
        }
      }
      await applyWarehouseStock(catalog, order)
    } catch (error) {
      console.error('Toplu zimmet verisi yüklenemedi:', error)
      showToast('Zimmet bilgileri yüklenemedi', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  const applyWarehouseStock = async (
    catalog: Map<string, ProductCatalogRow>,
    order: Map<string, number>
  ) => {
    const [stocks, zimmets] = await Promise.all([
      rowsInChunks<{
        id: string
        product_id: string | null
        warehouse_id: string | null
        quantity: number | null
        warehouse: { name: string } | { name: string }[] | null
      }>(selectedProductIds, (chunk) => {
        let query = supabase
          .from('warehouse_stock')
          .select('id, product_id, warehouse_id, quantity, warehouse:sites!warehouse_stock_warehouse_id_fkey(name)')
          .in('product_id', chunk)
          .is('user_id', null)
          .gt('quantity', 0)
        if (allowedSet.size === 1) {
          query = query.eq('warehouse_id', [...allowedSet][0])
        } else if (allowedSet.size > 1) {
          query = query.in('warehouse_id', [...allowedSet])
        }
        return query
      }),
      rowsInChunks<{ product_id: string | null; source_warehouse_id: string | null; quantity: number | null }>(
        selectedProductIds,
        (chunk) => {
          let query = supabase
            .from('user_inventory')
            .select('product_id, source_warehouse_id, quantity')
            .in('product_id', chunk)
            .eq('status', 'active')
          if (allowedSet.size === 1) {
            query = query.eq('source_warehouse_id', [...allowedSet][0])
          } else if (allowedSet.size > 1) {
            query = query.in('source_warehouse_id', [...allowedSet])
          }
          return query
        }
      ),
    ])

    const zimmetByKey = new Map<string, number>()
    for (const row of zimmets || []) {
      if (!row.product_id || !row.source_warehouse_id) continue
      const key = `${row.product_id}:${row.source_warehouse_id}`
      zimmetByKey.set(key, (zimmetByKey.get(key) || 0) + (Number(row.quantity) || 0))
    }

    const stocksByProduct = new Map<string, WarehouseOption[]>()
    for (const row of stocks || []) {
      const warehouse = Array.isArray(row.warehouse) ? row.warehouse[0] : row.warehouse
      const warehouseId = row.warehouse_id
      if (!row.product_id || !warehouseId) continue
      const shelf = Number(row.quantity) || 0
      const assigned = zimmetByKey.get(`${row.product_id}:${warehouseId}`) || 0
      const available = Math.max(0, shelf - assigned)
      if (available <= 0) continue
      const list = stocksByProduct.get(row.product_id) || []
      list.push({
        id: row.id,
        warehouseId,
        name: warehouse?.name || 'Depo',
        available,
      })
      stocksByProduct.set(row.product_id, list)
    }

    const details = selectedProductIds
      .map((productId) => catalog.get(productId))
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .map((product) => {
        const warehouses = (stocksByProduct.get(product.productId) || []).sort((a, b) => {
          if (isSanayiDepo(a.name) && !isSanayiDepo(b.name)) return -1
          if (!isSanayiDepo(a.name) && isSanayiDepo(b.name)) return 1
          return a.name.localeCompare(b.name, 'tr')
        })
        return {
          ...product,
          quantity: 1,
          warehouseId: defaultSourceWarehouseId(warehouses),
          warehouses,
        }
      })
      .sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0))

    setProductDetails(details)
  }

  const applyFromEmployee = async (
    employee: Employee,
    catalog: Map<string, ProductCatalogRow>,
    order: Map<string, number>
  ) => {
    const zimmets = await fetchActiveZimmetsForEmployee(employee, {
      warehouseIds: allowedSet.size ? [...allowedSet] : undefined,
    })
    const nextCatalog = new Map(catalog)

    const missingIds = [...new Set(zimmets.map((row) => row.product_id))].filter((id) => !nextCatalog.has(id))
    if (missingIds.length > 0) {
      const extra = await rowsInChunks<{
        id: string
        name: string
        unit: string | null
        sku: string | null
        product_type: string | null
        unit_price: number | null
        currency: string | null
        brand: { name: string } | { name: string }[] | null
      }>(missingIds, (chunk) =>
        supabase.from('products').select('id, name, unit, sku, product_type, unit_price, currency, brand:brands(name)').in('id', chunk)
      )
      for (const product of extra) {
        nextCatalog.set(product.id, catalogFromProduct(product))
      }
      setCatalogById(nextCatalog)
    }

    const grouped = new Map<
      string,
      { productId: string; warehouseId: string; name: string; available: number; inventoryIds: string[] }
    >()
    for (const row of zimmets) {
      if (!row.source_warehouse_id) continue
      const key = `${row.product_id}:${row.source_warehouse_id}`
      const existing = grouped.get(key)
      if (existing) {
        existing.available += row.quantity
        existing.inventoryIds.push(row.id)
        continue
      }
      grouped.set(key, {
        productId: row.product_id,
        warehouseId: row.source_warehouse_id,
        name: row.warehouse_name || 'Depo',
        available: row.quantity,
        inventoryIds: [row.id],
      })
    }

    const details: ProductDetail[] = []
    for (const group of grouped.values()) {
      const product = nextCatalog.get(group.productId)
      if (!product) continue
      details.push({
        ...product,
        id: `${group.productId}::${group.warehouseId}`,
        quantity: group.available,
        warehouseId: group.warehouseId,
        warehouses: [
          {
            id: group.warehouseId,
            warehouseId: group.warehouseId,
            name: group.name,
            available: group.available,
          },
        ],
        inventoryIds: group.inventoryIds,
      })
    }
    details.sort((a, b) => {
      const aSel = order.has(a.productId) ? 0 : 1
      const bSel = order.has(b.productId) ? 0 : 1
      if (aSel !== bSel) return aSel - bSel
      return (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0) || a.name.localeCompare(b.name, 'tr')
    })

    setProductDetails(details)
  }

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId)
  const fromEmployee = employees.find((employee) => employee.id === fromEmployeeId)

  const fromResults = useMemo(
    () => employeeResultsOf(employees, fromEmployeeSearch, selectedEmployeeId),
    [employees, fromEmployeeSearch, selectedEmployeeId]
  )
  const employeeResults = useMemo(
    () => employeeResultsOf(employees, employeeSearch, fromEmployeeId),
    [employees, employeeSearch, fromEmployeeId]
  )

  const visibleSites = allowedSet.size
    ? sites.filter((site) => allowedSet.has(site.id))
    : sites
  const targetWarehouse = sites.find((site) => site.id === targetWarehouseId)

  const selectFromEmployee = async (employee: Employee) => {
    if (employee.id === selectedEmployeeId) {
      showToast('Kimden ve kime aynı kişi olamaz', 'error')
      return
    }
    setFromEmployeeId(employee.id)
    setFromEmployeeOpen(false)
    setFromEmployeeSearch('')
    setLoadingData(true)
    try {
      const order = new Map(selectedProductIds.map((id, index) => [id, index]))
      await applyFromEmployee(employee, catalogById, order)
    } catch (error) {
      console.error('Kişi zimmetleri yüklenemedi:', error)
      showToast('Bu kişinin zimmetleri yüklenemedi', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  const resolveManagedWarehouse = async (employee: Employee) => {
    const email = employee.work_email?.trim()
    if (!email) {
      setManagedWarehouseIds([])
      setTargetWarehouseId('')
      return
    }

    const [{ data: byEmail }, { data: profile }] = await Promise.all([
      supabase
        .from('warehouse_access')
        .select('warehouse_id')
        .ilike('email', email)
        .in('access_level', ['manage', 'operate'])
        .not('warehouse_id', 'is', null),
      supabase.from('profiles').select('id').ilike('email', email).maybeSingle(),
    ])

    let byUser: { warehouse_id: string | null }[] = []
    if (profile?.id) {
      const { data } = await supabase
        .from('warehouse_access')
        .select('warehouse_id')
        .eq('user_id', profile.id)
        .in('access_level', ['manage', 'operate'])
        .not('warehouse_id', 'is', null)
      byUser = data || []
    }

    const managed = [
      ...new Set(
        [...(byEmail || []), ...byUser]
          .map((row) => row.warehouse_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]
    const ordered = sites
      .filter((site) => managed.includes(site.id))
      .map((site) => site.id)
    const fallback = managed.filter((id) => !ordered.includes(id))
    const managedIds = [...ordered, ...fallback]
    const scopedIds = allowedSet.size
      ? managedIds.filter((id) => allowedSet.has(id))
      : managedIds
    const nextIds = scopedIds.length > 0 ? scopedIds : allowedSet.size ? [...allowedSet] : managedIds
    setManagedWarehouseIds(nextIds)
    setTargetWarehouseId(nextIds[0] || '')
  }

  const clearFromEmployee = async () => {
    setFromEmployeeId('')
    setFromEmployeeOpen(true)
    setFromEmployeeSearch('')
    setLoadingData(true)
    try {
      const order = new Map(selectedProductIds.map((id, index) => [id, index]))
      await applyWarehouseStock(catalogById, order)
      if (selectedEmployee) await resolveManagedWarehouse(selectedEmployee)
    } catch (error) {
      console.error('Depo stoku yüklenemedi:', error)
      showToast('Depo stoku yüklenemedi', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  const selectEmployee = async (employee: Employee) => {
    if (employee.id === fromEmployeeId) {
      showToast('Kimden ve kime aynı kişi olamaz', 'error')
      return
    }
    setSelectedEmployeeId(employee.id)
    setEmployeeOpen(false)
    setEmployeeSearch('')

    if (fromEmployeeId) return
    await resolveManagedWarehouse(employee)
  }

  const updateProduct = (productId: string, patch: Partial<ProductDetail>) => {
    setProductDetails((current) =>
      current.map((product) => (product.id === productId ? { ...product, ...patch } : product))
    )
  }

  const removeProduct = (productId: string) => {
    setProductDetails((current) => current.filter((product) => product.id !== productId))
  }

  const rowIssue = (product: ProductDetail) => {
    if (!isPersonTransfer && !targetWarehouseId) {
      return isDelivery ? 'Teslim deposu seçin' : 'Zimmet deposu seçin'
    }
    const plan = stockPlan(product, isPersonTransfer ? product.warehouseId : targetWarehouseId)
    if (!plan.source || plan.available <= 0) {
      return isPersonTransfer ? 'Bu kişide zimmet yok' : 'Boş stok yok'
    }
    if (!(product.quantity > 0)) return 'Miktar girin'
    if (product.quantity > plan.available) return `En fazla ${plan.available}`
    return null
  }

  const issueCount = productDetails.filter((product) => rowIssue(product)).length
  const canSubmit =
    Boolean(selectedEmployeeId) &&
    (isPersonTransfer || Boolean(targetWarehouseId)) &&
    productDetails.length > 0 &&
    issueCount === 0 &&
    !loadingData &&
    fromEmployeeId !== selectedEmployeeId

  const handleCreateBulkZimmet = async () => {
    if (!selectedEmployee) {
      showToast(isDelivery ? 'Teslim alacak kişiyi seçin' : 'Zimmetlenecek kişiyi seçin', 'error')
      return
    }
    if (isPersonTransfer && !fromEmployee) {
      showToast('Aktarım için kaynak kişiyi seçin', 'error')
      return
    }
    const blocked = productDetails.find((product) => rowIssue(product))
    if (blocked) {
      showToast(`${blocked.name}: ${rowIssue(blocked)}`, 'error')
      return
    }

    try {
      setLoading(true)
      setDoneIds([])
      const delivered: { detail: ProductDetail; sourceName: string }[] = []

      if (isPersonTransfer && fromEmployee) {
        for (const detail of productDetails) {
          const ids = detail.inventoryIds || []
          if (ids.length === 0) throw new Error(`${detail.name} için zimmet kaydı yok`)
          await changeZimmetAssignment({
            inventoryId: ids[0],
            inventoryIds: ids,
            newEmployee: selectedEmployee,
            quantity: detail.quantity,
          })
          delivered.push({ detail, sourceName: detail.warehouses[0]?.name || 'Depo' })
          setDoneIds((current) => [...current, detail.id])
        }
        showToast(
          `${productDetails.length} ürün ${employeeLabel(fromEmployee)} üzerinden ${employeeLabel(selectedEmployee)} adına aktarıldı`,
          'success'
        )
        onSuccess()
        onOpenChange(false)
        return
      }

      for (const detail of productDetails) {
        const plan = stockPlan(detail, targetWarehouseId)
        if (!plan.source) throw new Error(`${detail.name} için boş stok yok`)
        if (plan.source.warehouseId !== targetWarehouseId) {
          await transferStock(
            detail.productId,
            plan.source.warehouseId,
            targetWarehouseId,
            detail.quantity,
            isDelivery
              ? `${employeeLabel(selectedEmployee)} teslimi için ${plan.source.name} → ${targetWarehouse?.name || 'depo'}`
              : `${employeeLabel(selectedEmployee)} zimmeti için ${plan.source.name} → ${targetWarehouse?.name || 'depo'}`
          )
        }
        if (!isDelivery) {
          await assignZimmetInWarehouse({
            productId: detail.productId,
            productName: detail.name,
            productUnit: detail.unit,
            warehouseId: targetWarehouseId,
            quantity: detail.quantity,
            employee: selectedEmployee,
            reason: plan.source.warehouseId === targetWarehouseId
              ? 'Toplu zimmet (stok depoda kaldı)'
              : `Toplu zimmet · ${plan.source.name} deposundan aktarıldı`,
          })
        }
        delivered.push({ detail, sourceName: plan.source.name })
        setDoneIds((current) => [...current, detail.id])
      }

      if (isDelivery) {
        await writeDeliveryReport(delivered)
      }

      showToast(
        isDelivery
          ? `${productDetails.length} ürün ${employeeLabel(selectedEmployee)} adına teslim edildi`
          : `${productDetails.length} ürün ${employeeLabel(selectedEmployee)} adına zimmetlendi`,
        'success'
      )
      onSuccess()
      onOpenChange(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : isDelivery ? 'Teslim işlemi başarısız oldu' : 'Zimmet işlemi başarısız oldu'
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const writeDeliveryReport = async (delivered: { detail: ProductDetail; sourceName: string }[]) => {
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    let exportedByDisplayName = user?.email ?? '—'
    let exportedByEmail = user?.email ?? undefined
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.full_name?.trim()) exportedByDisplayName = profile.full_name.trim()
      else if (profile?.email) exportedByDisplayName = profile.email
      exportedByEmail = profile?.email || user.email || undefined
    }

    const destination = targetWarehouse?.name || 'Depo'
    const person = employeeLabel(selectedEmployee!)
    const payload = {
      docTitleSuffix: `Teslim raporu — ${person}`,
      titleMain: 'TESLİM RAPORU',
      titleSub: 'Depodan teslim tutanağı.',
      assignedPersonName: person,
      assignedPersonEmailLine: selectedEmployee?.work_email || '',
      exportedByDisplayName,
      exportedByEmail,
      generatedAtLabel: new Date().toLocaleString('tr-TR'),
      warehouseScopeLine: `Teslim deposu: ${destination}`,
      rowCountNote: `${delivered.length} ürün teslim edilmiştir`,
      rows: delivered.map(({ detail, sourceName }) => ({
        productName: detail.name,
        sku: detail.sku,
        brand: detail.brand,
        unit: detail.unit,
        quantity: detail.quantity,
        unitPrice: detail.unitPrice,
        currency: detail.currency,
        productType: detail.productType,
        sourceWarehouse: sourceName === destination ? destination : `${sourceName} → ${destination}`,
        serialNumber: '',
      })),
      heading: 'Teslim edilen ürünler',
      signLeftRole: 'Teslim eden',
      signRightRole: 'Teslim alan',
      signRightNote: 'Ürünleri teslim aldım.',
      footerNote: 'Teslim raporu — Satın Alma / Envanter — Dovec',
      declaration:
        'İşbu rapor ile yukarıda dökümü verilen malzeme ve ürünleri eksiksiz teslim aldığımı beyan ederim.',
    }
    const { downloadZimmetAssignmentListPdf } = await import('@/lib/pdf/zimmetAssignmentListPdf')
    const { recordZimmetOperation } = await import('@/services/zimmet-operations.service')
    await recordZimmetOperation({
      operationType: 'delivery',
      personName: person,
      personEmail: selectedEmployee?.work_email,
      siteId: targetWarehouseId,
      snapshot: payload,
    })
    await downloadZimmetAssignmentListPdf(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,840px)] w-full max-w-4xl flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0">
        <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
          <DialogTitle className="text-lg font-semibold text-gray-950">
            {isDelivery ? 'Toplu teslim' : isPersonTransfer ? 'Toplu zimmet aktarımı' : 'Toplu zimmet'}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {isDelivery
              ? `${selectedProductIds.length} ürün teslim edilir. Ürün başka depodaysa seçilen teslim deposuna aktarılır ve teslim raporu iner.`
              : isPersonTransfer
                ? `${employeeLabel(fromEmployee!)} üzerindeki tüm zimmetler (${productDetails.length} ürün) ${selectedEmployee ? employeeLabel(selectedEmployee) : 'seçilen kişiye'} aktarılır. Depo stoğu değişmez.`
                : `${selectedProductIds.length} ürün tek kişiye yazılır. Kimden seçerseniz o kişinin tüm zimmeti listelenir; boş bırakırsanız depo stoğundan yazılır.`}
          </p>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-b border-gray-100 bg-gray-50/70 p-5 lg:border-b-0 lg:border-r">
            {!isDelivery && (
              <PersonPicker
                label="Kimden"
                hint="Seçilince bu kişinin tüm zimmetleri gelir, yalnızca açık sayfa değil. Boş bırakılırsa depo stoğundan yazılır."
                selected={fromEmployee}
                open={fromEmployeeOpen}
                onToggle={() => setFromEmployeeOpen(true)}
                search={fromEmployeeSearch}
                onSearch={setFromEmployeeSearch}
                results={fromResults}
                employeeCount={employees.length}
                onSelect={(employee) => void selectFromEmployee(employee)}
                onClear={() => void clearFromEmployee()}
                placeholder="Kaynak kişiyi ara"
                emptyLabel="Eşleşen çalışan yok"
                disabled={loadingData}
              />
            )}

            {!isDelivery && fromEmployee && selectedEmployee && (
              <div className="hidden items-center gap-2 text-xs text-gray-500 lg:flex">
                <span className="truncate">{employeeLabel(fromEmployee)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employeeLabel(selectedEmployee)}</span>
              </div>
            )}

            <PersonPicker
              label={isDelivery ? 'Kişi' : 'Kime'}
              selected={selectedEmployee}
              open={employeeOpen}
              onToggle={() => setEmployeeOpen(true)}
              search={employeeSearch}
              onSearch={setEmployeeSearch}
              results={employeeResults}
              employeeCount={employees.length}
              onSelect={(employee) => void selectEmployee(employee)}
              placeholder="Hedef kişiyi ara"
              emptyLabel="Eşleşen çalışan yok"
              disabled={loadingData}
            />

            {selectedEmployee && !isPersonTransfer && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  {isDelivery ? 'Teslim deposu' : 'Zimmet deposu'}
                </div>
                <select
                  value={targetWarehouseId}
                  onChange={(event) => setTargetWarehouseId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950"
                >
                  <option value="">Depo seçin</option>
                  {visibleSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                      {managedWarehouseIds.includes(site.id) ? ' · sorumlu' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-gray-500">
                  {managedWarehouseIds.length > 0
                    ? 'Kişinin yönettiği depo seçili. Gerekirse değiştirebilirsiniz.'
                    : 'Bu kişinin yönettiği depo yok. Depoyu buradan seçin.'}
                </p>
              </div>
            )}
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Package className="h-4 w-4 text-gray-500" />
                Ürünler
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {productDetails.length}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              {loadingData ? (
                <div className="flex h-40 items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ürünler hazırlanıyor
                </div>
              ) : productDetails.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">
                  {isPersonTransfer
                    ? 'Bu kişide seçilen ürünlerden zimmet yok'
                    : isDelivery
                      ? 'Teslim edilecek ürün kalmadı'
                      : 'Zimmetlenecek ürün kalmadı'}
                </p>
              ) : (
                <div className="space-y-2">
                  {productDetails.map((product) => {
                    const plan = stockPlan(product, isPersonTransfer ? product.warehouseId : targetWarehouseId)
                    const issue = rowIssue(product)
                    const done = doneIds.includes(product.id)
                    const showIssue = Boolean(issue && (isPersonTransfer || targetWarehouseId))
                    const subtitle = done
                      ? isPersonTransfer
                        ? 'Aktarıldı'
                        : isDelivery
                          ? 'Teslim edildi'
                          : 'Zimmet yazıldı'
                      : isPersonTransfer
                        ? `${plan.source?.name || 'Depo'} · ${plan.available} ${product.unit} aktarılabilir`
                        : !targetWarehouse
                          ? isDelivery
                            ? 'Teslim deposu seçilince aktarım burada görünür'
                            : 'Zimmet deposu seçilince aktarım burada görünür'
                          : plan.moves && plan.source
                            ? `${plan.source.name} → ${targetWarehouse.name} · ${plan.available} ${product.unit}`
                            : plan.source
                              ? `${targetWarehouse.name} · ${plan.available} ${product.unit} ${isDelivery ? 'teslim edilebilir' : 'zimmetlenebilir'}`
                              : 'Boş stok yok'
                    return (
                      <div
                        key={product.id}
                        className={`grid grid-cols-1 items-center gap-3 rounded-2xl border px-3 py-3 sm:grid-cols-[minmax(0,1fr)_180px_132px_28px] ${
                          showIssue ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-950">{product.name}</p>
                          <p className="text-xs text-gray-500">{subtitle}</p>
                        </div>

                        <select
                          value={product.warehouseId}
                          onChange={(event) => updateProduct(product.id, { warehouseId: event.target.value })}
                          disabled={loading || isPersonTransfer || product.warehouses.length === 0}
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-2 text-sm text-gray-950"
                        >
                          {product.warehouses.length === 0 ? (
                            <option value="">{isPersonTransfer ? 'Zimmet yok' : 'Depoda stok yok'}</option>
                          ) : (
                            product.warehouses.map((warehouse) => (
                              <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                                {warehouse.name} · {warehouse.available} {product.unit}
                              </option>
                            ))
                          )}
                        </select>

                        <div className="flex h-10 items-center rounded-xl border border-gray-200 bg-white">
                          <button
                            type="button"
                            className="flex h-full w-9 items-center justify-center text-gray-500 hover:text-gray-950"
                            onClick={() =>
                              updateProduct(product.id, { quantity: Math.max(1, product.quantity - 1) })
                            }
                            disabled={loading}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={plan.available || undefined}
                            value={product.quantity}
                            onChange={(event) =>
                              updateProduct(product.id, { quantity: Number(event.target.value) || 0 })
                            }
                            className="h-full w-full border-0 bg-transparent text-center text-sm font-medium text-gray-950 outline-none"
                          />
                          <button
                            type="button"
                            className="flex h-full w-9 items-center justify-center text-gray-500 hover:text-gray-950"
                            onClick={() =>
                              updateProduct(product.id, {
                                quantity: plan.available
                                  ? Math.min(plan.available, product.quantity + 1)
                                  : product.quantity + 1,
                              })
                            }
                            disabled={loading || (plan.available > 0 && product.quantity >= plan.available)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          aria-label="Ürünü listeden çıkar"
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </button>

                        {showIssue && (
                          <p className="text-xs text-red-600 sm:col-span-4">{issue}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-gray-100 bg-white px-6 py-4 sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {!selectedEmployeeId
              ? isDelivery
                ? 'Önce kişi seçin'
                : 'Önce kime seçin'
              : isPersonTransfer
                ? productDetails.length === 0
                  ? 'Bu kişide aktarılacak zimmet yok'
                  : issueCount > 0
                    ? `${issueCount} üründe miktar düzeltilmeli`
                    : `${productDetails.length} ürün ${employeeLabel(fromEmployee!)} → ${employeeLabel(selectedEmployee!)}`
                : !targetWarehouse
                  ? isDelivery
                    ? 'Teslim deposunu seçin'
                    : 'Zimmet deposunu seçin'
                  : issueCount > 0
                    ? `${issueCount} üründe miktar düzeltilmeli`
                    : isDelivery
                      ? `${productDetails.length} ürün ${employeeLabel(selectedEmployee!)} adına ${targetWarehouse.name} deposuna teslim`
                      : `${productDetails.length} ürün ${employeeLabel(selectedEmployee!)} adına, ${targetWarehouse.name} deposuna`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-11 rounded-xl border-gray-200"
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={handleCreateBulkZimmet}
              disabled={!canSubmit}
              className="h-11 rounded-xl bg-neutral-950 px-5 text-white hover:bg-neutral-800"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isPersonTransfer ? 'Aktarılıyor' : isDelivery ? 'Teslim ediliyor' : 'Yazılıyor'}
                </>
              ) : isPersonTransfer ? (
                'Aktar'
              ) : isDelivery ? (
                'Teslim et'
              ) : (
                'Zimmetle'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
