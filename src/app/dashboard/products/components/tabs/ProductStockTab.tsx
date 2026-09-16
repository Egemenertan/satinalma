/**
 * ProductStockTab Component
 * Stok durumu gösterimi - Ana Depo, Muvakkat Depolar, Kullanıcı Zimmetleri, Toplam
 */

'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Package, ChevronDown, User, Users, Hash, Building2, ArrowRightLeft, Undo2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { groupZimmetsByOwner } from '@/services/zimmet.service'
import { ZimmetActionDialogs, type ZimmetActionTarget } from '../ZimmetActionDialogs'

interface ProductStockTabProps {
  product: any
  stockData: any[]
  totalStock: number
}

interface UserInventory {
  id: string
  quantity: number
  serial_number: string | null
  owner_name: string | null
  owner_email: string | null
  pending_user_name: string | null
  pending_user_email: string | null
  source_warehouse_id: string | null
  source_warehouse?: { id: string; name: string } | null
  user: {
    full_name: string
    email: string
  } | null
  assigned_date: string
  status: string
}


function parseSerialTokens(raw: string | null | undefined): string[] {
  if (!raw || !String(raw).trim()) return []
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const ANA_DEPO_NAMES = ['ana depo', 'sanayi depo']

function normalizeWarehouseName(name: string | null | undefined) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getStockWarehouseName(stock: any): string {
  const wh = Array.isArray(stock?.warehouse) ? stock.warehouse[0] : stock?.warehouse
  return wh?.name || ''
}

function isAnaDepoStock(stock: any) {
  return ANA_DEPO_NAMES.includes(normalizeWarehouseName(getStockWarehouseName(stock)))
}

function mergeConditionBreakdown(a: any, b: any) {
  const merged: Record<string, number> = { ...(a || {}) }
  for (const [key, value] of Object.entries(b || {})) {
    merged[key] = (Number(merged[key]) || 0) + (Number(value) || 0)
  }
  return merged
}

/** Aynı depodaki satırları tek karta indir; 0 stoklu boş kartları gösterme */
function groupWarehouseStocks(stockData: any[] | undefined) {
  const map = new Map<string, any>()
  for (const stock of stockData || []) {
    if (stock?.user_id != null && stock.user_id !== undefined) continue
    const warehouseId = stock.warehouse_id || stock.id
    if (!warehouseId) continue
    const qty = parseFloat(stock.quantity?.toString() || '0') || 0
    const existing = map.get(warehouseId)
    if (!existing) {
      map.set(warehouseId, {
        ...stock,
        quantity: qty,
        condition_breakdown: { ...(stock.condition_breakdown || {}) },
      })
    } else {
      existing.quantity += qty
      existing.condition_breakdown = mergeConditionBreakdown(
        existing.condition_breakdown,
        stock.condition_breakdown
      )
    }
  }
  return [...map.values()].filter((s) => Number(s.quantity) > 0)
}

export function ProductStockTab({ product, stockData, totalStock }: ProductStockTabProps) {
  const queryClient = useQueryClient()
  const [expandedStockIds, setExpandedStockIds] = useState<Set<string>>(new Set())
  const [userInventories, setUserInventories] = useState<UserInventory[]>([])
  const [loadingInventories, setLoadingInventories] = useState(false)
  const [showUserInventories, setShowUserInventories] = useState(true)
  const [serialsByWarehouseId, setSerialsByWarehouseId] = useState<Record<string, string[]>>({})
  const [changeTarget, setChangeTarget] = useState<ZimmetActionTarget | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ZimmetActionTarget | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (product?.id) {
      fetchUserInventories()
      fetchGirisSerialNumbers()
    }
  }, [product?.id])

  const refreshAfterZimmetChange = async () => {
    await fetchUserInventories()
    if (product?.id) {
      queryClient.invalidateQueries({ queryKey: ['product-stock', product.id] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements', product.id] })
      queryClient.invalidateQueries({ queryKey: ['product-inventory', product.id] })
      queryClient.invalidateQueries({ queryKey: ['product-active-zimmets', product.id] })
      queryClient.invalidateQueries({ queryKey: ['product-zimmet-availability', product.id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products-insights-bundle'] })
    }
  }

  const fetchGirisSerialNumbers = async () => {
    if (!product?.id) return
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('serial_number, warehouse_id')
        .eq('product_id', product.id)
        .eq('movement_type', 'giriş')
        .not('serial_number', 'is', null)

      if (error) throw error

      const map: Record<string, Set<string>> = {}
      for (const row of data || []) {
        const wid = row.warehouse_id as string | null
        if (!wid) continue
        if (!map[wid]) map[wid] = new Set()
        for (const token of parseSerialTokens(row.serial_number as string)) {
          map[wid].add(token)
        }
      }
      setSerialsByWarehouseId(
        Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, 'tr'))]))
      )
    } catch (e) {
      console.error('Giriş seri numaraları yüklenemedi:', e)
    }
  }

  const fetchUserInventories = async () => {
    try {
      setLoadingInventories(true)
      const { data, error } = await supabase
        .from('user_inventory')
        .select(`
          id,
          quantity,
          serial_number,
          assigned_date,
          status,
          owner_name,
          owner_email,
          pending_user_name,
          pending_user_email,
          source_warehouse_id,
          user:profiles!user_inventory_user_id_fkey(full_name, email),
          source_warehouse:sites!user_inventory_source_warehouse_id_fkey(id, name)
        `)
        .eq('product_id', product.id)
        .eq('status', 'active')
        .order('assigned_date', { ascending: false })

      if (error) throw error

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        user: Array.isArray(item.user) ? item.user[0] : item.user,
        source_warehouse: Array.isArray(item.source_warehouse)
          ? item.source_warehouse[0]
          : item.source_warehouse,
      }))

      setUserInventories(formattedData)
    } catch (error) {
      console.error('Kullanıcı zimmetleri yüklenemedi:', error)
    } finally {
      setLoadingInventories(false)
    }
  }

  const toggleStockExpand = (stockId: string) => {
    setExpandedStockIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(stockId)) {
        newSet.delete(stockId)
      } else {
        newSet.add(stockId)
      }
      return newSet
    })
  }

  const groupedUserInventories = groupZimmetsByOwner(userInventories)
  const totalUserInventory = groupedUserInventories.reduce(
    (sum, inv) => sum + parseFloat(inv.quantity.toString()),
    0
  )

  // Sadece ana depo stoklarını göster (user_id: null olanlar) — aynı depo tek kart
  const warehouseStocks = groupWarehouseStocks(stockData)

  if ((!warehouseStocks || warehouseStocks.length === 0) && userInventories.length === 0 && !loadingInventories) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Package className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-500 text-lg font-medium">Stok bilgisi bulunamadı</p>
      </div>
    )
  }

  const anaDepo = warehouseStocks.find((s) => isAnaDepoStock(s))
  const muvakkatDepolar = warehouseStocks.filter((s) => !isAnaDepoStock(s))
  
  // Ana depo toplam stoku (sadece user_id: null olanlar)
  const totalWarehouseStock = warehouseStocks.reduce(
    (sum: number, stock: any) => sum + (parseFloat(stock.quantity?.toString() || '0') || 0),
    0
  )
  
  // Depo stoğu fiziksel miktardır; zimmet ayrı sorumluluk kaydıdır (toplama eklenmez)
  const totalAvailable = totalWarehouseStock
  const totalZimmetli = totalUserInventory

  const zimmetsForWarehouse = (warehouseId: string | null | undefined) => {
    if (!warehouseId) return []
    return groupZimmetsByOwner(
      userInventories.filter((inv) => inv.source_warehouse_id === warehouseId)
    )
  }

  const serialsForWarehouse = (warehouseId: string | null | undefined) => {
    if (!warehouseId) return []
    return serialsByWarehouseId[warehouseId] || []
  }

  const allGirisSerialsUnique = [...new Set(Object.values(serialsByWarehouseId).flat())].sort((a, b) =>
    a.localeCompare(b, 'tr')
  )

  return (
    <>
      {allGirisSerialsUnique.length > 0 && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200">
            <Hash className="h-4 w-4 text-slate-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Depo girişlerinde kayıtlı seri numaraları
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {allGirisSerialsUnique.map((sn) => (
                <span
                  key={sn}
                  className="inline-flex text-xs font-mono bg-white text-slate-800 px-2 py-1 rounded-lg border border-slate-200"
                >
                  {sn}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ana Depo */}
      {anaDepo && (
        <div className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {getStockWarehouseName(anaDepo) || 'Ana Depo'}
                </h3>
                <p className="text-gray-500 text-xs mt-1">Merkez Deposu</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {parseFloat(anaDepo.quantity.toString()).toLocaleString('tr-TR')}
                </p>
                <p className="text-gray-500 text-xs font-medium">{product?.unit || ''}</p>
              </div>
            </div>
            {serialsForWarehouse(anaDepo.warehouse_id).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bu depodaki giriş serileri</p>
                <div className="flex flex-wrap gap-1.5">
                  {serialsForWarehouse(anaDepo.warehouse_id).map((sn) => (
                    <span
                      key={sn}
                      className="text-xs font-mono bg-gray-50 text-gray-900 px-2 py-1 rounded-lg border border-gray-200"
                    >
                      {sn}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {zimmetsForWarehouse(anaDepo.warehouse_id).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {zimmetsForWarehouse(anaDepo.warehouse_id).map((inv) => (
                  <span
                    key={inv.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900"
                  >
                    <User className="h-3 w-3 shrink-0" />
                    <span className="font-medium truncate max-w-[10rem]">
                      {inv.owner_name || inv.user?.full_name || 'Zimmetli'}
                    </span>
                    <span className="text-emerald-700/80">
                      · {parseFloat(inv.quantity.toString()).toLocaleString('tr-TR')}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Duruma Göre Breakdown */}
          {(() => {
            const breakdown = (anaDepo.condition_breakdown as any) || {}
            const activeConditions = Object.entries(breakdown).filter(
              ([_, qty]) => Number(qty) > 0
            )

            if (activeConditions.length === 0) return null

            return (
              <div className="p-6">
                <div className="space-y-2">
                  {activeConditions.map(([condition, qty]) => {
                    const conditionConfig = {
                      yeni: { label: 'Yeni' },
                      kullanılmış: { label: 'Kullanılmış' },
                      hek: { label: 'HEK' },
                      arızalı: { label: 'Arızalı' },
                    }[condition] || { label: condition }

                    return (
                      <div
                        key={condition}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-600">
                          {conditionConfig.label}
                        </span>
                        <span className="text-base font-semibold text-gray-900">
                          {Number(qty).toLocaleString('tr-TR')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Muvakkat Depolar */}
      {muvakkatDepolar.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-300"></div>
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Muvakkat Depolar</h3>
            <div className="h-px flex-1 bg-gray-300"></div>
          </div>

          {muvakkatDepolar.map((stock) => {
            const breakdown = (stock.condition_breakdown as any) || {}
            const isExpanded = expandedStockIds.has(stock.id)
            const activeConditions = Object.entries(breakdown).filter(
              ([_, qty]) => Number(qty) > 0
            )

            const warehouseZimmetler = zimmetsForWarehouse(stock.warehouse_id)
            const depoStok = parseFloat(stock.quantity.toString())

            return (
              <div
                key={stock.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleStockExpand(stock.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-all"
                >
                  <div className="text-left min-w-0 flex-1 pr-3">
                    <p className="font-semibold text-gray-900 text-base">
                      {stock.warehouse?.name || 'Depo Belirtilmemiş'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Depo stoğu:{' '}
                      <span className="font-semibold text-gray-800">
                        {depoStok.toLocaleString('tr-TR')} {product?.unit || 'adet'}
                      </span>
                    </p>
                    {warehouseZimmetler.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {warehouseZimmetler.map((inv) => (
                          <span
                            key={inv.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900"
                          >
                            <User className="h-3 w-3 shrink-0" />
                            <span className="font-medium truncate max-w-[10rem]">
                              {inv.owner_name || inv.user?.full_name || 'Zimmetli'}
                            </span>
                            <span className="text-emerald-700/80">
                              · {parseFloat(inv.quantity.toString()).toLocaleString('tr-TR')}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1.5">Zimmetli kişi yok</p>
                    )}
                    {serialsForWarehouse(stock.warehouse_id).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {serialsForWarehouse(stock.warehouse_id).map((sn) => (
                          <span
                            key={sn}
                            className="text-[10px] font-mono bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded border border-gray-200"
                          >
                            {sn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {depoStok.toLocaleString('tr-TR')}
                      </p>
                      <p className="text-xs text-gray-500">{product?.unit || ''}</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-200">
                    {activeConditions.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Durum Dağılımı</p>
                        {activeConditions.map(([condition, qty]) => {
                          const conditionConfig =
                            {
                              yeni: { label: 'Yeni' },
                              kullanılmış: { label: 'Kullanılmış' },
                              hek: { label: 'HEK' },
                              arızalı: { label: 'Arızalı' },
                            }[condition] || { label: condition }

                          return (
                            <div
                              key={condition}
                              className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                            >
                              <span className="text-xs font-medium text-gray-700">
                                {conditionConfig.label}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">
                                {Number(qty).toLocaleString('tr-TR')}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {warehouseZimmetler.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                          Zimmetli (bu depoda)
                        </p>
                        {warehouseZimmetler.map((inv) => {
                          const displayName =
                            inv.owner_name || inv.user?.full_name || 'İsimsiz'
                          const displayEmail = inv.owner_email || inv.user?.email || ''
                          const busy = changeTarget?.id === inv.id || removeTarget?.id === inv.id

                          return (
                            <div
                              key={inv.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <User className="w-4 h-4 text-emerald-700 shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-xs font-medium text-gray-900 block truncate">
                                    {displayName}
                                  </span>
                                  {displayEmail && (
                                    <span className="text-xs text-gray-500 block truncate">
                                      {displayEmail}
                                    </span>
                                  )}
                                  {inv.serial_number && (
                                    <span className="text-[10px] font-mono text-gray-700 mt-0.5 block">
                                      Seri: {inv.serial_number}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-semibold text-emerald-800 mr-1">
                                  {parseFloat(inv.quantity.toString()).toLocaleString('tr-TR')}{' '}
                                  {product?.unit || ''}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-xl text-xs border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setChangeTarget(inv)
                                  }}
                                >
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Değiştir
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-xl text-xs border-red-200 bg-white text-red-700 hover:bg-red-50"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setRemoveTarget(inv)
                                  }}
                                >
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Undo2 className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Kaldır
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Kullanıcı Zimmetleri */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Zimmetler</h3>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowUserInventories(!showUserInventories)}
            className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                <Users className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-base">Kimde / hangi depoda</p>
                <p className="text-xs text-gray-500 mt-1">
                  {loadingInventories
                    ? 'Yükleniyor…'
                    : groupedUserInventories.length === 0
                      ? 'Aktif zimmet yok'
                      : `${groupedUserInventories.length} zimmetli kişi`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {totalZimmetli.toLocaleString('tr-TR')}
                </p>
                <p className="text-xs text-gray-500">{product?.unit || ''}</p>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform ${showUserInventories ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {showUserInventories && (
            <div className="border-t border-gray-100">
              {groupedUserInventories.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500">
                  Bu ürün için aktif zimmet kaydı yok.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3 font-medium">Depo</th>
                        <th className="px-4 py-3 font-medium">Zimmetli</th>
                        <th className="px-4 py-3 font-medium">Miktar</th>
                        <th className="px-4 py-3 font-medium">Tarih</th>
                        <th className="px-4 py-3 font-medium text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupedUserInventories.map((inventory) => {
                        const displayName =
                          inventory.owner_name || inventory.user?.full_name || 'İsimsiz'
                        const displayEmail =
                          inventory.owner_email || inventory.user?.email || ''
                        const warehouseName =
                          inventory.source_warehouse?.name ||
                          (inventory.source_warehouse_id ? 'Depo' : 'Kaynak yok')
                        const busy = changeTarget?.id === inventory.id || removeTarget?.id === inventory.id

                        return (
                          <tr key={inventory.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                  <Building2 className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {warehouseName}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                                  <User className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {displayName}
                                  </p>
                                  {displayEmail && (
                                    <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                                  )}
                                  {inventory.serial_number && (
                                    <p className="text-[11px] font-mono text-gray-600 mt-0.5">
                                      SN: {inventory.serial_number}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <span className="text-sm font-bold text-gray-900">
                                {parseFloat(inventory.quantity.toString()).toLocaleString('tr-TR')}
                              </span>
                              <span className="text-xs text-gray-500 ml-1">
                                {product?.unit || 'adet'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle text-xs text-gray-500 whitespace-nowrap">
                              {new Date(inventory.assigned_date).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-xl text-xs border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                                  disabled={busy}
                                  onClick={() => setChangeTarget(inventory)}
                                >
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Değiştir
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-xl text-xs border-red-200 bg-white text-red-700 hover:bg-red-50"
                                  disabled={busy}
                                  onClick={() => setRemoveTarget(inventory)}
                                >
                                  {busy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Undo2 className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  Kaldır
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ZimmetActionDialogs
        productId={product.id}
        productUnit={product?.unit || 'adet'}
        changeTarget={changeTarget}
        removeTarget={removeTarget}
        onCloseChange={() => setChangeTarget(null)}
        onCloseRemove={() => setRemoveTarget(null)}
        onSuccess={refreshAfterZimmetChange}
      />

      {/* Stok Dağılımı Özeti */}
      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Depo stoğu</p>
            <p className="text-2xl font-bold text-green-600">
              {totalAvailable.toLocaleString('tr-TR')}
            </p>
            <p className="text-xs text-gray-500">{product?.unit || ''}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Zimmet kaydı</p>
            <p className="text-2xl font-bold text-primary-600">
              {totalZimmetli.toLocaleString('tr-TR')}
            </p>
            <p className="text-xs text-gray-500">sorumluluk (stoğa eklenmez)</p>
          </div>
        </div>
      </div>

      {/* Toplam Stok */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Toplam depo stoğu</p>
          <p className="font-semibold text-base mt-1">{product?.name}</p>
        </div>
        <p className="text-3xl font-bold">
          {totalAvailable.toLocaleString('tr-TR')}{' '}
          <span className="text-base text-gray-400">{product?.unit || ''}</span>
        </p>
      </div>
    </>
  )
}
