'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Package, 
  Check,
  AlertCircle,
  Search,
  Users,
  Loader2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buildDovecGroupWorkEmailFromDisplayName } from '@/lib/dovec-work-email'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Employee {
  id: string
  first_name: string
  work_email: string
}

interface Product {
  id: string
  name: string
  unit: string
  category: string | null
  product_type: string | null
}

interface WarehouseStock {
  id: string
  warehouse_id: string | null
  quantity: number
  warehouse: {
    name: string
  } | null
}

interface ProductDetail {
  id: string
  name: string
  unit: string
  quantity: number
  warehouseId: string
  availableStock: number
  warehouseStocks: WarehouseStock[]
}

interface BulkZimmetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  selectedProductIds: string[]
}

export default function BulkZimmetModal({
  open,
  onOpenChange,
  onSuccess,
  showToast,
  selectedProductIds
}: BulkZimmetModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open && selectedProductIds.length > 0) {
      fetchEmployees()
      fetchProductDetails()
    } else if (!open) {
      resetModal()
    }
  }, [open, selectedProductIds])

  const resetModal = () => {
    setSelectedEmployeeId('')
    setEmployeeSearch('')
    setProductDetails([])
  }

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, work_email')
        .order('first_name')

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Çalışanlar yüklenemedi:', error)
      showToast('Çalışanlar yüklenemedi', 'error')
    }
  }

  const fetchProductDetails = async () => {
    try {
      setLoadingData(true)
      
      const details: ProductDetail[] = []
      
      for (const productId of selectedProductIds) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, unit, category, product_type')
          .eq('id', productId)
          .single()

        if (productError || !product) continue

        const { data: stocks, error: stockError } = await supabase
          .from('warehouse_stock')
          .select(`
            id,
            warehouse_id,
            quantity,
            warehouse:sites!warehouse_stock_warehouse_id_fkey(name)
          `)
          .eq('product_id', productId)
          .is('user_id', null)
          .gt('quantity', 0)

        if (stockError) {
          console.error('Stok bilgisi alınamadı:', stockError)
        }

        const formattedStocks = (stocks || []).map((item: any) => ({
          ...item,
          warehouse: Array.isArray(item.warehouse) ? item.warehouse[0] : item.warehouse
        }))

        const firstStock = formattedStocks.length > 0 ? formattedStocks[0] : null

        details.push({
          id: product.id,
          name: product.name,
          unit: product.unit || 'adet',
          quantity: 1,
          warehouseId: firstStock?.warehouse_id || '',
          availableStock: firstStock ? parseFloat(firstStock.quantity.toString()) : 0,
          warehouseStocks: formattedStocks
        })
      }

      setProductDetails(details)
    } catch (error) {
      console.error('Ürün detayları yüklenemedi:', error)
      showToast('Ürün detayları yüklenemedi', 'error')
    } finally {
      setLoadingData(false)
    }
  }

  const updateProductDetail = (productId: string, field: keyof ProductDetail, value: any) => {
    setProductDetails(prev => prev.map(p => {
      if (p.id === productId) {
        const updated = { ...p, [field]: value }
        
        if (field === 'warehouseId') {
          const stock = p.warehouseStocks.find(s => s.warehouse_id === value)
          updated.availableStock = stock?.quantity || 0
        }
        
        return updated
      }
      return p
    }))
  }

  const filteredEmployees = employees.filter(emp => 
    emp.first_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    emp.work_email?.toLowerCase().includes(employeeSearch.toLowerCase())
  )

  const handleCreateBulkZimmet = async () => {
    if (!selectedEmployeeId) {
      showToast('Lütfen zimmet alacak kişiyi seçin', 'error')
      return
    }

    for (const detail of productDetails) {
      if (detail.quantity <= 0) {
        showToast(`${detail.name} için geçerli bir miktar girin`, 'error')
        return
      }
      if (!detail.warehouseId) {
        showToast(`${detail.name} için depo seçin`, 'error')
        return
      }
      if (detail.quantity > detail.availableStock) {
        showToast(`${detail.name} için yeterli stok yok (Mevcut: ${detail.availableStock})`, 'error')
        return
      }
    }

    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Kullanıcı bulunamadı')

      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId)
      if (!selectedEmployee) throw new Error('Seçilen çalışan bulunamadı')

      for (const detail of productDetails) {
        const { data: stockRecord, error: stockError } = await supabase
          .from('warehouse_stock')
          .select('id, quantity, condition_breakdown')
          .eq('product_id', detail.id)
          .eq('warehouse_id', detail.warehouseId)
          .single()

        if (stockError || !stockRecord) {
          throw new Error(`${detail.name} için stok kaydı bulunamadı`)
        }

        const breakdown = (stockRecord.condition_breakdown as Record<string, number>) || {}
        let remainingToDeduct = detail.quantity
        const conditionOrder = ['yeni', 'kullanılmış', 'hek', 'arızalı']
        
        for (const condition of conditionOrder) {
          if (remainingToDeduct <= 0) break
          const conditionQty = breakdown[condition] || 0
          if (conditionQty > 0) {
            const deductAmount = Math.min(conditionQty, remainingToDeduct)
            breakdown[condition] = conditionQty - deductAmount
            remainingToDeduct -= deductAmount
          }
        }

        const newQuantity = parseFloat(stockRecord.quantity.toString()) - detail.quantity

        const { error: updateError } = await supabase
          .from('warehouse_stock')
          .update({ 
            quantity: newQuantity,
            condition_breakdown: breakdown,
            last_updated: new Date().toISOString(),
            updated_by: user.id
          })
          .eq('id', stockRecord.id)

        if (updateError) throw new Error(`${detail.name} için stok güncellenemedi`)

        const ownerDisplayName = (selectedEmployee.first_name || '').trim()
        const { error: inventoryError } = await supabase
          .from('user_inventory')
          .insert({
            product_id: detail.id,
            item_name: detail.name,
            quantity: detail.quantity,
            unit: detail.unit,
            assigned_date: new Date().toISOString(),
            assigned_by: user.id,
            status: 'active',
            notes: 'Toplu zimmet işlemi',
            category: null,
            consumed_quantity: 0,
            owner_name: ownerDisplayName || null,
            owner_email: buildDovecGroupWorkEmailFromDisplayName(ownerDisplayName) || null,
            source_warehouse_id: detail.warehouseId
          })

        if (inventoryError) throw new Error(`${detail.name} için zimmet kaydı oluşturulamadı`)

        await supabase
          .from('stock_movements')
          .insert({
            product_id: detail.id,
            warehouse_id: detail.warehouseId,
            movement_type: 'çıkış',
            quantity: detail.quantity,
            reason: `Toplu Zimmet: ${selectedEmployee.first_name}`,
            created_by: user.id
          })
      }

      showToast(`${productDetails.length} ürün ${selectedEmployee.first_name} adına zimmetlendi`, 'success')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Toplu zimmet hatası:', error)
      showToast(error.message || 'Zimmet işlemi başarısız oldu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-6 h-6 text-purple-600" />
            Toplu Zimmet
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {selectedProductIds.length} ürün seçildi
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Employee Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4" />
              Zimmet Alacak Kişi <span className="text-red-500">*</span>
            </Label>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Çalışan ara..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl border-gray-200"
              />
            </div>

            {selectedEmployee && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {selectedEmployee.first_name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{selectedEmployee.first_name}</p>
                  <p className="text-xs text-gray-500">{selectedEmployee.work_email}</p>
                </div>
                <Check className="w-5 h-5 text-purple-600" />
              </div>
            )}

            <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Çalışan bulunamadı</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredEmployees.map(employee => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className={`w-full p-3 text-left transition-colors hover:bg-gray-50 flex items-center gap-3 ${
                        selectedEmployeeId === employee.id ? 'bg-purple-50' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        selectedEmployeeId === employee.id ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        <span className="text-sm font-medium">
                          {employee.first_name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{employee.first_name}</p>
                        <p className="text-xs text-gray-500 truncate">{employee.work_email}</p>
                      </div>
                      {selectedEmployeeId === employee.id && (
                        <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Products */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Zimmet Edilecek Ürünler
            </Label>

            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Ürünler yükleniyor...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {productDetails.map(detail => (
                  <div key={detail.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{detail.name}</h4>
                        <p className="text-xs text-gray-500">Birim: {detail.unit}</p>
                      </div>
                      {detail.availableStock > 0 ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          Stok: {detail.availableStock} {detail.unit}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          Stok Yok
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Miktar */}
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Miktar</Label>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          max={detail.availableStock}
                          value={detail.quantity}
                          onChange={(e) => updateProductDetail(detail.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="h-9 rounded-lg border-gray-200"
                        />
                      </div>

                      {/* Depo */}
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Depo</Label>
                        <Select
                          value={detail.warehouseId}
                          onValueChange={(value) => updateProductDetail(detail.id, 'warehouseId', value)}
                        >
                          <SelectTrigger className="h-9 rounded-lg border-gray-200">
                            <SelectValue placeholder="Depo seçin" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {detail.warehouseStocks.map(stock => (
                              <SelectItem key={stock.id} value={stock.warehouse_id || ''}>
                                {stock.warehouse?.name || 'Bilinmeyen'} ({stock.quantity} {detail.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {detail.quantity > detail.availableStock && (
                      <div className="flex items-center gap-2 mt-3 text-red-600 bg-red-50 rounded-lg p-2">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">Yetersiz stok! Maksimum: {detail.availableStock}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-3 pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-200 text-gray-700 hover:bg-gray-50 h-11 rounded-xl"
          >
            İptal
          </Button>
          <Button
            onClick={handleCreateBulkZimmet}
            disabled={loading || loadingData || !selectedEmployeeId}
            className="bg-purple-600 hover:bg-purple-700 text-white h-11 rounded-xl px-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                İşleniyor...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Zimmet Oluştur ({productDetails.length} Ürün)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
