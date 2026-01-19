/**
 * ProductStockTab Component
 * Stok durumu gösterimi - Ana Depo, Muvakkat Depolar, Kullanıcı Zimmetleri, Toplam
 */

'use client'

import { useState, useEffect } from 'react'
import { Package, ChevronDown, ChevronUp, User, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ProductStockTabProps {
  product: any
  stockData: any[]
  totalStock: number
}

interface UserInventory {
  id: string
  quantity: number
  user: {
    full_name: string
    email: string
  }
  assigned_date: string
  status: string
}

export function ProductStockTab({ product, stockData, totalStock }: ProductStockTabProps) {
  const [expandedStockIds, setExpandedStockIds] = useState<Set<string>>(new Set())
  const [userInventories, setUserInventories] = useState<UserInventory[]>([])
  const [loadingInventories, setLoadingInventories] = useState(false)
  const [showUserInventories, setShowUserInventories] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (product?.id) {
      fetchUserInventories()
    }
  }, [product?.id])

  const fetchUserInventories = async () => {
    try {
      setLoadingInventories(true)
      const { data, error } = await supabase
        .from('user_inventory')
        .select(`
          id,
          quantity,
          assigned_date,
          status,
          user:profiles!user_inventory_user_id_fkey(full_name, email)
        `)
        .eq('product_id', product.id)
        .eq('status', 'active')
        .order('assigned_date', { ascending: false })

      if (error) throw error
      
      // Supabase join sonucu tipini düzelt
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        user: Array.isArray(item.user) ? item.user[0] : item.user
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

  const totalUserInventory = userInventories.reduce((sum, inv) => sum + parseFloat(inv.quantity.toString()), 0)

  // Sadece ana depo stoklarını göster (user_id: null olanlar)
  const warehouseStocks = (stockData || []).filter((s: any) => 
    s.user_id === null || s.user_id === undefined
  )

  if (!warehouseStocks || warehouseStocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Package className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-500 text-lg font-medium">Stok bilgisi bulunamadı</p>
      </div>
    )
  }

  const anaDepo = warehouseStocks.find(s => s.warehouse?.name === 'Ana Depo')
  const muvakkatDepolar = warehouseStocks.filter(s => s.warehouse?.name !== 'Ana Depo')
  
  // Ana depo toplam stoku (sadece user_id: null olanlar)
  const totalWarehouseStock = warehouseStocks.reduce(
    (sum: number, stock: any) => sum + (parseFloat(stock.quantity?.toString() || '0') || 0),
    0
  )
  
  console.log('📊 Stok Durumu Tab:', {
    'Toplam Depo Stoku (user_id: null)': totalWarehouseStock,
    'Toplam Zimmet': totalUserInventory,
    'GENEL TOPLAM': totalWarehouseStock + totalUserInventory
  })

  return (
    <>
      {/* Ana Depo */}
      {anaDepo && (
        <div className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Ana Depo</h3>
                <p className="text-gray-500 text-xs mt-1">Merkez Deposu</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {parseFloat(anaDepo.quantity.toString()).toLocaleString('tr-TR')}
                </p>
                <p className="text-gray-500 text-xs font-medium">{product?.unit || ''}</p>
              </div>
            </div>
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

            return (
              <div
                key={stock.id}
                className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <button
                  onClick={() => toggleStockExpand(stock.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-all"
                >
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 text-base">
                      {stock.warehouse?.name || 'Depo Belirtilmemiş'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Min: {stock.min_stock_level || 0} | Max: {stock.max_stock_level || '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {parseFloat(stock.quantity.toString()).toLocaleString('tr-TR')}
                      </p>
                      <p className="text-xs text-gray-500">{product?.unit || ''}</p>
                    </div>
                    {activeConditions.length > 0 && (
                      isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )
                    )}
                  </div>
                </button>

                {isExpanded && activeConditions.length > 0 && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-200">
                    <div className="space-y-2 mt-4">
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Kullanıcı Zimmetleri */}
      {userInventories.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-300"></div>
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">Kullanıcı Zimmetleri</h3>
            <div className="h-px flex-1 bg-gray-300"></div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowUserInventories(!showUserInventories)}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-base">
                    Zimmetli Kullanıcılar
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {userInventories.length} kullanıcıda zimmetli
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {totalUserInventory.toLocaleString('tr-TR')}
                  </p>
                  <p className="text-xs text-gray-500">{product?.unit || ''}</p>
                </div>
                {showUserInventories ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {showUserInventories && (
              <div className="border-t border-gray-200">
                <div className="divide-y divide-gray-100">
                  {userInventories.map((inventory) => (
                    <div
                      key={inventory.id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {inventory.user?.full_name || 'İsimsiz'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {inventory.user?.email}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(inventory.assigned_date).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            {parseFloat(inventory.quantity.toString()).toLocaleString('tr-TR')}
                          </p>
                          <p className="text-xs text-gray-500">{product?.unit || ''}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stok Dağılımı Özeti */}
      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Depolarda</p>
            <p className="text-2xl font-bold text-gray-900">
              {totalWarehouseStock.toLocaleString('tr-TR')}
            </p>
            <p className="text-xs text-gray-500">{product?.unit || ''}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600 mb-1">Zimmetli</p>
            <p className="text-2xl font-bold text-gray-900">
              {totalUserInventory.toLocaleString('tr-TR')}
            </p>
            <p className="text-xs text-gray-500">{product?.unit || ''}</p>
          </div>
        </div>
      </div>

      {/* Toplam Stok */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Toplam Stok</p>
          <p className="font-semibold text-base mt-1">{product?.name}</p>
        </div>
        <p className="text-3xl font-bold">
          {(totalWarehouseStock + totalUserInventory).toLocaleString('tr-TR')} <span className="text-base text-gray-400">{product?.unit || ''}</span>
        </p>
      </div>
    </>
  )
}
